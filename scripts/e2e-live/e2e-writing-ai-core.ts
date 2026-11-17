/**
 * Core of the Writing AI end-to-end test (OpenRouter FREE only, synthetic data only).
 *
 * All side effects (database, process control, ledger, submission flow) are injected through
 * `E2EDeps`, so the exact same orchestration (including failure reporting and cleanup) is
 * exercised offline by scripts/checks/check-e2e-reporting.ts with mocks. The real wiring lives in
 * scripts/e2e-live/e2e-writing-ai-real.ts, used by the live runner (scripts/e2e-live/e2e-writing-ai.ts) and by the
 * mock-provider runner (scripts/e2e-live/e2e-writing-ai-mock.ts, mode "mock": only the provider response is canned;
 * Prisma, the submit/assess flow, the production server and the result page are all real).
 *
 * Guarantees: at most ONE provider request (a fetch guard blocks any second one and any
 * non-OpenRouter host), only records created by this run are deleted, and nothing printed
 * contains keys, headers, raw provider JSON, model output or learner text.
 */
import { randomBytes } from "node:crypto";
import path from "node:path";
import { formatAssessmentDiagnosis } from "../../src/lib/ai/diagnostics";
import type { Ledger, Usage } from "../../src/lib/ai/cost";
import { categoryForStatus, describeResponseShape, formatResponseShape, FREE_MODEL_ALLOWLIST, PINNED_FREE_MODEL, type ResponseShape } from "../../src/lib/ai/provider";
import { assessWritingForUser, type AssessmentDeps } from "../../src/lib/writing/assess";

export const EMAIL = "e2e-writing-ai@example.com";
export const PROMPT_ID = "seed-writing-1";
export const PORT = 3100;
const EXPECTED_REF_PREFIX = "qeen";
const EXPECTED_REF_LENGTH = 20;
const EXPECTED_MIGRATIONS = ["20261105012632_init"];
// Invented text, 92 words, one literal <b> token to prove HTML escaping, one deliberate grammar slip.
export const SYNTHETIC =
  "Dear Ms. Carter, I am writing because I could not attend yesterday's team meeting. I has a fever, so my doctor told me to stay home and rest. I am sorry that I did not warn you earlier. I have asked Tom for the meeting notes, and I will read <b>every page</b> tonight. I can also finish the tasks that were given to me before Friday. Please tell me if there is anything else I should prepare. Thank you for understanding, and I hope the project is going well. Best regards, Alex";

// ---- Mock mode: the ONLY canned thing is the provider's answer (see scripts/e2e-live/e2e-writing-ai-mock.ts) ----
export const MOCK_API_KEY = "mock-key";
export const MOCK_SCORES = { grammarScore: 72, vocabularyScore: 81, coherenceScore: 90, taskAchievementScore: 65 };
export const MOCK_OVERALL = (72 + 81 + 90 + 65) / 4; // 77: computed by the server, never trusted from the model
// Every `original` occurs literally in SYNTHETIC; two share an error type to prove the weakness counter increments.
export const MOCK_CORRECTIONS = [
  { original: "I has a fever", corrected: "I had a fever", errorType: "verb_tense", explanation: "Use the past tense for an illness that already happened." },
  { original: "I did not warn you earlier", corrected: "I had not warned you earlier", errorType: "verb_tense", explanation: "Use the past perfect for the earlier action." },
  { original: "the meeting notes", corrected: "the notes from the meeting", errorType: "word_choice", explanation: "A clearer and more natural phrasing." },
];
// Not in SYNTHETIC: the real validator must drop it, so it must never be stored or counted as a weakness.
export const MOCK_HALLUCINATED = { original: "She go to school every day", corrected: "She goes to school every day", errorType: "subject_verb_agreement", explanation: "Third person singular takes -s." };
export const MOCK_SUGGESTIONS = ["Say when you will send the finished tasks.", "Use a formal closing such as Kind regards & check tenses."];
export const MOCK_WEAKNESS: Record<string, number> = { verb_tense: 2, word_choice: 1 };
export const MOCK_SUMMARY = "Clear & polite <b>message</b> with a few tense and wording slips.";
export const MOCK_PROVIDER_CONTENT = JSON.stringify({ ...MOCK_SCORES, corrections: [...MOCK_CORRECTIONS, MOCK_HALLUCINATED], suggestions: MOCK_SUGGESTIONS, summary: `  ${MOCK_SUMMARY}  ` });

