import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { budgetedCall } from "../../src/lib/ai/budgeted-call";
import { budgetPeriodStart, dbLedger, type Ledger, type Usage } from "../../src/lib/ai/cost";
import { aiFailureCode } from "../../src/lib/ai/failure";
import { ProviderError, type Provider } from "../../src/lib/ai/provider";
import { assessWritingForUser, type AssessmentDeps } from "../../src/lib/writing/assess";
import { assessSpeakingForUser } from "../../src/lib/speaking/assess";
import {
  dbSttLedger, withSttBudget, type SttLedger, type Usage as SttUsage,
} from "../../src/lib/speaking/stt/budget";
import { SttError } from "../../src/lib/speaking/stt/config";

// No client is constructed: all provider and persistence operations below are fakes.
globalThis.fetch = async () => { throw new Error("Unexpected network access"); };
const instant = new Date("2026-11-01T00:00:00.000Z");
const output = { text: "{}", promptTokens: 1, completionTokens: 1 };
const valid = {
  grammarScore: 70, vocabularyScore: 80, coherenceScore: 90,
  taskAchievementScore: 80, overallScore: 80,
  corrections: [{ original: "I has", corrected: "I have", errorType: "agreement", explanation: "Use have." }],
  suggestions: ["Practise agreement."], summary: "Clear answer.",
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
function memoryLedger(initial: Usage[] = []) {
  const rows = [...initial];
  let tail: Promise<unknown> = Promise.resolve();
  let locked = false;
  const ledger: Ledger = {
    read: async () => [...rows],
    spend: async since => rows.filter(row => !since || new Date(row.ts) >= since)
      .reduce((sum, row) => sum + row.costUsd, 0),
    pending: async (id, since) => {
      const matching = rows.filter(row => row.submissionId === id && new Date(row.ts) >= since);
      return matching.filter(row => row.status === "reserved").length >
        matching.filter(row => ["reconciled", "failed"].includes(row.status)).length;
    },
    append: async row => { rows.push(row); },
    exclusive(work) {
      const next = tail.then(async () => {
        assert.equal(locked, false);
        locked = true;
        try { return await work(ledger); } finally { locked = false; }
      });
      tail = next.catch(() => undefined);
      return next;
    },
  };
  return { rows, ledger, locked: () => locked };
}
const row = (ts = instant.toISOString(), costUsd = 1): Usage => ({
  ts, submissionId: "s", userId: "u", model: "m",
  promptTokens: 0, completionTokens: 0, costUsd, status: "reserved",
});
function call(store: ReturnType<typeof memoryLedger>, provider: Provider = async () => output,
  env: NodeJS.ProcessEnv = { NODE_ENV: "test" }, submissionId = "s", maxAttempts = 1) {
  return budgetedCall({ ledger: store.ledger, provider, env, now: () => instant,
    submissionId, userId: "u", model: "m", freeTest: false, messages: [],
    inputBound: 100, estimate: 0.1, timeout: 1000, maxAttempts, budget: 1,
    price: { input: 1, output: 1 }, onOutput: () => {} });
}
function assessmentDeps(store: ReturnType<typeof memoryLedger>, provider: Provider) {
  let saved: unknown = null;
  let weakness = 0;
  const db = {
    writingSubmission: {
      findFirst: async () => ({ finalText: "I has a story.", status: "SUBMITTED",
        assessment: null, prompt: { promptText: "A story", minWords: 1, maxWords: 100 } }),
      update: async () => {},
    },
    writingAssessment: {
      count: async () => 0,
      findUnique: async () => saved,
      create: async ({ data }: { data: unknown }) => { assert.equal((data as { summary: string }).summary, valid.summary.trim()); saved = data; },
    },
    weaknessRecord: { upsert: async () => { weakness++; } },
    $transaction: async (work: (tx: unknown) => Promise<void>) => work(db),
  };
  const deps: AssessmentDeps = {
    db: db as unknown as PrismaClient, provider, ledger: store.ledger,
    env: { NODE_ENV: "test", AI_ASSESSMENT_ENABLED: "true", AI_API_KEY: "mock",
      AI_PRICE_INPUT_PER_MTOK_USD: "1", AI_PRICE_OUTPUT_PER_MTOK_USD: "1" },
    now: () => instant,
  };
  return { deps, db, weakness: () => weakness };
}
async function assessmentChecks() {
  const store = memoryLedger();
  const release = deferred();
  const bothStarted = deferred();
  let inFlight = 0;
  const f = assessmentDeps(store, async () => {
    assert.equal(store.locked(), false);
    if (++inFlight === 2) bothStarted.resolve();
    await release.promise;
    return { ...output, text: JSON.stringify(valid) };
  });
  const first = assessWritingForUser("a", "u", f.deps);
  const second = assessWritingForUser("b", "u", f.deps);
  await bothStarted.promise;
  assert.equal(inFlight, 2);
  // An unrelated critical section can finish while both providers are pending.
  await store.ledger.exclusive(async ops => { assert.equal(await ops.spend(), store.rows[0].costUsd * 2); });
  release.resolve();
  assert.deepEqual((await Promise.all([first, second])).map(result => result.ok), [true, true]);
  console.log("PASS different submissions overlap; provider work holds no lock");

  const same = memoryLedger();
  const started = deferred();
  const finish = deferred();
  let calls = 0;
  const duplicate = assessmentDeps(same, async () => {
    calls++;
    started.resolve();
    await finish.promise;
    return { ...output, text: JSON.stringify(valid) };
  });
  const winner = assessWritingForUser("s", "u", duplicate.deps);
  await started.promise;
  const refused = await assessWritingForUser("s", "u", duplicate.deps);
  assert.equal(refused.ok, false);
  assert.equal(refused.message, "AI assessment already in progress");
  assert.equal(refused.diagnosis?.category, "request_refused");
  assert.equal(aiFailureCode(refused), "busy");
  assert.equal(calls, 1);
  finish.resolve();
  assert.equal((await winner).ok, true);
  // Force a stale pre-check so the transaction itself must enforce idempotence.
  assert.equal((await assessWritingForUser("s", "u", duplicate.deps)).ok, true);
  assert.equal(duplicate.weakness(), 1);
  // One unique violation (a concurrent winner, or a weakness-row collision) is retried once.
  const realTransaction = duplicate.db.$transaction;
  let violations = 1;
  duplicate.db.$transaction = async work => {
    if (violations-- > 0) throw Object.assign(new Error("duplicate"), { code: "P2002" });
    return realTransaction(work);
  };
  assert.equal((await assessWritingForUser("s", "u", duplicate.deps)).ok, true);
  assert.equal(duplicate.weakness(), 1);
  // A violation that survives the retry is a real failure: an unsaved assessment is never reported as saved.
  duplicate.db.$transaction = async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); };
  const unsaved = await assessWritingForUser("s", "u", duplicate.deps);
  assert.equal(unsaved.ok, false);
  assert.equal(unsaved.diagnosis?.persistence, "failed");
  duplicate.db.$transaction = realTransaction;
  assert.equal((await assessWritingForUser("s", "u", duplicate.deps)).ok, true);
  assert.equal(duplicate.weakness(), 1);
  console.log("PASS same submission returns busy; repeated persistence and P2002 are idempotent");

  const speaking = {
    speakingSubmission: {
      findFirst: async () => ({ confirmedTranscript: "A story.", status: "SUBMITTED",
        assessment: null, rawTranscript: null, prompt: { promptText: "A story" } }),
      update: async () => { assert.fail("existing assessment must not update status"); },
    },
    speakingAssessment: {
      count: async () => 0,
      findUnique: async () => ({}),
      create: async () => { assert.fail("existing assessment must not be recreated"); },
    },
    $transaction: async (work: (tx: unknown) => Promise<void>) => work(speaking),
  };
  const speakingDeps: AssessmentDeps = { ...duplicate.deps, db: speaking as unknown as PrismaClient,
    ledger: memoryLedger().ledger, env: { ...duplicate.deps.env, SPEAKING_AI_ASSESSMENT_ENABLED: "true" },
    provider: async () => ({ ...output, text: JSON.stringify({ topicRelevanceScore: 70,
      grammarScore: 70, vocabularyScore: 70, coherenceScore: 70,
      corrections: [], suggestions: [], summary: "Clear." }) }) };
  assert.equal((await assessSpeakingForUser("s", "u", speakingDeps)).ok, true);
  const speakingTransaction = speaking.$transaction;
  let speakingViolations = 1;
  speaking.$transaction = async work => {
    if (speakingViolations-- > 0) throw Object.assign(new Error("duplicate"), { code: "P2002" });
    return speakingTransaction(work);
  };
  assert.equal((await assessSpeakingForUser("s", "u", speakingDeps)).ok, true);
  speaking.$transaction = async () => { throw Object.assign(new Error("duplicate"), { code: "P2002" }); };
  assert.equal((await assessSpeakingForUser("s", "u", speakingDeps)).ok, false);
  console.log("PASS Speaking persistence skips existing assessment and accepts P2002");
}
async function windowAndFailureChecks() {
  const boundary = new Date(instant.getTime() - 31_000);
  assert.equal(await memoryLedger([row(boundary.toISOString(), 0.1)])
    .ledger.pending("s", boundary), true);
  const expired = memoryLedger([row("2026-10-31T23:59:28.999Z", 0.1)]);
  await call(expired);
  assert.deepEqual(expired.rows.map(r => r.status), ["reserved", "reserved", "reconciled"]);
  assert.equal(budgetPeriodStart({ NODE_ENV: "test" }, instant)?.toISOString(), instant.toISOString());
  for (const period of [undefined, "", "month"]) {
    await call(memoryLedger([{ ...row("2026-10-31T23:59:59.999Z", 10), submissionId: "other" }]), undefined,
      { NODE_ENV: "test", AI_BUDGET_PERIOD: period });
  }
  await assert.rejects(call(memoryLedger([{ ...row("2026-10-31T23:59:59.999Z", 10), submissionId: "other" }]), undefined,
    { NODE_ENV: "test", AI_BUDGET_PERIOD: "lifetime" }), /budget exceeded/);
  await assert.rejects(call(memoryLedger([{ ...row(instant.toISOString(), 1), submissionId: "other" }])), /budget exceeded/);
  for (const value of ["week", "MONTH", " "]) {
    const invalid = memoryLedger();
    const f = assessmentDeps(invalid, async () => { assert.fail("invalid period called provider"); });
    f.deps.env.AI_BUDGET_PERIOD = value;
    const result = await assessWritingForUser("s", "u", f.deps);
    assert.equal(result.message, "Invalid AI budget period");
    assert.equal(invalid.rows.length, 0);
  }
  console.log("PASS abandoned reservations expire; UTC month boundary, lifetime and invalid periods");
  const retry = memoryLedger();
  let attempts = 0;
  await call(retry, async () => {
    if (++attempts === 1) throw new ProviderError(true);
    return output;
  }, undefined, "s", 2);
  assert.deepEqual(retry.rows.map(r => r.status), ["reserved", "failed", "reserved", "reconciled"]);
  assert.equal(retry.rows[1].costUsd, 0);
  assert.ok(Math.abs(await retry.ledger.spend() - 0.100002) < 1e-12);
  const invalid = memoryLedger();
  await assert.rejects(call(invalid, async () => ({ ...output, promptTokens: -1 })), /Invalid AI usage/);
  assert.deepEqual(invalid.rows.map(r => r.status), ["reserved", "failed"]);
  assert.equal(await invalid.ledger.spend(), 0.1);
  console.log("PASS failed usage stays charged and each retry reserves and settles separately");
}

