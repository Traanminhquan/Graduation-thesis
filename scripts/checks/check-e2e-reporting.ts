import assert from "node:assert/strict";
import { runE2E, EMAIL, SYNTHETIC, MOCK_API_KEY, MOCK_SUMMARY, MOCK_CORRECTIONS, MOCK_HALLUCINATED, MOCK_OVERALL, MOCK_SCORES, MOCK_SUGGESTIONS, MOCK_WEAKNESS, type E2EDeps, type StoredAssessment } from "../e2e-live/e2e-writing-ai-core";
import type { Usage } from "../../src/lib/ai/cost";
import { describeResponseShape, formatResponseShape, PINNED_FREE_MODEL } from "../../src/lib/ai/provider";
import { formatAssessmentDiagnosis, type AssessmentDiagnosis } from "../../src/lib/ai/diagnostics";
const canary = "CANARY secret learner <payload>\nBearer key";
const diagnosis: AssessmentDiagnosis = { category: "completion_truncated", finishReason: "length", servedModel: "vendor/model:free", promptTokens: 10, completionTokens: 1600, reasoningTokens: 1500, requestId: "request-123456", jsonParse: "skipped", schemaValidation: "skipped", persistence: "not_attempted" };
async function check(mode: "response" | "before" | "throw" | "cleanup" | "stop" | "preflight" | "guard" | "model") {
  const lines: string[] = []; let created = false; let submitted = false; let deleted = false; let transport = 0;
  const original = globalThis.fetch; const enabled = process.env.AI_ASSESSMENT_ENABLED;
  globalThis.fetch = async () => { transport++; return Response.json({ id: "request-123456", model: "vendor/model:free", choices: [{ finish_reason: "length", message: { content: canary } }], usage: { prompt_tokens: 10, completion_tokens: 1600, cost: 0 } }); };
  const baselineFetch = globalThis.fetch;
  const deps: E2EDeps = {
    env: { NODE_ENV: "test", AI_ASSESSMENT_ENABLED: "true", AI_PROVIDER: "openrouter", AI_MODEL: PINNED_FREE_MODEL, AI_FREE_TEST_MODE: "true", AI_MAX_ATTEMPTS: "1", AI_API_KEY: canary, DATABASE_URL: "postgresql://postgres.qeenabcdefghijklmnop:@local.pooler.supabase.com:5432/postgres" },
    args: mode === "preflight" ? [] : ["--confirm-e2e"], log: line => lines.push(line), hashPassword: async () => "mock-hash",
    ledger: { read: async () => [], spend: async () => 0, pending: async () => false, append: async () => { assert.fail("unexpected ledger append"); }, exclusive: async function (work) { return work(this); } }, readLedgerRaw: () => "",
    assess: async () => { assert.fail("unexpected assessment"); },
    submit: async () => {
      submitted = true;
      if (mode === "throw") throw Object.assign(new Error(canary), { code: canary });
      if (mode === "model") {
        // A request for any model other than the pinned one (e.g. the random router) must be blocked before it leaves the process.
        await assert.rejects(() => fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "openrouter/free" }) }));
        return { ok: true, submissionId: "submission-123", wordCount: 92, assessment: { ok: false, diagnosis } };
      }
      if (mode !== "before") {
        await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: PINNED_FREE_MODEL }) });
        if (mode === "guard") {
          await assert.rejects(() => fetch("https://openrouter.ai/api/v1/chat/completions", { body: JSON.stringify({ model: PINNED_FREE_MODEL }) }));
          await assert.rejects(() => fetch("http://openrouter.ai/api/v1/chat/completions"));
          await assert.rejects(() => fetch("https://example.com"));
        }
      }
      return { ok: true, submissionId: "submission-123", wordCount: 92, assessment: { ok: false, diagnosis: mode === "before" ? { ...diagnosis, category: "request_refused", finishReason: undefined, servedModel: undefined, promptTokens: undefined, completionTokens: undefined, reasoningTokens: undefined, requestId: undefined } : diagnosis } };
    },
    db: {
      migrations: async () => ["20261105012632_init"], counts: async () => ({ users: created && !deleted ? 1 : 0, submissions: submitted && !deleted ? 1 : 0, assessments: 0, weakness: 0 }),
      userByEmail: async () => created && !deleted ? { id: "user-123" } : null,
      userById: async () => deleted ? null : { email: EMAIL }, promptExists: async () => true,
      createUser: async () => { created = true; return { id: "user-123" }; },
      submissionWithAssessment: async () => { assert.fail("unexpected stored assessment read"); },
      weaknessForUser: async () => [], assessmentBySubmission: async () => null,
      submissionIdsForUser: async () => submitted ? ["submission-123"] : [],
      deleteUser: async id => { assert.equal(id, "user-123"); assert.ok(lines.some(line => line.startsWith("EVIDENCE assessment_result="))); if (mode === "cleanup") throw new Error(canary); deleted = true; },
      submissionExists: async () => !deleted, assessmentExists: async () => false, weaknessCount: async () => 0,
    },
    system: { isListening: async () => false, otherListeners: () => 0, buildExists: () => true, envStamp: () => "mock-stamp", startServer: () => assert.fail("unexpected server"), serverStarted: () => mode === "stop", serverExited: () => false, stopServer: async () => { throw new Error(canary); }, sleep: async () => { assert.fail("unexpected sleep"); } },
  };
  try {
    const result = await runE2E(deps);
    assert.equal(result.exitCode, 1); assert.equal(globalThis.fetch, baselineFetch);
    const report = lines.join("\n") + JSON.stringify(result);
    assert.ok(!report.includes(canary)); assert.ok(!report.includes("Bearer"));
    assert.ok(lines.some(line => line.startsWith("EVIDENCE provider_requests=")));
    if (mode === "preflight") { assert.equal(created, false); assert.equal(transport, 0); }
    else { assert.equal(deleted, mode !== "cleanup"); assert.ok(result.phases.some(p => p.id === "C10")); }
    if (["response", "cleanup", "stop", "guard"].includes(mode)) assert.ok(lines.some(line => line.includes(formatAssessmentDiagnosis(diagnosis))));
    if (mode === "before") assert.ok(lines.some(line => line.includes("category=request_refused")));
    if (mode === "guard") assert.equal(transport, 1);
    if (mode === "model") assert.equal(transport, 0);
    if (mode === "cleanup") assert.ok(lines.some(line => line.startsWith("LEFTOVER") && line.includes("user_id=user-123") && line.includes("submission_id=submission-123")));
    console.log(`PASS E2E ${mode}: sanitized evidence before cleanup, failure reported, fetch restored`);
  } finally { globalThis.fetch = original; if (enabled === undefined) delete process.env.AI_ASSESSMENT_ENABLED; else process.env.AI_ASSESSMENT_ENABLED = enabled; }
}
// Full success path with every dependency mocked: persistence, ledger, idempotence, result page, auth guard, escaping, cleanup.
// `mock: true` runs the core in mock-provider mode, which additionally asserts the exact canned values read back from "the database".
type Variant = { mock?: boolean; summaryTamper?: boolean; summaryMissing?: boolean; hallucinated?: boolean; tamper?: boolean; weakness?: { id: string; category: string; occurrenceCount: number }[]; key?: string; flag?: string; expectFailed?: string };
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;");
async function checkSuccess(variant: Variant = {}) {
  const mock = variant.mock === true;
  const label = (mock ? "mock mode" : "live mode") + (variant.expectFailed ? " must fail at " + variant.expectFailed + (variant.hallucinated ? " (hallucinated correction stored)" : variant.tamper ? " (stored correction text altered)" : variant.weakness ? " (wrong weakness counts)" : variant.key ? " (wrong dummy key)" : " (wrong confirm flag)") : "");
  const lines: string[] = []; const key = variant.key ?? (mock ? MOCK_API_KEY : "mock-or-key");
  const original = globalThis.fetch; const enabled = process.env.AI_ASSESSMENT_ENABLED;
  let providerCalls = 0; let loginCalls = 0; let pageCalls = 0; let assessCalls = 0; let releaseCalls = 0;
  let created = false; let submitted = false; let deleted = false; let started = false; let stopped = false; const sleeps: number[] = [];
  const ledger: Usage[] = [];
  const corrections = mock ? [...MOCK_CORRECTIONS, ...(variant.hallucinated ? [MOCK_HALLUCINATED] : [])].map((c, i) => variant.tamper && i === 0 ? { ...c, corrected: c.corrected + " (altered)" } : c) : [{ original: "I has a fever", corrected: "I had a fever", errorType: "verb_tense", explanation: "Use the past tense." }];
  const suggestions = mock ? MOCK_SUGGESTIONS : ["Add one more detail about the follow-up plan."];
  const scores = mock ? MOCK_SCORES : { grammarScore: 71, vocabularyScore: 82, coherenceScore: 93, taskAchievementScore: 64 };
  const stored: StoredAssessment = { id: "assessment-123", ...scores, summary: mock ? (variant.summaryTamper ? "Altered summary" : MOCK_SUMMARY) : "SUMMARY_CANARY <payload> & learner feedback", overallScore: mock ? MOCK_OVERALL : 77.5, model: PINNED_FREE_MODEL, corrections, suggestions, assessedAt: new Date("2026-11-06T00:00:00Z") };
  const weakness = variant.weakness ?? (mock ? Object.entries(MOCK_WEAKNESS).map(([category, occurrenceCount], i) => ({ id: "weak-" + (i + 1), category, occurrenceCount })) : [{ id: "weak-1", category: "verb_tense", occurrenceCount: 1 }]);
  const page = "<html><body><h2>AI assessment</h2><ul><li>Grammar " + scores.grammarScore + "</li><li>Vocabulary " + scores.vocabularyScore + "</li><li>Coherence " + scores.coherenceScore + "</li><li>Task response " + scores.taskAchievementScore + "</li></ul>"
    + "<p>" + esc(variant.summaryMissing ? "" : stored.summary!) + "</p>" + "<h3>Corrections</h3>" + corrections.map(c => "<p>" + esc(c.original) + " → " + esc(c.corrected) + "</p>").join("") + "<h3>Suggestions</h3>" + suggestions.map(s => "<p>" + esc(s) + "</p>").join("")
    + "<blockquote>I will read &lt;b&gt;every page&lt;/b&gt; of them.</blockquote></body></html>";
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin === "https://openrouter.ai") {
      providerCalls++;
      return Response.json({ id: "gen-mock-12345", model: PINNED_FREE_MODEL, choices: [{ finish_reason: "stop", message: { content: "{}" } }], usage: { prompt_tokens: 306, completion_tokens: 420, cost: 0 } }, { headers: { "x-request-id": "req-mock-12345" } });
    }
    if (url.pathname === "/api/auth/login") { loginCalls++; return new Response("{}", { status: 200, headers: { "set-cookie": "el_session=mock-session; Path=/; HttpOnly" } }); }
    if (url.pathname.startsWith("/writing/")) {
      pageCalls++;
      const cookie = new Headers(init?.headers).get("cookie") ?? "";
      return cookie.includes("el_session=mock-session") ? new Response(page, { status: 200 }) : new Response(null, { status: 307, headers: { location: "/login" } });
    }
    throw new Error("unexpected mocked url");
  };
  const baselineFetch = globalThis.fetch;
  const deps: E2EDeps = {
    mode: mock ? "mock" : undefined,
    env: { NODE_ENV: "test", AI_ASSESSMENT_ENABLED: "true", AI_PROVIDER: "openrouter", AI_MODEL: PINNED_FREE_MODEL, AI_FREE_TEST_MODE: "true", AI_MAX_ATTEMPTS: "1", AI_TIMEOUT_MS: "60000", AI_API_KEY: key, AUTH_SECRET: "mock-auth", DATABASE_URL: "postgresql://postgres.qeenabcdefghijklmnop:@local.pooler.supabase.com:5432/postgres" } as NodeJS.ProcessEnv,
    args: [variant.flag ?? (mock ? "--confirm-mock-e2e" : "--confirm-e2e")], log: line => lines.push(line), hashPassword: async () => "mock-hash",
    ledger: { read: async () => [...ledger], spend: async since => ledger.filter(r => !since || new Date(r.ts) >= since).reduce((sum, r) => sum + r.costUsd, 0), pending: async () => false, append: async row => { ledger.push(row); }, exclusive: async function (work) { return work(this); } },
    readLedgerRaw: () => ledger.map(row => JSON.stringify(row)).join("\n"),
    assess: async () => { assessCalls++; return { ok: true }; },
    submit: async () => {
      submitted = true;
      await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: PINNED_FREE_MODEL, messages: [], max_tokens: 1600 }) });
      const base = { ts: "2026-11-06T00:00:00.000Z", submissionId: "submission-123", model: PINNED_FREE_MODEL };
      ledger.push({ ...base, promptTokens: 0, completionTokens: 0, costUsd: 0, status: "reserved" }, { ...base, promptTokens: 306, completionTokens: 420, costUsd: 0, status: "reconciled" });
      return { ok: true, submissionId: "submission-123", wordCount: 92, assessment: { ok: true } };
    },
    db: {
      migrations: async () => ["20261105012632_init"],
      counts: async () => ({ users: 19 + (created && !deleted ? 1 : 0), submissions: 1 + (submitted && !deleted ? 1 : 0), assessments: submitted && !deleted ? 1 : 0, weakness: submitted && !deleted ? weakness.length : 0 }),
      userByEmail: async () => created && !deleted ? { id: "user-123" } : null,
      userById: async () => deleted ? null : { email: EMAIL }, promptExists: async () => true,
      createUser: async () => { created = true; return { id: "user-123" }; },
      submissionWithAssessment: async () => ({ status: "ASSESSED", finalText: SYNTHETIC.trim(), assessment: stored }),
      weaknessForUser: async () => weakness,
      assessmentBySubmission: async () => ({ id: stored.id, assessedAt: stored.assessedAt }),
      submissionIdsForUser: async () => submitted ? ["submission-123"] : [],
      deleteUser: async id => { assert.equal(id, "user-123"); deleted = true; },
      submissionExists: async () => !deleted, assessmentExists: async () => !deleted, weaknessCount: async () => deleted ? 0 : weakness.length,
    },
    system: {
      isListening: async () => started && !stopped, otherListeners: () => 0, buildExists: () => true, envStamp: () => "mock-stamp",
      releaseDatabase: async () => { assert.equal(started, false, "database must be released BEFORE the server starts"); releaseCalls++; },
      startServer: () => { started = true; }, serverStarted: () => started, serverExited: () => false,
      stopServer: async () => { stopped = true; return true; }, sleep: async ms => { sleeps.push(ms); },
    },
  };
  try {
    const result = await runE2E(deps);
    const failedPhases = result.phases.filter(p => !p.ok).map(p => p.id);
    const report = lines.join("\n") + JSON.stringify(result);
    assert.ok(!report.includes(MOCK_SUMMARY) && !report.includes("SUMMARY_CANARY") && !report.includes(canary));
    assert.ok(!report.includes(key) && !report.includes("mock-auth") && !report.includes("mock-session") && !/Bearer/.test(report));
    assert.equal(globalThis.fetch, baselineFetch);
    if (variant.expectFailed) {
      assert.ok(failedPhases.includes(variant.expectFailed), "expected failed phase " + variant.expectFailed + ", got " + failedPhases.join(","));
      assert.equal(result.exitCode, 1);
      if (variant.expectFailed === "B") { assert.equal(created, false); assert.equal(providerCalls, 0); assert.equal(submitted, false); }
      else { assert.equal(deleted, true); assert.equal(started, variant.expectFailed === "C6"); }
      console.log("PASS E2E " + label);
      return;
    }
    assert.deepEqual(failedPhases, []); assert.equal(result.exitCode, 0);
    for (const id of ["B", "C1", "C2", "C3", "C3d", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"]) assert.ok(result.phases.some(p => p.id === id && p.ok), "missing passing phase " + id);
    assert.equal(providerCalls, 1); assert.equal(assessCalls, 1); assert.equal(loginCalls, 1); assert.equal(pageCalls, 2);
    assert.equal(releaseCalls, 1); assert.ok(sleeps.includes(4000), "pooler grace sleep after stopping the server");
    assert.equal(ledger.length, 2); assert.equal(deleted, true); assert.equal(stopped, true);
    assert.ok(lines.some(line => line.startsWith("SUMMARY ALL PASS") && line.includes("mode=" + (mock ? "mock" : "live"))));
    console.log("PASS E2E success path (" + label + ", mocked deps): persistence, ledger, idempotence, result page, auth guard, escaping, DB released before server start, cleanup, one provider request");
  } finally { globalThis.fetch = original; if (enabled === undefined) delete process.env.AI_ASSESSMENT_ENABLED; else process.env.AI_ASSESSMENT_ENABLED = enabled; }
}
async function main() {
  await checkSuccess({ mock: true, summaryTamper: true, expectFailed: "C4" });
  await checkSuccess({ mock: true, summaryMissing: true, expectFailed: "C6" });
  const shape = describeResponseShape({ id: canary, model: canary, choices: [{ finish_reason: canary, message: { content: canary } }], error: { message: canary }, usage: { secret: canary } }, 200);
  assert.equal(shape.contentLength, canary.length); assert.equal(shape.choiceCount, 1); assert.equal(shape.finishReason, undefined);
  assert.ok(!JSON.stringify(shape).includes(canary)); assert.ok(!formatResponseShape(shape).includes(canary));
  assert.equal(describeResponseShape(null, 400).bodyType, "null");
  assert.equal(describeResponseShape([], 200).bodyType, "array");
  assert.equal(describeResponseShape({ choices: [{ finish_reason: "length" }] }, 200).finishReason, "length");
  const poisoned = { ...diagnosis, finishReason: canary, servedModel: canary, requestId: canary, detail: canary, providerCategory: canary };
  assert.ok(!formatAssessmentDiagnosis(poisoned).includes(canary));
  console.log("PASS shape helpers and diagnosis canaries: structure only, fixed finish vocabulary");
  for (const mode of ["preflight", "response", "before", "throw", "cleanup", "stop", "guard", "model"] as const) await check(mode);
  await checkSuccess();
  await checkSuccess({ mock: true });
  await checkSuccess({ mock: true, hallucinated: true, expectFailed: "C4" });
  await checkSuccess({ mock: true, weakness: [{ id: "weak-1", category: "verb_tense", occurrenceCount: 1 }, { id: "weak-2", category: "word_choice", occurrenceCount: 1 }], expectFailed: "C4" });
  await checkSuccess({ mock: true, tamper: true, expectFailed: "C4" });
  await checkSuccess({ mock: true, key: "not-the-mock", expectFailed: "B" });
  await checkSuccess({ mock: true, flag: "--confirm-e2e", expectFailed: "B" });
  await checkSuccess({ flag: "--confirm-mock-e2e", expectFailed: "B" });
}
main().catch(() => { console.error("FAIL mocked E2E reporting assertion"); process.exitCode = 1; });