export type AssessResult = Awaited<ReturnType<typeof assessWritingForUser>>;
export type StoredAssessment = {
  id: string; grammarScore: number; vocabularyScore: number; coherenceScore: number; taskAchievementScore: number;
  summary: string | null;
  overallScore: number | null; model: string | null; corrections: unknown; suggestions: unknown; assessedAt: Date;
};
export interface E2EDb {
  migrations(): Promise<string[]>;
  counts(): Promise<{ users: number; submissions: number; assessments: number; weakness: number }>;
  userByEmail(email: string): Promise<{ id: string } | null>;
  userById(id: string): Promise<{ email: string } | null>;
  promptExists(id: string): Promise<boolean>;
  createUser(data: { email: string; passwordHash: string; name: string }): Promise<{ id: string }>;
  submissionWithAssessment(id: string): Promise<{ status: string; finalText: string | null; assessment: StoredAssessment | null } | null>;
  weaknessForUser(userId: string): Promise<{ id: string; category: string; occurrenceCount: number }[]>;
  assessmentBySubmission(submissionId: string): Promise<{ id: string; assessedAt: Date } | null>;
  submissionIdsForUser(userId: string): Promise<string[]>;
  deleteUser(id: string): Promise<void>;
  submissionExists(id: string): Promise<boolean>;
  assessmentExists(id: string): Promise<boolean>;
  weaknessCount(ids: string[]): Promise<number>;
}
export interface E2ESystem {
  isListening(port: number): Promise<boolean>;
  otherListeners(): number;
  buildExists(): boolean;
  envStamp(): string;
  startServer(env: NodeJS.ProcessEnv): void;
  serverStarted(): boolean;
  serverExited(): boolean;
  stopServer(): Promise<boolean>;
  sleep(ms: number): Promise<void>;
  /** Close this process's database connection before the test-owned server starts (the pooler allows one client). */
  releaseDatabase?(): Promise<void>;
}
export interface E2EDeps {
  /** "live" (default): real provider request. "mock": the provider answer is canned by the runner; asserts the exact canned values. */
  mode?: "live" | "mock";
  db: E2EDb;
  env: NodeJS.ProcessEnv;
  args: string[];
  log: (line: string) => void;
  hashPassword(plaintext: string): Promise<string>;
  submit(input: { userId: string; promptId: string; text: string }): Promise<{ ok: true; submissionId: string; wordCount: number; assessment?: AssessResult } | { ok: false; message: string }>;
  assess(submissionId: string, userId: string): Promise<AssessResult>;
  ledger: Ledger;
  readLedgerRaw(): string;
  system: E2ESystem;
}
export type E2EResult = { phases: { id: string; name: string; ok: boolean }[]; exitCode: number };