function memoryStt(initial: SttUsage[] = []) {
  const rows = [...initial];
  let locked = false;
  let tail: Promise<unknown> = Promise.resolve();
  const ledger: SttLedger = {
    read: async () => rows,
    spend: async since => {
      assert.equal(locked, true);
      return rows.filter(r => !since || new Date(r.ts) >= since).reduce((sum, r) => sum + r.costUsd, 0);
    },
    count: async (userId, since) => {
      assert.equal(locked, true);
      return rows.filter(r => r.userId === userId && r.status === "reserved" && new Date(r.ts) >= since).length;
    },
    append: async r => {
      assert.equal(locked, r.status === "reserved");
      rows.push(r);
    },
    exclusive(work) {
      const next = tail.then(async () => {
        locked = true;
        try { return await work(ledger); } finally { locked = false; }
      });
      tail = next.catch(() => undefined);
      return next;
    },
  };
  return { ledger, rows, locked: () => locked };
}
async function sttChecks() {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", SPEAKING_STT_ENABLED: "true",
    GROQ_API_KEY: "mock", SPEAKING_STT_PRICE_PER_HOUR_USD: "0.1" };
  const previous: SttUsage = { ts: "2026-10-31T23:59:59.999Z", userId: "u",
    audioSeconds: 10, costUsd: 1, status: "reserved" };
  const store = memoryStt([previous]);
  const started = deferred();
  const finish = deferred();
  const first = withSttBudget("u", 10, env, store.ledger, async () => {
    assert.equal(store.locked(), false);
    started.resolve();
    await finish.promise;
    return 42;
  }, instant);
  await started.promise;
  await store.ledger.exclusive(async () => {});
  finish.resolve();
  assert.equal(await first, 42);
  assert.equal(store.rows.at(-1)?.status, "completed");
  const rejectReason = (reason: string) => (error: unknown) => error instanceof SttError && error.reason === reason;
  const forbidden = async () => { assert.fail("cap must refuse before work"); };
  await assert.rejects(withSttBudget("u", 10, { ...env, AI_BUDGET_PERIOD: "lifetime" },
    memoryStt([previous]).ledger, forbidden, instant), rejectReason("pilot_budget"));
  await assert.rejects(withSttBudget("u", 10, env,
    memoryStt([{ ...previous, ts: instant.toISOString(), userId: "other" }]).ledger,
    forbidden, instant), rejectReason("pilot_budget"));
  const today = { ...previous, ts: instant.toISOString(), costUsd: 0 };
  await assert.rejects(withSttBudget("u", 10, env,
    memoryStt(Array(5).fill(today)).ledger, forbidden, instant), rejectReason("daily_cap"));
  const invalid = memoryStt();
  await assert.rejects(withSttBudget("u", 10, { ...env, AI_BUDGET_PERIOD: "invalid" },
    invalid.ledger, forbidden, instant), /Invalid AI budget period/);
  assert.equal(invalid.rows.length, 0);
  console.log("PASS STT work holds no lock; daily and monthly/lifetime pilot caps checked under lock");
}

