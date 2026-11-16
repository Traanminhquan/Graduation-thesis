import type { Prisma, PrismaClient } from "@prisma/client";
import { appendFile, mkdir, readFile, rmdir } from "node:fs/promises";
import path from "node:path";
import { providerConfig } from "./provider";
export type Usage = { ts: string; submissionId: string; userId?: string; model: string; promptTokens: number; completionTokens: number; costUsd: number; status: string };
export interface LedgerOps {
  read(): Promise<Usage[]>;
  spend(since?: Date): Promise<number>;
  pending(submissionId: string, since: Date): Promise<boolean>;
  append(row: Usage): Promise<void>;
}
export interface Ledger extends LedgerOps {
  exclusive<T>(work: (ops: LedgerOps) => Promise<T>): Promise<T>;
}
export function budgetPeriodStart(env: NodeJS.ProcessEnv, now: Date): Date | undefined {
  const period = env.AI_BUDGET_PERIOD || "month";
  if (period === "lifetime") return undefined;
  if (period !== "month") throw new Error("Invalid AI budget period");
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
const ASSESSMENT_LOCK_KEY = 15015001;
export function dbLedger(db: PrismaClient): Ledger {
  const opsBoundTo = (client: Pick<Prisma.TransactionClient, "aiUsage">): LedgerOps => ({
    async read() {
      const rows = await client.aiUsage.findMany({ where: { kind: "ASSESSMENT" }, orderBy: { createdAt: "asc" } });
      return rows.map(row => ({ ts: row.createdAt.toISOString(), submissionId: row.submissionId ?? "", userId: row.userId ?? undefined, model: row.model ?? "", promptTokens: row.promptTokens, completionTokens: row.completionTokens, costUsd: row.costUsd, status: row.status }));
    },
    async spend(since) {
      const result = await client.aiUsage.aggregate({ where: { kind: "ASSESSMENT", ...(since ? { createdAt: { gte: since } } : {}) }, _sum: { costUsd: true } });
      return result._sum.costUsd ?? 0;
    },
    async pending(submissionId, since) {
      const where = { kind: "ASSESSMENT" as const, submissionId, createdAt: { gte: since } };
      const reserved = await client.aiUsage.count({ where: { ...where, status: "reserved" } });
      const settled = await client.aiUsage.count({ where: { ...where, status: { in: ["reconciled", "failed"] } } });
      return reserved > settled;
    },
    async append(row) {
      const { ts, ...data } = row;
      await client.aiUsage.create({ data: { ...data, kind: "ASSESSMENT", createdAt: new Date(ts) } });
    },
  });
  return { ...opsBoundTo(db), exclusive: work => db.$transaction(async tx => {
    // Bind every operation to this connection: the production pool has only one.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ASSESSMENT_LOCK_KEY})`;
    return work(opsBoundTo(tx));
  }, { maxWait: 10_000, timeout: 15_000 }) };
}
export function fileLedger(directory = path.join(process.cwd(), "logs")): Ledger {
  const file = path.join(directory, "ai-usage.jsonl");
  const ledger: Ledger = {
    async read() {
      try { return (await readFile(file, "utf8")).split("\n").filter(Boolean).map(line => {
        const row = JSON.parse(line) as Usage;
        if (!Number.isFinite(row.costUsd) || !Number.isFinite(Date.parse(row.ts))) throw new Error("Invalid usage ledger");
        return row;
      }).sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    },
    async spend(since) { return (await ledger.read()).filter(row => !since || new Date(row.ts) >= since).reduce((sum, row) => sum + row.costUsd, 0); },
    async pending(submissionId, since) {
      const rows = (await ledger.read()).filter(row => row.submissionId === submissionId && new Date(row.ts) >= since);
      return rows.filter(row => row.status === "reserved").length > rows.filter(row => ["reconciled", "failed"].includes(row.status)).length;
    },
    async append(row) { await mkdir(directory, { recursive: true }); await appendFile(file, JSON.stringify(row) + "\n", { mode: 0o600 }); },
    async exclusive(work) {
      await mkdir(directory, { recursive: true });
      const lock = path.join(directory, "ai-assessment.lock");
      // Fail closed on a busy/stale lock; never remove another process's lock.
      await mkdir(lock);
      try { return await work(ledger); } finally { await rmdir(lock); }
    },
  };
  return ledger;
}
export function prices(env: NodeJS.ProcessEnv) {
  if (providerConfig(env).freeTest) return { input: 0, output: 0 };
  const parse = (key: string) => {
    const raw = env[key]; const n = Number(raw);
    if (!raw?.trim() || !Number.isFinite(n) || n <= 0) throw new Error("AI pricing unavailable: configure both per-million-token prices");
    return n;
  };
  return { input: parse("AI_PRICE_INPUT_PER_MTOK_USD"), output: parse("AI_PRICE_OUTPUT_PER_MTOK_USD") };
}
