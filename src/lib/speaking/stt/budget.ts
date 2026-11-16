import type { Prisma, PrismaClient } from "@prisma/client";
import { budgetPeriodStart } from "../../ai/cost";
import { appendFile, mkdir, readFile, rmdir } from "node:fs/promises";
import path from "node:path";
import { STT_DURATION_TOLERANCE_SECONDS, SttError, sttConfig } from "./config";
export type Usage = { ts: string; userId: string; audioSeconds: number; costUsd: number; status: "reserved" | "completed" };
export interface SttLedgerOps {
  read(): Promise<Usage[]>;
  spend(since?: Date): Promise<number>;
  count(userId: string, since: Date): Promise<number>;
  append(row: Usage): Promise<void>;
}
export interface SttLedger extends SttLedgerOps {
  exclusive<T>(work: (ops: SttLedgerOps) => Promise<T>): Promise<T>;
}
const STT_LOCK_KEY = 15015002;
export function dbSttLedger(db: PrismaClient): SttLedger {
  const opsBoundTo = (client: Pick<Prisma.TransactionClient, "aiUsage">): SttLedgerOps => ({
    async read() {
      const rows = await client.aiUsage.findMany({ where: { kind: "STT" }, orderBy: { createdAt: "asc" } });
      return rows.map(row => ({ ts: row.createdAt.toISOString(), userId: row.userId ?? "", audioSeconds: row.audioSeconds ?? 0, costUsd: row.costUsd, status: row.status as Usage["status"] }));
    },
    async spend(since) {
      const result = await client.aiUsage.aggregate({ where: { kind: "STT", ...(since ? { createdAt: { gte: since } } : {}) }, _sum: { costUsd: true } });
      return result._sum.costUsd ?? 0;
    },
    count(userId, since) { return client.aiUsage.count({ where: { kind: "STT", userId, status: "reserved", createdAt: { gte: since } } }); },
    async append(row) {
      const { ts, ...data } = row;
      await client.aiUsage.create({ data: { ...data, kind: "STT", createdAt: new Date(ts) } });
    },
  });
  return { ...opsBoundTo(db), exclusive: work => db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${STT_LOCK_KEY})`;
    return work(opsBoundTo(tx));
  }, { maxWait: 10_000, timeout: 15_000 }) };
}
export function fileSttLedger(directory = path.join(process.cwd(), "logs")): SttLedger {
  const file = path.join(directory, "speaking-stt-usage.jsonl");
  const ledger: SttLedger = {
    async read() {
      try {
        const rows = (await readFile(file, "utf8")).split("\n").filter(Boolean).map(line => JSON.parse(line) as Usage);
        if (rows.some(r => !Number.isFinite(Date.parse(r.ts)) || typeof r.userId !== "string" || !Number.isFinite(r.costUsd) || r.costUsd < 0 || !Number.isFinite(r.audioSeconds) || r.audioSeconds < 0 || !["reserved", "completed"].includes(r.status))) throw new SttError("unavailable");
        return rows.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
      } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    },
    async spend(since) { return (await ledger.read()).filter(row => !since || new Date(row.ts) >= since).reduce((sum, row) => sum + row.costUsd, 0); },
    async count(userId, since) { return (await ledger.read()).filter(row => row.userId === userId && row.status === "reserved" && new Date(row.ts) >= since).length; },
    async append(row) { await mkdir(directory, { recursive: true }); await appendFile(file, JSON.stringify(row) + "\n", { mode: 0o600 }); },
    async exclusive(work) {
      await mkdir(directory, { recursive: true });
      const lock = path.join(directory, "speaking-stt.lock");
      await mkdir(lock);
      try { return await work(ledger); } finally { await rmdir(lock); }
    },
  };
  return ledger;
}
/** Completion rows cost zero: reservations remain the authoritative conservative spend. */
export async function withSttBudget<T>(userId: string, seconds: number, env: NodeJS.ProcessEnv, ledger: SttLedger, work: () => Promise<T>, now = new Date()): Promise<T> {
  const config = sttConfig(env);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > config.maxSeconds + STT_DURATION_TOLERANCE_SECONDS) throw new SttError("invalid_duration");
  const estimate = Math.max(seconds, config.minBilled) * config.price / 3600;
  if (estimate > config.requestCap) throw new SttError("request_budget");
  const periodStart = budgetPeriodStart(env, now);
  const ts = now.toISOString();
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  await ledger.exclusive(async ops => {
    if (await ops.count(userId, day) >= config.dailyCap) throw new SttError("daily_cap");
    if (await ops.spend(periodStart) + estimate > config.pilotCap) throw new SttError("pilot_budget");
    await ops.append({ ts, userId, audioSeconds: seconds, costUsd: estimate, status: "reserved" });
  });
  const result = await work();
  await ledger.append({ ts, userId, audioSeconds: seconds, costUsd: 0, status: "completed" });
  return result;
}
