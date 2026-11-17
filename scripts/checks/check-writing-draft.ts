import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { draftId, getDraftForUser, getSubmissionBaseline, saveDraftForUser } from "../../src/lib/writing/draft";
import { draftLabel, draftReducer, resolveRestore, type DraftState } from "../../src/lib/writing/draft-state";
import { submitWritingForUser } from "../../src/lib/writing/submit";
import { getWritingSubmissionForUser, listWritingPrompts } from "../../src/lib/writing/data";

type Row = Record<string, unknown> & { id: string; userId: string; promptId: string; status: string; updatedAt: Date; draftText: string | null };
type Args = { where?: Record<string, unknown>; data?: Record<string, unknown>; orderBy?: unknown };
function fake() {
  let rows: Row[] = []; let tick = 0; let failCreate = false; let race = false;
  const calls: { operation: string; key?: unknown; sql?: string }[] = [];
  const prompt = { id: "p", title: "Prompt", promptText: "Write something", topic: null, difficulty: "BEGINNER", minWords: null, maxWords: null };
  const matches = (row: Row, where: Record<string, unknown> = {}): boolean => Object.entries(where).every(([key, value]) => {
    const actual = row[key];
    if (value instanceof Date) return actual instanceof Date && actual.getTime() === value.getTime();
    if (value && typeof value === "object" && "not" in value) return actual !== value.not;
    return actual === value;
  });
  // Prisma promises are lazy: array transactions must execute operations only inside the transaction.
  const lazy = <T>(work: () => T) => ({ then: <R>(resolve: (value: T) => R, reject?: (error: unknown) => R) => Promise.resolve().then(work).then(resolve, reject) });
  const client = {
    writingPrompt: { findUnique: async ({ where }: Args) => where?.id === "p" ? prompt : null, findMany: async () => [prompt] },
    writingSubmission: {
      findFirst: async ({ where, orderBy }: Args) => {
        calls.push({ operation: Array.isArray(orderBy) ? "baseline" : "findFirst" });
        return rows.filter(row => matches(row, where)).sort((a, b) => Array.isArray(orderBy)
          ? (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime() || b.id.localeCompare(a.id)
          : b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
      },
      findMany: async ({ where }: Args) => rows.filter(row => matches(row, where)),
      updateMany: ({ where, data }: Args) => lazy(() => { let count = 0; for (const row of rows) if (matches(row, where)) { Object.assign(row, data); count++; } return { count }; }),
      create: ({ data }: Args) => lazy(() => {
        calls.push({ operation: "create" });
        if (failCreate) throw new Error("synthetic create failure");
        const row = { id: `submission-${++tick}`, updatedAt: new Date(1_000 + tick), createdAt: new Date(), ...data } as unknown as Row;
        if (race || rows.some(existing => existing.id === row.id)) { race = false; throw Object.assign(new Error("duplicate"), { code: "P2002" }); }
        rows.push(row); return row;
      }),
      deleteMany: ({ where }: Args) => lazy(() => { calls.push({ operation: "delete" }); const before = rows.length; rows = rows.filter(row => !matches(row, where)); return { count: before - rows.length }; }),
    },
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => lazy(() => {
      calls.push({ operation: "lock", sql: strings.join("?"), key: values[0] }); return 1;
    }),
    $transaction: async (operations: PromiseLike<unknown>[] | ((tx: unknown) => Promise<unknown>)) => {
      const snapshot = structuredClone(rows);
      try { if (typeof operations === "function") return await operations(client); const result = []; for (const operation of operations) result.push(await operation); return result; }
      catch (error) { rows = snapshot; throw error; }
    },
  };
  return { db: client as unknown as PrismaClient, calls, rows: () => rows, fail: (value: boolean) => { failCreate = value; }, race: () => { race = true; } };
}
async function main() {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Network forbidden"); };
  try {
    const f = fake();
    const save = (text: string, baseSavedAt: string | null = null, userId = "a", promptId = "p") => saveDraftForUser({ userId, promptId, text, baseSavedAt, submissionBaseline: null }, f.db);
    assert.deepEqual(await save(""), { ok: true, savedAt: null }); assert.equal(f.rows().length, 0);
    assert.deepEqual(await save("x", null, ""), { ok: false, reason: "unauthenticated" });
    assert.deepEqual(await save("x", null, "a", "missing"), { ok: false, reason: "invalid" });
    assert.notEqual(draftId("a_b", "c"), draftId("a", "b_c"));
    const cap = fake();
    assert.ok((await saveDraftForUser({ userId: "a", promptId: "p", text: "x".repeat(20_000), baseSavedAt: null, submissionBaseline: null }, cap.db)).ok);
    assert.equal(cap.rows()[0].draftText?.length, 20_000);
    const first = await save("  hello\u0000  \r\nworld  \n\n\nend  "); assert.ok(first.ok);
    assert.equal(f.rows()[0].id, draftId("a", "p")); assert.equal(f.rows()[0].draftText, "hello\nworld\n\nend");
    assert.equal(f.rows()[0].finalText, null);
    assert.deepEqual(await getDraftForUser("a", "p", f.db), { text: "hello\nworld\n\nend", savedAt: first.savedAt });
    assert.equal(await getDraftForUser("b", "p", f.db), null);
    const before = structuredClone(f.rows());
    assert.equal((await save("x".repeat(20_001), first.savedAt)).ok, false); assert.deepEqual(f.rows(), before);
    const second = await save("changed", first.savedAt); assert.ok(second.ok); assert.notEqual(second.savedAt, first.savedAt);
    assert.equal((await save("stale", first.savedAt)).ok, false); assert.equal(f.rows()[0].draftText, "changed");
    const stolen = await save("stolen", second.savedAt, "b"); assert.ok(!stolen.ok && stolen.reason === "conflict"); assert.equal(f.rows()[0].draftText, "changed");
    const summaries = await listWritingPrompts("a", f.db); assert.equal(summaries[0].submissionCount, 0); assert.equal(summaries[0].latestSubmission, null); assert.equal(summaries[0].hasDraft, true);
    assert.equal(await getWritingSubmissionForUser(draftId("a", "p"), "a", f.db), null);
    f.race(); const raced = await save("race", null, "b"); assert.ok(!raced.ok && raced.reason === "conflict"); assert.equal(f.rows().length, 1);
    const assess = async () => ({ ok: true as const });
    const submit = (userId: string) => submitWritingForUser({ userId, promptId: "p", text: "This is a complete writing response for a local test." }, { db: f.db, assess });
    f.fail(true); assert.equal((await submit("a")).ok, false); assert.equal(f.rows()[0].draftText, "changed"); f.fail(false);
    assert.ok((await submit("b")).ok); assert.equal(f.rows().some(row => row.id === draftId("a", "p")), true);
    assert.ok((await submit("a")).ok); assert.equal(f.rows().some(row => row.id === draftId("a", "p")), false); assert.equal(f.rows().filter(row => row.status === "SUBMITTED").length, 2);
    await f.db.writingSubmission.create({ data: { id: draftId("a", "p"), userId: "a", promptId: "p", status: "SUBMITTED", wordCount: 0 } });
    const occupied = structuredClone(f.rows()); const blocked = await save("never overwrite"); assert.ok(!blocked.ok && blocked.reason === "conflict"); assert.deepEqual(f.rows(), occupied);
    assert.equal((await listWritingPrompts("a", f.db))[0].submissionCount, 2);
    assert.equal(requests, 0);
    for (const path of ["draft.ts", "draft-state.ts"]) {
      const source = readFileSync(`src/lib/writing/${path}`, "utf8");
      assert.ok(!/(?:from\s*|import\s*\()["'][^"']*(?:assess|provider|\/ai\/)/i.test(source));
    }
    const action = readFileSync("src/app/[lang]/writing/actions.ts", "utf8"); assert.ok(!/from ["'][^"']*(?:assess|provider|\/ai\/)/i.test(action));
    // Both arrival orders use the same lock, before any baseline read or mutation.
    const late = fake();
    const submitTo = (db: PrismaClient, userId = "a") => submitWritingForUser({ userId, promptId: "p", text: "A complete local writing response." }, { db, assess });
    const firstSave = (db: PrismaClient, submissionBaseline: string | null) => saveDraftForUser({ userId: "a", promptId: "p", text: "new draft", baseSavedAt: null, submissionBaseline }, db);
    assert.equal(await getSubmissionBaseline("a", "p", late.db), null);
    late.calls.length = 0;
    const submitted = await submitTo(late.db); assert.ok(submitted.ok);
    assert.deepEqual(late.calls.map(call => call.operation), ["lock", "delete", "create"]);
    const submitLock = late.calls[0];
    late.calls.length = 0;
    assert.deepEqual(await firstSave(late.db, null), { ok: false, reason: "conflict" });
    assert.equal(late.rows().length, 1); assert.equal(late.rows()[0].status, "SUBMITTED");
    const listed = (await listWritingPrompts("a", late.db))[0];
    assert.equal(listed.hasDraft, false); assert.equal(listed.submissionCount, 1);
    const lockIndex = late.calls.findIndex(call => call.operation === "lock");
    assert.ok(lockIndex >= 0); assert.equal(late.calls[lockIndex + 1].operation, "baseline");
    assert.deepEqual(late.calls[lockIndex], submitLock);
    assert.equal(submitLock.key, "writing-draft:a:p");
    assert.equal(submitLock.sql, "SELECT pg_advisory_xact_lock(hashtext(?))");
    const baseline = await getSubmissionBaseline("a", "p", late.db);
    assert.equal(baseline, submitted.submissionId);
    assert.ok((await submitTo(late.db, "b")).ok);
    assert.equal(await getSubmissionBaseline("a", "p", late.db), baseline);
    assert.equal(await getSubmissionBaseline("a", "other-prompt", late.db), null);
    assert.ok((await firstSave(late.db, baseline)).ok);
    const early = fake();
    assert.ok((await firstSave(early.db, null)).ok);
    assert.deepEqual(early.calls.slice(-3).map(call => call.operation), ["lock", "baseline", "create"]);
    assert.ok((await submitTo(early.db)).ok);
    assert.equal(early.rows().length, 1); assert.equal(early.rows()[0].status, "SUBMITTED");
    const invalid = fake();
    const missingBaseline = { userId: "a", promptId: "p", text: "unsaved", baseSavedAt: null };
    // Deliberately exercise malformed runtime callers without weakening the public input type.
    // @ts-expect-error missing required baseline
    assert.deepEqual(await saveDraftForUser(missingBaseline, invalid.db), { ok: false, reason: "invalid" });
    for (const value of [undefined, 123, {}, false]) {
      // @ts-expect-error invalid runtime baseline
      assert.deepEqual(await saveDraftForUser({ ...missingBaseline, submissionBaseline: value }, invalid.db), { ok: false, reason: "invalid" });
    }
    assert.equal(invalid.rows().length, 0); assert.ok(!invalid.calls.some(call => call.operation === "lock"));
    const reviewAction = readFileSync("src/app/[lang]/writing/[promptId]/result/[submissionId]/actions.ts", "utf8"); assert.match(reviewAction, /status: \{ not: "DRAFT" \}/);
    let state: DraftState = { text: "one", savedText: "", savedAt: null, flight: null, error: null };
    assert.equal(draftLabel(state), "Unsaved changes");
    state = draftReducer(state, { type: "start", id: 1 }); assert.equal(draftLabel(state), "Saving…");
    assert.deepEqual(draftReducer(state, { type: "start", id: 2 }), state);
    state = draftReducer(state, { type: "edit", text: "two" });
    state = draftReducer(state, { type: "saved", id: 1, savedAt: "2026-11-06T00:00:00.000Z" }); assert.equal(state.text, "two"); assert.equal(draftLabel(state), "Unsaved changes");
    assert.deepEqual(draftReducer(state, { type: "saved", id: 0, savedAt: null }), state);
    state = draftReducer(state, { type: "start", id: 2 }); state = draftReducer(state, { type: "failed", id: 2 }); assert.equal(state.text, "two"); assert.match(draftLabel(state), /^Save failed/);
    state = draftReducer(state, { type: "start", id: 3 }); state = draftReducer(state, { type: "saved", id: 3, savedAt: "2026-11-06T00:00:01.000Z" }); assert.match(draftLabel(state), /^Saved \(/);
    // A response from an OLDER request must be ignored while a newer save is in flight (success and failure alike).
    state = draftReducer(state, { type: "edit", text: "three" });
    state = draftReducer(state, { type: "start", id: 5 });
    assert.deepEqual(draftReducer(state, { type: "saved", id: 4, savedAt: "2026-11-06T00:00:00.500Z" }), state);
    assert.deepEqual(draftReducer(state, { type: "failed", id: 4 }), state);
    state = draftReducer(state, { type: "saved", id: 5, savedAt: "2026-11-06T00:00:02.000Z" }); assert.equal(state.savedText, "three");
    state = draftReducer(state, { type: "start", id: 4 }); state = draftReducer(state, { type: "failed", id: 4, conflict: true }); assert.equal(draftLabel(state), "Saved elsewhere");
    const server = { text: "server", savedAt: "version" };
    assert.deepEqual(resolveRestore(server, { text: "local", baseSavedAt: "version" }), { text: "local", offered: null });
    assert.deepEqual(resolveRestore(server, { text: "local", baseSavedAt: "older" }), { text: "server", offered: "local" });
    assert.deepEqual(resolveRestore(server, { text: "local", baseSavedAt: "version", consumed: true }), { text: "server", offered: null });
    console.log("PASS offline writing drafts: ownership, conflicts, transactions, exclusions, restore, state, no network");
  } finally { globalThis.fetch = original; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

