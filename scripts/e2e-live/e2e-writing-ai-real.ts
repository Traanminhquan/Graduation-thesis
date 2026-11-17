/** Real wiring shared by the live and mock E2E runners. Never import this module in offline checks. */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { prisma } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/auth/password";
import { fileLedger, type Ledger } from "../../src/lib/ai/cost";
import { assessWritingForUser } from "../../src/lib/writing/assess";
import { submitWritingForUser } from "../../src/lib/writing/submit";
import { PORT, ledgerPath, type E2EDeps } from "./e2e-writing-ai-core";

export { prisma };

const isListening = (port: number) => new Promise<boolean>(resolve => {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
  socket.setTimeout(1500, () => { socket.destroy(); resolve(false); });
});
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export type RealDepsOptions = {
  args: string[];
  mode?: "live" | "mock";
  /** Isolated ledger (mock mode). Defaults to the real logs/ai-usage.jsonl ledger. */
  ledger?: Ledger;
  readLedgerRaw?: () => string;
  /** Runs submit/assess inside a wrapper (mock mode uses it to point the default ledger path at a temp directory). */
  wrap?: <T>(work: () => Promise<T>) => Promise<T>;
};

export function createRealDeps(options: RealDepsOptions): E2EDeps {
  const wrap = options.wrap ?? (<T>(work: () => Promise<T>) => work());
  let child: ChildProcess | undefined;
  return {
    mode: options.mode ?? "live",
    env: process.env, args: options.args, log: console.log, hashPassword,
    submit: input => wrap(() => submitWritingForUser(input)),
    assess: (submissionId, userId) => wrap(() => assessWritingForUser(submissionId, userId)),
    ledger: options.ledger ?? fileLedger(),
    readLedgerRaw: options.readLedgerRaw ?? (() => readFileSync(ledgerPath, "utf8")),
    db: {
      migrations: async () => (await prisma.$queryRaw<{ migration_name: string }[]>`select migration_name from _prisma_migrations order by started_at`).map(r => r.migration_name),
      counts: async () => ({ users: await prisma.user.count(), submissions: await prisma.writingSubmission.count(), assessments: await prisma.writingAssessment.count(), weakness: await prisma.weaknessRecord.count() }),
      userByEmail: email => prisma.user.findUnique({ where: { email }, select: { id: true } }),
      userById: id => prisma.user.findUnique({ where: { id }, select: { email: true } }),
      promptExists: async id => (await prisma.writingPrompt.findUnique({ where: { id }, select: { id: true } })) !== null,
      createUser: data => prisma.user.create({ data, select: { id: true } }),
      submissionWithAssessment: id => prisma.writingSubmission.findUnique({ where: { id }, include: { assessment: true } }),
      weaknessForUser: userId => prisma.weaknessRecord.findMany({ where: { userId, skill: "WRITING" }, select: { id: true, category: true, occurrenceCount: true } }),
      assessmentBySubmission: submissionId => prisma.writingAssessment.findUnique({ where: { submissionId }, select: { id: true, assessedAt: true } }),
      submissionIdsForUser: async userId => (await prisma.writingSubmission.findMany({ where: { userId }, select: { id: true } })).map(r => r.id),
      deleteUser: async id => { await prisma.user.delete({ where: { id } }); },
      submissionExists: async id => (await prisma.writingSubmission.findUnique({ where: { id }, select: { id: true } })) !== null,
      assessmentExists: async id => (await prisma.writingAssessment.findUnique({ where: { id }, select: { id: true } })) !== null,
      weaknessCount: ids => prisma.weaknessRecord.count({ where: { id: { in: ids } } }),
    },
    system: {
      isListening, sleep,
      otherListeners: () => execFileSync("netstat", ["-ano"], { encoding: "utf8" }).split("\n").filter(line => /:3000\s/.test(line) && /LISTENING/.test(line)).length,
      buildExists: () => existsSync(path.join(".next", "BUILD_ID")),
      envStamp: () => { const stat = statSync(".env"); return `${stat.size}:${stat.mtimeMs}`; },
      // The Supabase pooler accepts one client: free this process's connection so the test-owned server can use it.
      releaseDatabase: async () => { await prisma.$disconnect(); },
      startServer: env => { child = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], { env, stdio: "ignore", windowsHide: true }); },
      serverStarted: () => child !== undefined,
      serverExited: () => child !== undefined && child.exitCode !== null,
      stopServer: async () => {
        if (child?.pid) { try { execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { child.kill(); } }
        for (let i = 0; i < 15 && await isListening(PORT); i++) await sleep(1000);
        return !(await isListening(PORT));
      },
    },
  };
}