async function dbChecks() {
  const keys: number[] = [];
  for (const kind of ["ASSESSMENT", "STT"] as const) {
    let inside = false;
    const events: string[] = [];
    const stored = { ...row(), kind, createdAt: instant, audioSeconds: 10 };
    const delegates = (transaction: boolean) => {
      const check = (operation: string, args: unknown) => {
        assert.equal(inside, transaction, "query used the wrong connection");
        if (inside) assert.equal(events[0], "lock");
        events.push(operation);
        const input = args as { where?: { kind: string }; data?: { kind: string; createdAt: Date } };
        assert.equal((input.where ?? input.data)?.kind, kind);
        if (input.data) assert.equal(input.data.createdAt.toISOString(), instant.toISOString());
      };
      return {
        findMany: async (args: unknown) => {
          check("read", args);
          assert.deepEqual((args as { orderBy: unknown }).orderBy, { createdAt: "asc" });
          return [stored];
        },
        aggregate: async (args: unknown) => {
          check("spend", args);
          assert.deepEqual((args as { _sum: unknown })._sum, { costUsd: true });
          const where = (args as { where: { createdAt?: { gte: Date } } }).where;
          assert.deepEqual(where.createdAt, inside ? { gte: instant } : undefined);
          return { _sum: { costUsd: 1 } };
        },
        count: async (args: unknown) => {
          check("count", args);
          const where = (args as { where: {
            createdAt: { gte: Date }; submissionId?: string;
            userId?: string; status: string | { in: string[] };
          } }).where;
          assert.deepEqual(where.createdAt, { gte: instant });
          if (kind === "STT") {
            assert.equal(where.userId, "u");
            assert.equal(where.status, "reserved");
          } else {
            assert.equal(where.submissionId, "s");
            if (typeof where.status !== "string") {
              assert.deepEqual(where.status.in, ["reconciled", "failed"]);
            } else assert.equal(where.status, "reserved");
          }
          return 1;
        },
        create: async (args: unknown) => { check("append", args); return stored; },
      };
    };
    const tx = { aiUsage: delegates(true),
      $executeRaw: async (strings: TemplateStringsArray, key: number) => {
        assert.equal(inside, true);
        assert.equal(events.length, 0);
        assert.equal(strings.join("?"), "SELECT pg_advisory_xact_lock(?)");
        assert.equal(Number.isInteger(key), true);
        keys.push(key);
        events.push("lock");
        return 1;
      } };
    const db = { aiUsage: delegates(false),
      $transaction: async (work: (client: typeof tx) => Promise<unknown>, options: unknown) => {
        assert.deepEqual(options, { maxWait: 10_000, timeout: 15_000 });
        events.length = 0;
        inside = true;
        try { return await work(tx); } finally { inside = false; }
      } } as unknown as PrismaClient;
    if (kind === "ASSESSMENT") {
      const ledger = dbLedger(db);
      await ledger.exclusive(async ops => {
        assert.equal((await ops.read())[0].ts, instant.toISOString());
        assert.equal(await ops.spend(instant), 1);
        assert.equal(await ops.pending("s", instant), false);
        await ops.append(row());
      });
      await ledger.read();
      await ledger.spend();
      await ledger.pending("s", instant);
      await ledger.append(row());
    } else {
      const ledger = dbSttLedger(db);
      const usage: SttUsage = { ts: instant.toISOString(), userId: "u",
        audioSeconds: 10, costUsd: 1, status: "reserved" };
      await ledger.exclusive(async ops => {
        assert.equal((await ops.read())[0].audioSeconds, 10);
        assert.equal(await ops.spend(instant), 1);
        assert.equal(await ops.count("u", instant), 1);
        await ops.append(usage);
      });
      await ledger.read();
      await ledger.spend();
      await ledger.count("u", instant);
      await ledger.append(usage);
    }
  }
  assert.notEqual(keys[0], keys[1]);
  console.log("PASS DB ledgers: transaction-bound operations, advisory lock first, distinct keys, kinds and options");
}
async function run() {
  await assessmentChecks();
  await windowAndFailureChecks();
  await sttChecks();
  await dbChecks();
}
run().catch(error => { console.error(error); process.exitCode = 1; });