class E2EFailure extends Error {}
function need(condition: unknown, message: string): asserts condition { if (!condition) throw new E2EFailure(message); }
const describe = (error: unknown) => {
  if (error instanceof E2EFailure) return error.message;
  return "unexpected error";
};
const safeId = (value: unknown) => (typeof value === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(value) ? value : undefined);
const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
const visible = (html: string) => decode(html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

type Seen = { status?: number; model?: string; promptTokens?: number; completionTokens?: number; costUsd?: number; requestId?: string; shape?: ResponseShape };

export async function runE2E(deps: E2EDeps): Promise<E2EResult> {
  const { db, env, args, log, system } = deps;
  const mode = deps.mode ?? "live";
  const realFetch = globalThis.fetch;
  const phases: { id: string; name: string; ok: boolean }[] = [];
  const record = (id: string, name: string, ok: boolean, detail = "") => {
    phases.push({ id, name, ok });
    log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? " - " + detail : ""}`);
    return ok;
  };
  async function step(id: string, name: string, work: () => Promise<string | void>) {
    try { return record(id, name, true, (await work()) ?? ""); } catch (error) { record(id, name, false, describe(error)); return false; }
  }

  const requests: Seen[] = [];
  function installFetchGuard() {
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.origin !== "https://openrouter.ai" || url.pathname !== "/api/v1/chat/completions" || url.search || url.username || url.password) throw new Error("E2E blocked non-OpenRouter request");
      if (requests.length >= 1) throw new Error("E2E blocked second provider request");
      const seen: Seen = {}; requests.push(seen);
      const body = JSON.parse(String(init?.body));
      for (const forbidden of ["models", "route", "fallback", "fallbacks", "provider"]) if (forbidden in body) throw new Error("E2E blocked fallback/routing field");
      if (body.model !== PINNED_FREE_MODEL || body.model !== env.AI_MODEL) throw new Error("E2E blocked non-pinned model");
      const response = await realFetch(input, init);
      seen.status = response.status; seen.requestId = safeId(response.headers.get("x-request-id"));
      // Diagnostic collection happens here, at the transport layer, so it survives any later parse/validation failure.
      let parsed: unknown;
      try { parsed = await response.clone().json(); } catch { parsed = undefined; }
      seen.shape = describeResponseShape(parsed, response.status);
      const p = (parsed !== null && typeof parsed === "object" ? parsed : {}) as { id?: unknown; model?: unknown; usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: unknown } };
      seen.model = typeof p.model === "string" ? p.model : undefined;
      seen.promptTokens = p.usage?.prompt_tokens; seen.completionTokens = p.usage?.completion_tokens;
      seen.costUsd = typeof p.usage?.cost === "number" ? p.usage.cost : undefined;
      seen.requestId = seen.requestId ?? safeId(p.id);
      return response;
    };
  }

  const state: { userId?: string; submissionId?: string; assessmentId?: string; weaknessIds: string[]; assessment?: AssessResult } = { weaknessIds: [] };
  let snapshot = { users: 0, submissions: 0, assessments: 0, weakness: 0 };
  let ledgerBefore: Usage[] = [];
  const created = { user: 0, submission: 0, assessment: 0, weakness: 0 };
  let deleted = false;
  let envStampBefore = "";
  let corrections: { original: string; corrected: string; errorType: string; explanation: string }[] = [];
  let suggestions: string[] = [];
  let scores = { grammar: 0, vocabulary: 0, coherence: 0, taskAchievement: 0 };
  let abort = false;

  const printEvidence = () => {
    const seen = requests[0];
    log(`EVIDENCE provider_requests=${requests.length}`);
    if (seen) log(`EVIDENCE provider_response http_status=${seen.status ?? "none"}${seen.requestId ? ` request_id=${seen.requestId}` : ""} shape=${seen.shape ? formatResponseShape(seen.shape) : "unavailable"}`);
    const a = state.assessment;
    log(a === undefined ? "EVIDENCE assessment_result=not_returned" : a.ok ? "EVIDENCE assessment_result=ok" : `EVIDENCE assessment_result=failed ${a.diagnosis ? formatAssessmentDiagnosis(a.diagnosis) : "diagnosis=missing"}`);
  };

  const preflightOk = await step("B", "Preflight (read-only)", async () => {
    const confirmFlag = mode === "mock" ? "--confirm-mock-e2e" : "--confirm-e2e";
    need(args.includes(confirmFlag), `${confirmFlag} flag missing`);
    // Mock mode must run with the dummy credential only, so a real key can never reach any request.
    if (mode === "mock") need(env.AI_API_KEY === MOCK_API_KEY, "mock mode requires the dummy provider key");
    need(env.AI_PROVIDER === "openrouter", "AI_PROVIDER must be openrouter");
    need(env.AI_MODEL === PINNED_FREE_MODEL && FREE_MODEL_ALLOWLIST.includes(env.AI_MODEL), "AI_MODEL must be the pinned free model");
    need(env.AI_FREE_TEST_MODE === "true", "AI_FREE_TEST_MODE must be true");
    need(env.AI_MAX_ATTEMPTS === "1", "AI_MAX_ATTEMPTS must be 1 (zero retries)");
    need(env.AI_ASSESSMENT_ENABLED === "true", "AI_ASSESSMENT_ENABLED must be true in this process");
    need(Boolean(env.AI_API_KEY?.trim()), "AI_API_KEY missing");
    const budget = Number(env.AI_PILOT_BUDGET_USD ?? "2");
    need(Number.isFinite(budget) && budget > 0 && budget <= 2, "AI_PILOT_BUDGET_USD must be a number in (0, 2]");
    envStampBefore = system.envStamp();

    const match = (env.DATABASE_URL ?? "").match(/^postgres(?:ql)?:\/\/([^:]+):[^@]*@([^:/]+):(\d+)\/(\w+)/);
    need(match, "DATABASE_URL not parseable");
    const ref = match[1].includes(".") ? match[1].split(".")[1] : "";
    need(ref.startsWith(EXPECTED_REF_PREFIX) && ref.length === EXPECTED_REF_LENGTH && match[2].endsWith(".pooler.supabase.com") && match[4] === "postgres", "database identity does not match the approved Supabase project");
    const migrations = await db.migrations();
    need(JSON.stringify(migrations) === JSON.stringify(EXPECTED_MIGRATIONS), "applied migrations differ from the approved set");
    snapshot = await db.counts();
    need(snapshot.users < 100, "unexpectedly many users; refusing (is this the right database?)");
    need((await db.userByEmail(EMAIL)) === null, "synthetic user already exists");
    need(await db.promptExists(PROMPT_ID), "prompt seed-writing-1 missing");
    need(!(await system.isListening(PORT)), `port ${PORT} already in use`);
    need(system.buildExists(), "no production build; run npm run build first");
    const words = SYNTHETIC.trim().split(/\s+/).length;
    need(words >= 60 && words <= 100 && SYNTHETIC.includes("<b>every page</b>"), "synthetic text outside the prompt word range");
    ledgerBefore = await deps.ledger.read();
    const spend = ledgerBefore.reduce((sum, row) => sum + row.costUsd, 0);
    need(spend < budget, "pilot budget already exhausted");
    // Disabled-path guard on the real module: must return before touching DB, ledger or provider.
    const touched: string[] = [];
    const trap = new Proxy({}, { get: (_target, property) => { touched.push(String(property)); throw new Error("touched"); } });
    const disabled = await assessWritingForUser("x", "y", { db: trap, provider: async () => { touched.push("provider"); throw new Error("touched"); }, ledger: trap, env: { NODE_ENV: "test", AI_ASSESSMENT_ENABLED: "false" }, now: () => new Date() } as unknown as AssessmentDeps);
    need(disabled.ok === false && /disabled/.test(disabled.message ?? "") && touched.length === 0, "disabled path touched something");
    return `db ref ${EXPECTED_REF_PREFIX}...(${EXPECTED_REF_LENGTH}) *.pooler.supabase.com/postgres, migrations ok, counts ${JSON.stringify(snapshot)}, ledger rows ${ledgerBefore.length} spend $${spend}, max attempts 1, budget cap $${budget}, port ${PORT} free, other listeners on :3000 (left untouched): ${system.otherListeners()}`;
  });
  if (!preflightOk) { printEvidence(); log("STOP: preflight failed; no database write and no provider request were made."); return { phases, exitCode: 1 }; }

  installFetchGuard();
  const password = randomBytes(18).toString("base64url");
  try {
    abort = !(await step("C1", "Create synthetic user", async () => {
      const user = await db.createUser({ email: EMAIL, passwordHash: await deps.hashPassword(password), name: "E2E Writing AI (synthetic)" });
      state.userId = user.id; created.user = 1;
    }));

    if (!abort) abort = !(await step("C2", "Submit via existing flow (single provider request, zero retries)", async () => {
      const result = await deps.submit({ userId: state.userId!, promptId: PROMPT_ID, text: SYNTHETIC });
      if (!result.ok) throw new E2EFailure("submission rejected by validation");
      // Captured immediately, before any assertion that can abort the run.
      state.submissionId = result.submissionId; created.submission = 1;
      state.assessment = result.assessment;
      need(requests.length === 1, `expected exactly 1 provider request, saw ${requests.length}`);
      const seen = requests[0];
      if (seen.status !== 200) throw new E2EFailure(`provider request failed: category=${seen.status ? categoryForStatus(seen.status) : "no_response"} http_status=${seen.status ?? "none"}${seen.requestId ? ` request_id=${seen.requestId}` : ""}`);
      return `requests=${requests.length}`;
    }));

    if (!abort) {
      // Diagnostics first, provider-response assertions second; neither can hide the other.
      const diagnosisOk = await step("C3d", "Assessment result diagnosis (taken from the actual assessment result)", async () => {
        const a = state.assessment;
        need(a !== undefined, "submission flow did not return the assessment result");
        if (a.ok) { need(a.diagnosis === undefined, "a successful assessment carried a failure diagnosis"); return "assessment ok; no failure diagnosis"; }
        need(a.diagnosis !== undefined, "assessment failed without a diagnosis");
        throw new E2EFailure(formatAssessmentDiagnosis(a.diagnosis));
      });
      const providerOk = await step("C3", "Provider response, token usage and reported cost", async () => {
        const seen = requests[0];
        need(seen.model && (FREE_MODEL_ALLOWLIST.includes(seen.model) || seen.model.endsWith(":free")), "served model is not verified free (see EVIDENCE for the sanitized shape)");
        need(Number.isSafeInteger(seen.promptTokens) && Number.isSafeInteger(seen.completionTokens), "token usage missing or invalid (see EVIDENCE)");
        need((seen.costUsd ?? 0) === 0, "provider reported a non-zero cost");
        return `served_model=${/^[A-Za-z0-9._:/@+-]{1,100}$/.test(seen.model!) ? seen.model : "unprintable"} prompt_tokens=${seen.promptTokens} completion_tokens=${seen.completionTokens} provider_cost_usd=${seen.costUsd ?? "not reported"}${seen.requestId ? ` request_id=${seen.requestId}` : ""}`;
      });
      abort = !(diagnosisOk && providerOk);
    }

    if (!abort) abort = !(await step("C4", "Stored assessment, scores, corrections, ledger", async () => {
      const submission = await db.submissionWithAssessment(state.submissionId!);
      need(submission && submission.status === "ASSESSED" && submission.finalText === SYNTHETIC.trim(), "submission not ASSESSED with the expected text");
      const a = submission.assessment; need(a, "no WritingAssessment row");
      state.assessmentId = a.id; created.assessment = 1;
      const four = [a.grammarScore, a.vocabularyScore, a.coherenceScore, a.taskAchievementScore];
      need(four.every(n => Number.isFinite(n) && n >= 0 && n <= 100), "a score is outside 0-100");
      need(a.overallScore !== null && Math.abs(a.overallScore - four.reduce((x, y) => x + y, 0) / 4) < 1e-9, "overallScore is not the mean of the four scores");
      need(a.model === PINNED_FREE_MODEL, "assessment.model not recorded");
      need(Array.isArray(a.corrections) && Array.isArray(a.suggestions), "corrections/suggestions are not arrays");
      corrections = a.corrections as typeof corrections; suggestions = a.suggestions as string[];
      need(corrections.every(c => c && Object.keys(c).sort().join() === "corrected,errorType,explanation,original" && Object.values(c).every(v => typeof v === "string") && SYNTHETIC.includes(c.original)), "a correction is malformed or its original is not in the text");
      need(suggestions.length <= 5 && suggestions.every(s => typeof s === "string" && s.trim()), "suggestions malformed");
      scores = { grammar: a.grammarScore, vocabulary: a.vocabularyScore, coherence: a.coherenceScore, taskAchievement: a.taskAchievementScore };
      const weakness = await db.weaknessForUser(state.userId!);
      state.weaknessIds = weakness.map(w => w.id); created.weakness = weakness.length;
      const expected = new Map<string, number>(); for (const c of corrections) expected.set(c.errorType, (expected.get(c.errorType) ?? 0) + 1);
      need(weakness.length === expected.size && weakness.every(w => expected.get(w.category) === w.occurrenceCount), "WeaknessRecord rows do not match the corrections");
      if (mode === "mock") {
        // Exact values: what the DB returns must equal what the canned provider said (minus the dropped hallucinated correction).
        const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0)) : item);
        need(a.grammarScore === MOCK_SCORES.grammarScore && a.vocabularyScore === MOCK_SCORES.vocabularyScore && a.coherenceScore === MOCK_SCORES.coherenceScore && a.taskAchievementScore === MOCK_SCORES.taskAchievementScore, "stored rubric scores differ from the canned scores");
        need(a.summary === MOCK_SUMMARY, "stored summary differs from the canned one");
        need(a.overallScore === MOCK_OVERALL, "stored overallScore is not the server-computed mean");
        need(canonical(a.corrections) === canonical(MOCK_CORRECTIONS), "stored corrections differ from the canned ones (or the hallucinated correction was stored)");
        need(canonical(a.suggestions) === canonical(MOCK_SUGGESTIONS), "stored suggestions differ from the canned ones");
        need(weakness.length === Object.keys(MOCK_WEAKNESS).length && weakness.every(w => MOCK_WEAKNESS[w.category] === w.occurrenceCount), "weakness rows differ from the expected error types and counts");
      }
      const ledgerAfter = await deps.ledger.read(); const added = ledgerAfter.slice(ledgerBefore.length);
      need(added.length === 2 && added[0].status === "reserved" && added[1].status === "reconciled", "ledger did not gain exactly a reserved and a reconciled row");
      need(added.every(row => Object.keys(row).sort().join() === ["ts", "submissionId", "model", "promptTokens", "completionTokens", "costUsd", "status"].sort().join()), "ledger row has unapproved fields");
      need(added[1].promptTokens === requests[0].promptTokens && added[1].completionTokens === requests[0].completionTokens && Math.abs(added.reduce((s, r) => s + r.costUsd, 0)) < 1e-12, "ledger tokens/cost do not match the provider response");
      const rawLedger = deps.readLedgerRaw();
      need(!rawLedger.includes("every page") && !rawLedger.includes(env.AI_API_KEY!), "ledger contains learner text or the key");
      return `scores g=${scores.grammar} v=${scores.vocabulary} c=${scores.coherence} t=${scores.taskAchievement} overall=${a.overallScore}, corrections=${corrections.length}, suggestions=${suggestions.length}, weakness rows=${weakness.length}, ledger +2 rows (reserved, reconciled)`;
    }));

    if (!abort) abort = !(await step("C5", "Idempotence (no second provider request)", async () => {
      const before = await db.assessmentBySubmission(state.submissionId!);
      const rowsBefore = (await deps.ledger.read()).length;
      const again = await deps.assess(state.submissionId!, state.userId!);
      const after = await db.assessmentBySubmission(state.submissionId!);
      need(again.ok && requests.length === 1, "second call made a provider request or failed");
      need((await deps.ledger.read()).length === rowsBefore, "ledger grew on the second call");
      need(before && after && before.id === after.id && before.assessedAt.getTime() === after.assessedAt.getTime(), "assessment row changed");
    }));

    if (!abort) {
      const serverEnv = { ...env, AI_ASSESSMENT_ENABLED: "false", AI_FREE_TEST_MODE: "false", PORT: String(PORT), NODE_ENV: "production" } as NodeJS.ProcessEnv;
      delete serverEnv.AI_API_KEY;
      await system.releaseDatabase?.();
      system.startServer(serverEnv);
      let page = ""; let loginOk = false; let guardOk = false;
      abort = !(await step("C6", "Result page renders (authenticated)", async () => {
        let ready = false;
        for (let i = 0; i < 90 && !ready; i++) { if (system.serverExited()) throw new E2EFailure("test-owned server exited early"); ready = await system.isListening(PORT); if (!ready) await system.sleep(1000); }
        need(ready, "test-owned server did not start in time");
        const login = await realFetch(`http://127.0.0.1:${PORT}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: EMAIL, password }) });
        need(login.status === 200, `synthetic login failed (http ${login.status})`);
        const headers = login.headers as Headers & { getSetCookie?: () => string[] };
        const cookie = (headers.getSetCookie?.() ?? [login.headers.get("set-cookie") ?? ""]).map(c => c.split(";")[0]).find(c => c.startsWith("el_session="));
        need(cookie, "no session cookie issued"); loginOk = true;
        const url = `http://127.0.0.1:${PORT}/writing/${PROMPT_ID}/result/${state.submissionId}`;
        const response = await realFetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
        need(response.status === 200, `result page http ${response.status}`);
        page = await response.text();
        const text = visible(page);
        if (mode === "mock") need(page.includes(MOCK_SUMMARY.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")) && !page.includes(MOCK_SUMMARY), "stored summary is missing or not HTML-escaped");
        need(text.includes("AI assessment") && !text.includes("AI feedback unavailable"), "AI assessment section missing or shows unavailable");
        for (const label of ["Grammar", "Vocabulary", "Coherence", "Task response", "Corrections", "Suggestions"]) need(text.includes(label), `label missing: ${label}`);
        for (const score of Object.values(scores)) need(text.includes(String(score)), "a stored score is not rendered");
        for (const suggestion of suggestions) need(text.includes(suggestion.trim().replace(/\s+/g, " ")), "a suggestion is not rendered");
        const anon = await realFetch(url, { redirect: "manual" });
        need([302, 303, 307, 308].includes(anon.status) && (anon.headers.get("location") ?? "").includes("/login"), `unauthenticated request not redirected to /login (http ${anon.status})`);
        guardOk = true;
        return `http 200, AI section and ${Object.keys(scores).length} scores rendered`;
      }));
      record("C7", "Authentication guard (unauthenticated -> /login)", guardOk && loginOk, guardOk ? "" : "not verified");
      if (!abort) {
        await step("C8", "Corrections render as original -> corrected (zero corrections is valid)", async () => {
          const text = visible(page);
          for (const c of corrections) need(text.includes(`${c.original} → ${c.corrected}`.replace(/\s+/g, " ")), "a correction is not rendered as original → corrected");
          return corrections.length === 0 ? "zero corrections returned (valid)" : `${corrections.length} correction(s) rendered with the arrow`;
        });
        await step("C9", "Escaped learner text and no exposed secrets", async () => {
          need(!page.includes("<b>every page</b>"), "learner HTML was rendered unescaped");
          need(page.includes("&lt;b&gt;every page&lt;/b&gt;"), "escaped learner text not found on the page");
          for (const secret of [env.AI_API_KEY, env.AUTH_SECRET, password, env.DATABASE_URL]) if (secret) need(!page.includes(secret), "a secret value appears in the HTML");
          need(!/Bearer\s|Authorization/i.test(page), "authorization material appears in the HTML");
        });
      }
    }
  } catch (error) {
    record("Cerror", "Orchestration", false, describe(error));
  } finally {
    // Evidence is printed BEFORE any cleanup so an early failure can never swallow it.
    if (phases.some(p => !p.ok)) printEvidence();
    let childStopped = true;
    if (system.serverStarted()) await step("C10s", "Stop test-owned server", async () => { childStopped = false; childStopped = await system.stopServer(); need(childStopped, "test-owned server did not stop"); });
    // Give the pooler a moment to release the stopped server's connection before this process reconnects for cleanup.
    if (system.serverStarted() && childStopped) await system.sleep(4000);
    if (state.userId) {
      await step("C10", "Cleanup: delete only the synthetic user (cascade) by captured id", async () => {
        const user = await db.userById(state.userId!);
        need(user && user.email === EMAIL, "captured user id does not match the synthetic user");
        // The user was created by this run, so every submission it owns is test-owned (even if submit() failed before returning its id).
        const owned = await db.submissionIdsForUser(state.userId!);
        need(owned.length <= 1 && (state.submissionId === undefined || owned.every(id => id === state.submissionId)), "unexpected submissions on the synthetic user");
        if (state.submissionId === undefined && owned.length === 1) { state.submissionId = owned[0]; created.submission = 1; }
        await db.deleteUser(state.userId!);
        deleted = true;
        return `deleted user ${created.user}, submission ${created.submission}, assessment ${created.assessment}, weakness ${created.weakness} (via cascade)`;
      });
      await step("C11", "Verify no test records remain", async () => {
        need(deleted, "cleanup did not run");
        need((await db.userById(state.userId!)) === null, "user still exists");
        need((await db.userByEmail(EMAIL)) === null, "synthetic email still exists");
        if (state.submissionId) need(!(await db.submissionExists(state.submissionId)), "submission still exists");
        if (state.assessmentId) need(!(await db.assessmentExists(state.assessmentId)), "assessment still exists");
        need((await db.weaknessCount(state.weaknessIds)) === 0, "weakness rows still exist");
        const after = await db.counts();
        need(JSON.stringify(after) === JSON.stringify(snapshot), "table counts differ from the preflight snapshot");
        return `counts restored ${JSON.stringify(after)}`;
      });
    } else record("C10", "Cleanup", true, "nothing was created");
    // If cleanup failed, say exactly which test-owned ids are left; never attempt anything broader.
    if (state.userId && !deleted) log(`LEFTOVER test-owned records not deleted: user_id=${safeId(state.userId) ?? "unprintable"} submission_id=${safeId(state.submissionId) ?? "unknown"} assessment_id=${safeId(state.assessmentId) ?? "none"} weakness_ids=${state.weaknessIds.map(id => safeId(id) ?? "unprintable").join(",") || "none"}`);
    process.env.AI_ASSESSMENT_ENABLED = "false";
    await step("C12", "Assessment disabled; test-owned server stopped; .env unchanged", async () => {
      need(childStopped, `port ${PORT} still in use after stopping the test-owned server`);
      const again = await assessWritingForUser("x", "y");
      need(again.ok === false && /disabled/.test(again.message ?? ""), "assessment is not disabled");
      need(system.envStamp() === envStampBefore, ".env changed during the test");
      return `provider requests made: ${requests.length}`;
    });
    globalThis.fetch = realFetch;
    const failed = phases.filter(p => !p.ok);
    log(`SUMMARY ${failed.length === 0 ? "ALL PASS" : "FAILURES: " + failed.map(p => p.id).join(",")} | mode=${mode} | provider requests=${requests.length} | records created user=${created.user} submission=${created.submission} assessment=${created.assessment} weakness=${created.weakness} | cleanup=${deleted ? "done" : "not done"}`);
  }
  return { phases, exitCode: phases.some(p => !p.ok) ? 1 : 0 };
}
export const ledgerPath = path.join("logs", "ai-usage.jsonl");
