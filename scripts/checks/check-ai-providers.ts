import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { assessWritingForUser, type AssessmentDeps } from "../../src/lib/writing/assess";
import { prices, type Usage } from "../../src/lib/ai/cost";
import { integrationConfig } from "../../src/lib/ai/integration-guard";
import { assertFreeResponse, deepSeekProvider, FREE_MODEL_ALLOWLIST, FreeModelRejection, openRouterProvider, PINNED_FREE_MODEL, providerConfig, providerFromEnv, ProviderError, timedCall, type ProviderResult } from "../../src/lib/ai/provider";
import { diagnose, formatAssessmentDiagnosis, formatDiagnosis } from "../../src/lib/ai/diagnostics";
import { IntegrationConfigError } from "../../src/lib/ai/integration-guard";
import { validateAssessment } from "../../src/lib/ai/schema";

const key = "mock-only-key";
const learner = "I enjoyed an invented walk beside a river.";
const text = JSON.stringify({ grammarScore: 80, vocabularyScore: 70, coherenceScore: 90, taskAchievementScore: 80, corrections: [], suggestions: ["Add detail."], summary: "Clear." });
const freeEnv = (): NodeJS.ProcessEnv => ({ NODE_ENV: "test", AI_PROVIDER: "openrouter", AI_FREE_TEST_MODE: "true", AI_MODEL: "openrouter/free", AI_API_KEY: key, AI_ASSESSMENT_ENABLED: "true" });
const result = { text, promptTokens: 100, completionTokens: 50, model: "example/model:free" };
function fixture(env = freeEnv(), output: ProviderResult = result) {
  const rows: Usage[] = []; let calls = 0; let touches = 0; let saved = false; let status = "SUBMITTED";
  const db = {
    writingSubmission: { findFirst: async () => { touches++; return { finalText: learner, status, assessment: saved, prompt: { promptText: "Describe a walk." } }; }, update: async () => { status = "ASSESSED"; } },
    writingAssessment: { count: async () => 0, findUnique: async () => saved, create: async ({ data }: { data: { summary: string } }) => { assert.equal(data.summary, validateAssessment(output.text, learner).summary.trim()); saved = true; } }, weaknessRecord: { upsert: async () => {} },
    $transaction: async (work: (tx: unknown) => Promise<void>) => work(db),
  };
  const deps: AssessmentDeps = { env, db: db as unknown as PrismaClient, provider: async () => { calls++; return output; }, now: () => new Date("2026-11-05T00:00:00Z"), ledger: { read: async () => rows, spend: async since => (await deps.ledger.read()).filter(r => !since || new Date(r.ts) >= since).reduce((sum, r) => sum + r.costUsd, 0), pending: async (id, since) => { const matching = (await deps.ledger.read()).filter(r => r.submissionId === id && new Date(r.ts) >= since); return matching.filter(r => r.status === "reserved").length > matching.filter(r => ["reconciled", "failed"].includes(r.status)).length; }, append: async row => { rows.push(row); }, exclusive: async work => { touches++; return work(deps.ledger); } } };
  return { deps, rows, calls: () => calls, touches: () => touches, saved: () => saved, status: () => status };
}
async function run() {
  const original = globalThis.fetch;
  try {
    let requests = 0;
    globalThis.fetch = async (url, init) => {
      requests++;
      assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${key}`);
      const body = JSON.parse(String(init?.body));
      const isDeepSeek = requests <= 2;
      assert.deepEqual(Object.keys(body).sort(), ["model", "messages", "max_tokens", "response_format", "temperature", ...(isDeepSeek ? ["thinking"] : [])].sort());
      if (isDeepSeek) assert.deepEqual(body.thinking, { type: "disabled" });
      assert.equal(body.temperature, 0); assert.deepEqual(body.response_format, { type: "json_object" });
      const expected = requests === 1 ? "https://api.deepseek.com/chat/completions" : requests === 2 ? "https://custom.deepseek.test/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
      assert.equal(String(url), expected);
      return Response.json({ choices: [{ message: { content: text } }], usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0 }, model: result.model });
    };
    const input = { model: "deepseek-flash", messages: [], max_tokens: 1600 };
    assert.equal(providerFromEnv({ NODE_ENV: "test", AI_API_KEY: key }).name, deepSeekProvider({ NODE_ENV: "test" }).name);
    assert.deepEqual(await providerFromEnv({ NODE_ENV: "test", AI_API_KEY: key })(input, new AbortController().signal), { text, promptTokens: 100, completionTokens: 50 });
    await deepSeekProvider({ NODE_ENV: "test", AI_API_KEY: key, AI_BASE_URL: "https://custom.deepseek.test/" })(input, new AbortController().signal);
    await providerFromEnv({ ...freeEnv(), AI_BASE_URL: "https://evil.test" })({ ...input, model: "openrouter/free" }, new AbortController().signal);
    assert.equal(requests, 3);
    globalThis.fetch = async () => new Response("", { status: 429 });
    await assert.rejects(() => deepSeekProvider({ NODE_ENV: "test", AI_API_KEY: key })(input, new AbortController().signal), (e: unknown) => e instanceof ProviderError && e.details.category === "rate_limited" && e.details.status === 429 && e.retryable === false);
    // DeepSeek transport failures are classified, never raw: connection error, abort and a non-JSON body.
    globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
    await assert.rejects(() => deepSeekProvider({ NODE_ENV: "test", AI_API_KEY: key })(input, new AbortController().signal), (e: unknown) => e instanceof ProviderError && e.details.category === "network_error" && e.retryable === false);
    const aborted = new AbortController(); aborted.abort();
    await assert.rejects(() => deepSeekProvider({ NODE_ENV: "test", AI_API_KEY: key })(input, aborted.signal), (e: unknown) => e instanceof ProviderError && e.details.category === "network_timeout" && e.retryable === true);
    globalThis.fetch = async () => new Response("<html>gateway</html>", { status: 200 });
    await assert.rejects(() => deepSeekProvider({ NODE_ENV: "test", AI_API_KEY: key })(input, new AbortController().signal), (e: unknown) => e instanceof ProviderError && e.details.category === "invalid_provider_response");
    await assert.rejects(() => deepSeekProvider({ NODE_ENV: "test" })(input, new AbortController().signal), (e: unknown) => e instanceof ProviderError && e.details.category === "local_configuration");
    for (const status of [400, 401, 429, 500, 503]) {
      globalThis.fetch = async () => new Response("", { status });
      await assert.rejects(() => openRouterProvider(freeEnv())({ ...input, model: "openrouter/free" }, new AbortController().signal), (e: unknown) => e instanceof ProviderError && e.retryable === (status >= 500));
    }
    for (const body of [{}, { choices: [{ message: { content: text } }], usage: { prompt_tokens: -1, completion_tokens: 2 } }, { choices: [{ message: { content: text } }], usage: { prompt_tokens: 1, completion_tokens: 2, cost: "0" } }]) {
      globalThis.fetch = async () => Response.json(body);
      await assert.rejects(() => openRouterProvider(freeEnv())({ ...input, model: "openrouter/free" }, new AbortController().signal));
    }
    await assert.rejects(() => timedCall(async () => new Promise(() => {}), input, 1), (e: unknown) => e instanceof ProviderError && e.retryable);
  } finally { globalThis.fetch = original; }
  console.log("PASS fixed OpenRouter host, DeepSeek defaults/override, bearer, body, strict parsing, HTTP and timeout rules");

  const invalid: NodeJS.ProcessEnv[] = [ { ...freeEnv(), AI_PROVIDER: "unknown" }, { ...freeEnv(), AI_PROVIDER: "deepseek" }, { ...freeEnv(), AI_MODEL: "paid/model" }, ...[undefined, "", "false", "TRUE", "1"].map(flag => ({ ...freeEnv(), AI_FREE_TEST_MODE: flag })) ];
  for (const env of invalid) {
    assert.throws(() => providerFromEnv(env));
    const f = fixture(env); assert.equal((await assessWritingForUser("s", "u", f.deps)).ok, false); assert.equal(f.calls(), 0); assert.equal(f.rows.length, 0); assert.equal(f.touches(), 0);
  }
  console.log("PASS invalid provider/free settings refused before lock, DB, ledger or provider");
  for (const input of [undefined, "", "0", "-1", "bad"]) {
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", AI_ASSESSMENT_ENABLED: "true", AI_API_KEY: key, AI_PRICE_INPUT_PER_MTOK_USD: input, AI_PRICE_OUTPUT_PER_MTOK_USD: "1" };
    assert.throws(() => prices(env)); assert.throws(() => prices({ ...env, AI_PRICE_INPUT_PER_MTOK_USD: "1", AI_PRICE_OUTPUT_PER_MTOK_USD: input }));
    const f = fixture(env); assert.equal((await assessWritingForUser("s", "u", f.deps)).ok, false); assert.equal(f.calls(), 0); assert.equal(f.rows.length, 0);
  }
  for (const price of [undefined, "0"]) {
    const f = fixture({ ...freeEnv(), AI_PRICE_INPUT_PER_MTOK_USD: price, AI_PRICE_OUTPUT_PER_MTOK_USD: price });
    assert.equal((await assessWritingForUser("s", "u", f.deps)).ok, true); assert.equal(f.rows[1].promptTokens, 100); assert.equal(f.rows[1].completionTokens, 50); assert.equal(f.rows[1].costUsd, 0);
    assert.equal((await assessWritingForUser("s", "u", f.deps)).ok, true); assert.equal(f.calls(), 1);
    for (const row of f.rows) assert.deepEqual(Object.keys(row).sort(), ["ts", "submissionId", "userId", "model", "promptTokens", "completionTokens", "costUsd", "status"].sort());
    assert.ok(!JSON.stringify(f.rows).includes(learner)); assert.ok(!JSON.stringify(f.rows).includes(key));
  }
  for (const flag of [undefined, "", "false", "TRUE", "1"]) {
    const f = fixture({ ...freeEnv(), AI_ASSESSMENT_ENABLED: flag }); assert.equal((await assessWritingForUser("s", "u", f.deps)).ok, false); assert.equal(f.touches(), 0); assert.equal(f.calls(), 0); assert.equal(f.rows.length, 0);
  }
  console.log("PASS paid prices fail closed; free zero prices, real usage, duplicate guard, approved ledger fields and enable flag");
  for (const output of [{ ...result, model: "paid/model" }, { ...result, model: undefined }, { ...result, costUsd: 0.03 }, { ...result, model: "paid/model", costUsd: 0.07 }]) {
    const f = fixture(freeEnv(), output); assert.equal((await assessWritingForUser("s", "u", f.deps)).ok, false); assert.equal(f.calls(), 1); assert.equal(f.saved(), false); assert.equal(f.status(), "SUBMITTED"); assert.equal(f.rows[1].costUsd, ("costUsd" in output ? output.costUsd : 0)); assert.equal(f.rows[1].promptTokens, 100); assert.equal(f.rows[1].completionTokens, 50);
  }
  const paid = fixture({ AI_BUDGET_PERIOD: "lifetime", NODE_ENV: "test", AI_API_KEY: key, AI_ASSESSMENT_ENABLED: "true", AI_PRICE_INPUT_PER_MTOK_USD: "1", AI_PRICE_OUTPUT_PER_MTOK_USD: "2" });
  paid.rows.push({ ts: "2026-01-01T00:00:00Z", submissionId: "old", model: "m", promptTokens: 1, completionTokens: 1, costUsd: 1.999, status: "reconciled" });
  assert.equal((await assessWritingForUser("s", "u", paid.deps)).ok, false); assert.equal(paid.calls(), 0);
  const freeSpent = fixture({ ...freeEnv(), AI_BUDGET_PERIOD: "lifetime" }); freeSpent.rows.push({ ...paid.rows[0], costUsd: 2.01 }); assert.equal((await assessWritingForUser("s", "u", freeSpent.deps)).ok, false); assert.equal(freeSpent.calls(), 0);
  console.log("PASS unsafe free responses truthfully reconciled then discarded; lifetime budget applies to paid and free");
  const args = ["--confirm-free-request"];
  assert.equal(integrationConfig(freeEnv(), args).model, "openrouter/free");
  assert.throws(() => integrationConfig(freeEnv(), []));
  for (const field of ["AI_PROVIDER", "AI_FREE_TEST_MODE", "AI_MODEL", "AI_API_KEY"]) for (const value of [undefined, ""]) assert.throws(() => integrationConfig({ ...freeEnv(), [field]: value }, args));
  for (const env of invalid) assert.throws(() => integrationConfig(env, args));
  console.log("PASS pure integration guard requires every condition without network or IO");

  // ---- Sanitized error classification (mocked fetch only; nothing leaves the process) ----
  const leakNeedles = ["secret-body-text-ABC", "leak-ME", key, "Bearer", "secret-network-detail", "sensitive-learner-text", "<script>", "model-output-fragment"];
  const assertSanitized = (line: string) => { for (const needle of leakNeedles) assert.ok(!line.includes(needle), `leaked ${needle}`); };
  const callOpenRouter = () => openRouterProvider(freeEnv())({ model: "openrouter/free", messages: [{ role: "user", content: "sensitive-learner-text" }], max_tokens: 1 }, new AbortController().signal);
  const realFetch = globalThis.fetch;
  try {
    const expectedByStatus: Record<number, string> = { 400: "model_or_json_mode_unsupported", 401: "authentication", 402: "billing_restriction", 403: "forbidden", 404: "model_or_endpoint_unavailable", 429: "rate_limited", 500: "provider_server_error", 503: "provider_server_error", 418: "http_error" };
    for (const [status, category] of Object.entries(expectedByStatus)) {
      globalThis.fetch = async () => new Response("secret-body-text-ABC", { status: Number(status), headers: { "x-request-id": "req-12345678" } });
      let caught: unknown; try { await callOpenRouter(); } catch (e) { caught = e; }
      assert.ok(caught instanceof ProviderError); assert.equal(caught.retryable, Number(status) >= 500);
      const d = diagnose(caught); assert.equal(d.category, category); assert.equal(d.status, Number(status)); assert.equal(d.requestId, "req-12345678");
      assert.equal(formatDiagnosis(d), `FAIL category=${category} http_status=${status} request_id=req-12345678`); assertSanitized(formatDiagnosis(d));
    }
    globalThis.fetch = async () => new Response("", { status: 401, headers: { "x-request-id": "bad id <script>" } });
    let unsafeId: unknown; try { await callOpenRouter(); } catch (e) { unsafeId = e; }
    assert.equal(diagnose(unsafeId).requestId, undefined); assertSanitized(formatDiagnosis(diagnose(unsafeId)));

    globalThis.fetch = async () => new Response("secret-body-text-ABC not json", { status: 200 });
    let notJson: unknown; try { await callOpenRouter(); } catch (e) { notJson = e; }
    assert.equal(diagnose(notJson).category, "invalid_provider_response"); assertSanitized(formatDiagnosis(diagnose(notJson)));
    globalThis.fetch = async () => Response.json({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    let noContent: unknown; try { await callOpenRouter(); } catch (e) { noContent = e; }
    assert.equal(diagnose(noContent).category, "invalid_provider_response");
    globalThis.fetch = async () => Response.json({ id: "gen-abcdef123", error: { code: 429, message: "leak-ME" } });
    let inBody: unknown; try { await callOpenRouter(); } catch (e) { inBody = e; }
    const inBodyDiagnosis = diagnose(inBody); assert.equal(inBodyDiagnosis.category, "provider_error_in_body"); assert.equal(inBodyDiagnosis.status, 429); assert.equal(inBodyDiagnosis.requestId, "gen-abcdef123"); assertSanitized(formatDiagnosis(inBodyDiagnosis));

    globalThis.fetch = async () => { throw new TypeError("secret-network-detail ECONNREFUSED"); };
    let net: unknown; try { await callOpenRouter(); } catch (e) { net = e; }
    assert.ok(net instanceof ProviderError); assert.equal(net.retryable, false); assert.equal(diagnose(net).category, "network_error"); assertSanitized(formatDiagnosis(diagnose(net)));
    globalThis.fetch = async () => { throw Object.assign(new Error("secret-network-detail"), { name: "AbortError" }); };
    let aborted: unknown; try { await callOpenRouter(); } catch (e) { aborted = e; }
    assert.equal(diagnose(aborted).category, "network_timeout"); assert.equal((aborted as ProviderError).retryable, true);
    let timedOut: unknown; try { await timedCall(async () => new Promise(() => {}), { model: "m", messages: [], max_tokens: 1 }, 1); } catch (e) { timedOut = e; }
    assert.equal(diagnose(timedOut).category, "network_timeout");

    // A successful response still carries the safe request id and the served model for reporting.
    globalThis.fetch = async () => Response.json({ id: "gen-okid1234", model: "vendor/model:free", choices: [{ message: { content: text } }], usage: { prompt_tokens: 3, completion_tokens: 4, cost: 0 } });
    const ok = await callOpenRouter(); assert.equal(ok.requestId, "gen-okid1234"); assert.equal(ok.model, "vendor/model:free"); assertFreeResponse(ok);
  } finally { globalThis.fetch = realFetch; }
  console.log("PASS HTTP 400/401/402/403/404/418/429/5xx, in-body errors, network, timeout and bad-JSON classification is sanitized");

  // Local configuration rejection lists condition names only, never values.
  const thrown = (work: () => unknown): unknown => { try { work(); } catch (e) { return e; } return undefined; };
  const badConfig = diagnose(thrown(() => integrationConfig({ NODE_ENV: "test", AI_PROVIDER: "deepseek", AI_API_KEY: "k-mock-123" }, [])));
  assert.equal(badConfig.category, "local_configuration_rejection"); assert.ok(badConfig.detail!.includes("AI_PROVIDER") && badConfig.detail!.includes("AI_FREE_TEST_MODE") && badConfig.detail!.includes("AI_MODEL") && badConfig.detail!.includes("--confirm-free-request") && !badConfig.detail!.includes("AI_API_KEY"));
  assert.ok(!formatDiagnosis(badConfig).includes("k-mock-123"));
  assert.match(diagnose(thrown(() => integrationConfig({ ...freeEnv(), AI_API_KEY: "" }, ["--confirm-free-request"]))).detail!, /AI_API_KEY is missing or empty/);
  const everything = thrown(() => integrationConfig({ NODE_ENV: "test" }, [])); assert.ok(everything instanceof IntegrationConfigError); assert.equal(everything.problems.length, 5);
  assert.equal(diagnose(thrown(() => providerFromEnv({ ...freeEnv(), AI_PROVIDER: "unknown" }))).category, "local_configuration_rejection");
  assert.equal(diagnose(thrown(() => integrationConfig({ ...freeEnv(), AI_TIMEOUT_MS: "0" }, ["--confirm-free-request"]))).category, "local_configuration_rejection");
  assert.equal(diagnose(new ProviderError(false, { category: "local_configuration" })).category, "local_configuration_rejection");
  console.log("PASS local configuration rejection names failed conditions without values");

  // Free-model verification keeps free-only enforcement and explains why a response was rejected.
  const verdict = (output: ProviderResult) => { const e = thrown(() => assertFreeResponse(output)); if (e === undefined) return "ok"; assert.ok(e instanceof FreeModelRejection); return formatDiagnosis(diagnose(e)); };
  assert.equal(verdict({ ...result, model: "openrouter/free" }), "ok"); assert.equal(verdict({ ...result, model: "vendor/model:free" }), "ok"); assert.equal(verdict({ ...result, model: "vendor/model:free", costUsd: 0 }), "ok");
  assert.equal(verdict({ ...result, model: undefined }), "FAIL category=free_model_verification_rejected detail=reason=model_missing");
  assert.equal(verdict({ ...result, model: "vendor/paid-model" }), "FAIL category=free_model_verification_rejected detail=reason=model_not_free served_model=vendor/paid-model");
  assert.equal(verdict({ ...result, model: "vendor/model:free", costUsd: 0.02 }), "FAIL category=free_model_verification_rejected detail=reason=cost_reported served_model=vendor/model:free reported_cost_usd=0.02");
  assert.equal(verdict({ ...result, model: "vendor/model\nwith <script>" }), "FAIL category=free_model_verification_rejected detail=reason=model_not_free served_model=unprintable");
  // An un-suffixed id is rejected (strict policy): a documented limitation, never loosened silently or replaced by a paid fallback.
  assert.ok(verdict({ ...result, model: "openrouter/stealth-example" }).includes("model_not_free"));
  console.log("PASS free-model verification rejects unverified models/costs with a sanitized reason and keeps free-only enforcement");

  // Invalid JSON / schema failures never echo model output.
  const diagnoseJson = (raw: string) => { const e = thrown(() => validateAssessment(raw, learner)); return e === undefined ? { category: "ok" } : diagnose(e); };
  assert.equal(diagnoseJson("model-output-fragment not json").category, "invalid_json");
  assert.equal(diagnoseJson("```json\n" + text + "\n```").category, "invalid_json");
  assert.deepEqual(diagnoseJson(JSON.stringify({ a: 1 })), { category: "schema_validation_failed", detail: "Invalid AI score" });
  assert.deepEqual(diagnoseJson(JSON.stringify({ ...JSON.parse(text), extra: "model-output-fragment" })), { category: "schema_validation_failed", detail: "Unexpected AI field" });
  for (const raw of ["model-output-fragment not json", JSON.stringify({ ...JSON.parse(text), extra: "model-output-fragment" })]) assertSanitized(formatDiagnosis(diagnoseJson(raw)));
  assert.deepEqual(diagnose(new Error("sensitive-learner-text")), { category: "unexpected_error" });
  assertSanitized(formatDiagnosis(diagnose(new Error("sensitive-learner-text"))));
  console.log("PASS invalid JSON, schema failure and unexpected errors are classified without echoing content");

  // ---- AI_MAX_ATTEMPTS: default keeps the single retry; 1 allows exactly one provider attempt ----
  const attemptsFixture = (maxAttempts: string | undefined) => {
    const f = fixture({ ...freeEnv(), AI_MAX_ATTEMPTS: maxAttempts }); let attempts = 0;
    f.deps.provider = async () => { attempts++; throw new ProviderError(true); };
    return { f, attempts: () => attempts };
  };
  for (const [value, expected] of [[undefined, 2], ["2", 2], ["1", 1]] as const) {
    const t = attemptsFixture(value); assert.equal((await assessWritingForUser("s", "u", t.f.deps)).ok, false); assert.equal(t.attempts(), expected); assert.equal(t.f.status(), "SUBMITTED"); assert.equal(t.f.saved(), false);
  }
  const single = attemptsFixture("1"); await assessWritingForUser("s", "u", single.f.deps); assert.equal(single.f.rows.length, 2);
  for (const bad of ["0", "3", "1.5", "-1", "x", ""]) {
    const t = attemptsFixture(bad); const r = await assessWritingForUser("s", "u", t.f.deps);
    assert.equal(r.ok, false); assert.match(r.message!, /max attempts/); assert.equal(t.attempts(), 0); assert.equal(t.f.rows.length, 0);
  }
  const okOne = fixture({ ...freeEnv(), AI_MAX_ATTEMPTS: "1" }); assert.equal((await assessWritingForUser("s", "u", okOne.deps)).ok, true); assert.equal(okOne.calls(), 1);
  console.log("PASS AI_MAX_ATTEMPTS: default retry preserved, 1 allows exactly one attempt, invalid values refused before any reservation");

  // ---- Writing AI failure diagnostics (mocked; no network, no database) ----
  const served = "recursive/flint-v1.0:free";
  const base: ProviderResult = { text, promptTokens: 277, completionTokens: 1600, model: served, requestId: "request-123456", reasoningTokens: 12 };
  const noLeak = (value: string) => { for (const needle of [key, learner, "model-output-fragment", "secret-db-detail", "<script>", "Bearer"]) assert.ok(!value.includes(needle), `leaked ${needle}`); };
  const attempt = async (output: ProviderResult, tweak?: (f: ReturnType<typeof fixture>) => void, env = freeEnv()) => {
    const f = fixture(env, output); tweak?.(f); const r = await assessWritingForUser("s", "u", f.deps); return { f, r };
  };
  const expectFail = (x: Awaited<ReturnType<typeof attempt>>, category: string) => {
    assert.equal(x.r.ok, false); assert.equal(x.r.diagnosis?.category, category); assert.equal(x.f.status(), "SUBMITTED"); assert.equal(x.f.saved(), false);
    assert.ok(["AI feedback unavailable, try again", "AI free test response violated free-only policy"].includes(x.r.message!)); noLeak(formatAssessmentDiagnosis(x.r.diagnosis!)); noLeak(JSON.stringify(x.r));
    assert.equal(x.r.diagnosis?.promptTokens, 277); assert.equal(x.r.diagnosis?.requestId, "request-123456");
    assert.equal(x.r.diagnosis?.servedModel, category === "free_model_rejected" ? "vendor/paid-model" : served);
    assert.equal(x.r.diagnosis?.persistence, category === "persistence_failed" ? "failed" : "not_attempted");
  };
  // finish_reason=length: never parsed, never saved, even if the text happens to be valid JSON.
  for (const body of [text, '{"grammarScore": 80, "vocab', "model-output-fragment"]) {
    const x = await attempt({ ...base, text: body, finishReason: "length", reasoningTokens: 1200 }, undefined, { ...freeEnv(), AI_MAX_ATTEMPTS: "1" });
    expectFail(x, "completion_truncated"); const d = x.r.diagnosis!;
    assert.equal(x.f.calls(), 1); assert.equal(d.jsonParse, "skipped"); assert.equal(d.schemaValidation, "skipped"); assert.equal(d.persistence, "not_attempted");
    assert.equal(d.finishReason, "length"); assert.equal(d.servedModel, served); assert.equal(d.promptTokens, 277); assert.equal(d.completionTokens, 1600); assert.equal(d.reasoningTokens, 1200);
    assert.equal(x.f.rows.length, 2); assert.equal(x.f.rows[1].promptTokens, 277); assert.equal(x.f.rows[1].completionTokens, 1600); assert.equal(x.f.rows[1].costUsd, 0);
  }
  { const x = await attempt({ ...base, text: "model-output-fragment not json", completionTokens: 90, finishReason: "stop" }); expectFail(x, "invalid_json"); assert.equal(x.r.diagnosis?.jsonParse, "failed"); assert.equal(x.r.diagnosis?.schemaValidation, "skipped"); assert.equal(x.f.calls(), 1); }
  { const x = await attempt({ ...base, text: JSON.stringify({ grammarScore: 80 }), completionTokens: 40, finishReason: "stop" }); expectFail(x, "schema_validation_failed"); assert.equal(x.r.diagnosis?.detail, "Invalid AI score"); assert.equal(x.r.diagnosis?.jsonParse, "ok"); assert.equal(x.r.diagnosis?.schemaValidation, "failed"); assert.equal(x.f.calls(), 1); }
  for (const finishReason of ["stop", undefined]) { const x = await attempt({ ...base, text: "   ", completionTokens: 5, finishReason }); expectFail(x, "empty_model_output"); assert.equal(x.f.calls(), 1); }
  { const x = await attempt({ ...base, text: '{"grammarScore": 80,', completionTokens: 1600 }); expectFail(x, "completion_truncated"); assert.equal(x.r.diagnosis?.detail, "at_token_cap"); assert.equal(x.r.diagnosis?.jsonParse, "failed"); }
  { const x = await attempt({ ...base, completionTokens: 1600 }); assert.equal(x.r.ok, true); assert.equal(x.f.saved(), true); }
  { const x = await attempt({ ...base, completionTokens: 120, finishReason: "stop" }, undefined, { ...freeEnv(), AI_MAX_ATTEMPTS: "1" });
    assert.equal(x.r.ok, true); assert.equal(x.r.diagnosis, undefined); assert.equal(x.f.saved(), true); assert.equal(x.f.status(), "ASSESSED"); assert.equal(x.f.calls(), 1); assert.equal(x.f.rows.length, 2); }
  { const x = await attempt({ ...base, model: "vendor/paid-model", completionTokens: 100, finishReason: "stop" }); expectFail(x, "free_model_rejected"); assert.equal(x.r.diagnosis?.detail, "reason=model_not_free"); }
  { const x = await attempt({ ...base, completionTokens: 120, finishReason: "stop" }, f => { const original = f.deps.db as unknown as Record<string, unknown>; f.deps.db = { ...original, $transaction: async () => { throw new Error("secret-db-detail"); } } as unknown as PrismaClient; });
    expectFail(x, "persistence_failed"); assert.equal(x.r.diagnosis?.persistence, "failed"); assert.equal(x.r.diagnosis?.schemaValidation, "ok"); }
  { let calls = 0; const x = await attempt(base, f => { f.deps.provider = async () => { calls++; throw new ProviderError(false, { category: "rate_limited", status: 429, requestId: "req-12345678" }); }; });
    const d = x.r.diagnosis!; assert.equal(d.category, "provider_error"); assert.equal(d.providerCategory, "rate_limited"); assert.equal(d.httpStatus, 429); assert.equal(d.requestId, "req-12345678"); assert.equal(calls, 1); assert.equal(x.f.status(), "SUBMITTED"); noLeak(formatAssessmentDiagnosis(d)); }
  { let calls = 0; const x = await attempt(base, f => { f.deps.provider = async () => { calls++; throw new ProviderError(true, { category: "provider_server_error", status: 503 }); }; }, { ...freeEnv(), AI_MAX_ATTEMPTS: "1" });
    assert.equal(calls, 1); assert.equal(x.r.diagnosis?.providerCategory, "provider_server_error"); assert.equal(x.f.rows.length, 2); assert.equal(x.f.status(), "SUBMITTED"); }
  { const x = await attempt(base, undefined, { ...freeEnv(), AI_MAX_ATTEMPTS: "9" }); assert.equal(x.r.diagnosis?.category, "request_refused"); assert.equal(x.r.diagnosis?.detail, "Invalid AI max attempts"); assert.equal(x.f.calls(), 0); assert.equal(x.f.rows.length, 0); }
  { const x = await attempt({ ...base, completionTokens: 120, finishReason: "stop" }, f => {
    f.deps.ledger.append = async row => { if (row.status === "reconciled") throw new Error("secret-db-detail"); f.rows.push(row); };
  });
    assert.equal(x.r.diagnosis?.category, "unexpected_error"); assert.equal(x.r.diagnosis?.servedModel, served);
    assert.equal(x.r.diagnosis?.finishReason, "stop"); assert.equal(x.r.diagnosis?.completionTokens, 120);
    assert.equal(x.r.diagnosis?.requestId, "request-123456"); assert.equal(x.r.diagnosis?.jsonParse, "skipped");
    noLeak(JSON.stringify(x.r));
  }
  { const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => Response.json({ id: "gen-abcdef123", model: served, choices: [{ finish_reason: "length", message: { content: null } }], usage: { prompt_tokens: 277, completion_tokens: 1600, cost: 0, completion_tokens_details: { reasoning_tokens: 1550 } } });
      const nullContent = await callOpenRouter(); assert.equal(nullContent.text, ""); assert.equal(nullContent.finishReason, "length"); assert.equal(nullContent.reasoningTokens, 1550);
      globalThis.fetch = async () => Response.json({ model: served, choices: [{ finish_reason: "<script>", message: { content: text } }], usage: { prompt_tokens: 1, completion_tokens: 1, completion_tokens_details: { reasoning_tokens: -4 } } });
      const odd = await callOpenRouter(); assert.equal(odd.finishReason, undefined); assert.equal(odd.reasoningTokens, undefined);
      globalThis.fetch = async () => Response.json({ choices: [{ message: { content: 42 } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
      await assert.rejects(() => callOpenRouter());
    } finally { globalThis.fetch = original; } }
  { const lines: string[] = []; const warn = console.warn; console.warn = (...args: unknown[]) => { lines.push(args.join(" ")); };
    try { await attempt({ ...base, finishReason: "length" }, undefined, { ...freeEnv(), AI_DIAGNOSTICS_LOG: "true" }); await attempt({ ...base, finishReason: "length" }); } finally { console.warn = warn; }
    assert.equal(lines.length, 1); assert.match(lines[0], /category=completion_truncated/); assert.match(lines[0], /finish_reason=length/); noLeak(lines[0]); }
  console.log("PASS Writing AI failure diagnostics: truncation, empty/invalid JSON, schema, free-model, persistence, provider errors, no retry, no leakage");

  // ---- Pinned free model: mocks only, nothing leaves the process ----
  {
    const pinnedEnv = (): NodeJS.ProcessEnv => ({ ...freeEnv(), AI_MODEL: PINNED_FREE_MODEL });
    assert.equal(PINNED_FREE_MODEL, "google/gemma-4-26b-a4b-it:free");
    // Allowlist: frozen, free ids only; the router id stays allowed but is no longer the default.
    assert.ok(Object.isFrozen(FREE_MODEL_ALLOWLIST) && FREE_MODEL_ALLOWLIST.includes(PINNED_FREE_MODEL) && FREE_MODEL_ALLOWLIST.includes("openrouter/free"));
    assert.ok(FREE_MODEL_ALLOWLIST.every(m => m === "openrouter/free" || m.endsWith(":free")));
    assert.throws(() => (FREE_MODEL_ALLOWLIST as string[]).push("vendor/paid-model"));
    assert.equal(providerConfig(pinnedEnv()).model, PINNED_FREE_MODEL);
    { const noModel = pinnedEnv(); delete noModel.AI_MODEL; assert.equal(providerConfig(noModel).model, PINNED_FREE_MODEL); }
    assert.deepEqual(providerConfig({ NODE_ENV: "test" }), { provider: "deepseek", model: "deepseek-flash", freeTest: false });
    for (const bad of ["google/gemma-4-26b-a4b-it", "google/gemma-4-26b-a4b-it:nitro", "google/gemma-4-26b-a4b-it:free:extended", "vendor/other:free", "openai/gpt-5"]) assert.throws(() => providerConfig({ ...pinnedEnv(), AI_MODEL: bad }), /free test requires/);
    assert.throws(() => providerConfig({ ...pinnedEnv(), AI_FREE_TEST_MODE: "false" }));
    assert.throws(() => providerConfig({ ...pinnedEnv(), AI_PROVIDER: "deepseek" }));
    assert.equal(integrationConfig(pinnedEnv(), ["--confirm-free-request"]).model, PINNED_FREE_MODEL);

    // Request shape: exact URL, bearer auth, JSON mode, max_tokens passed through, no routing/fallback/reasoning fields.
    const original = globalThis.fetch; let seenUrl = ""; let seenAuth = ""; let seenBody: Record<string, unknown> = {}; let calls = 0;
    try {
      globalThis.fetch = async (url, init) => { calls++; seenUrl = String(url); seenBody = JSON.parse(String(init?.body)); seenAuth = new Headers(init?.headers).get("authorization") ?? ""; return Response.json({ model: PINNED_FREE_MODEL, choices: [{ finish_reason: "stop", message: { content: text } }], usage: { prompt_tokens: 5, completion_tokens: 6, cost: 0 } }); };
      const out = await openRouterProvider(pinnedEnv())({ model: PINNED_FREE_MODEL, messages: [{ role: "user", content: "x" }], max_tokens: 1600 }, new AbortController().signal);
      assert.equal(seenUrl, "https://openrouter.ai/api/v1/chat/completions"); assert.equal(seenAuth, `Bearer ${key}`);
      assert.deepEqual(Object.keys(seenBody).sort(), ["max_tokens", "messages", "model", "response_format", "temperature"]);
      assert.equal(seenBody.model, PINNED_FREE_MODEL); assert.equal(seenBody.max_tokens, 1600); assert.deepEqual(seenBody.response_format, { type: "json_object" });
      assert.equal(out.model, PINNED_FREE_MODEL); assert.equal(out.text, text); assertFreeResponse(out, PINNED_FREE_MODEL);
      calls = 0;
      await assert.rejects(() => openRouterProvider(pinnedEnv())({ model: "openrouter/free", messages: [], max_tokens: 1600 }, new AbortController().signal));
      assert.equal(calls, 0);
    } finally { globalThis.fetch = original; }

    // Free-only response policy for a pinned request.
    const reason = (model: string | undefined, costUsd?: number, requested: string | undefined = PINNED_FREE_MODEL) => {
      const e = thrown(() => assertFreeResponse({ ...result, model, costUsd }, requested));
      if (e === undefined) return "ok"; assert.ok(e instanceof FreeModelRejection); return e.reason;
    };
    assert.equal(reason(PINNED_FREE_MODEL, 0), "ok");
    assert.equal(reason("google/gemma-4-26b-a4b-it-20260403:free", 0), "ok");
    assert.equal(reason("vendor/other:free"), "model_mismatch");
    assert.equal(reason("openrouter/free"), "model_mismatch");
    assert.equal(reason("google/gemma-4-26b-a4b-it-2026:free"), "model_mismatch");
    assert.equal(reason("google/gemma-4-26b-a4b-it"), "model_not_free");
    assert.equal(reason("google/gemma-4-26b-a4b-it-20260403:free:x"), "model_not_free");
    assert.equal(reason(PINNED_FREE_MODEL, 0.0001), "cost_reported");
    assert.equal(reason(undefined), "model_missing");
    assert.equal(reason("vendor/other:free", 0, "openrouter/free"), "ok");
    assert.equal(thrown(() => assertFreeResponse({ ...result, model: "vendor/other:free", costUsd: 0 })), undefined); // no `requested` argument: legacy router rule
    assert.equal(formatDiagnosis(diagnose(thrown(() => assertFreeResponse({ ...result, model: "vendor/other:free" }, PINNED_FREE_MODEL)))), "FAIL category=free_model_verification_rejected detail=reason=model_mismatch served_model=vendor/other:free");

    // Whole assessment flow with the pinned model: success, substitute/paid/costly refusals, and failure handling. One attempt, no retry.
    const ok = await attempt({ ...base, completionTokens: 120, model: PINNED_FREE_MODEL, finishReason: "stop", costUsd: 0 }, undefined, pinnedEnv());
    assert.equal(ok.r.ok, true); assert.equal(ok.f.saved(), true); assert.equal(ok.f.status(), "ASSESSED"); assert.equal(ok.f.calls(), 1);
    assert.deepEqual(ok.f.rows.map(row => [row.status, row.costUsd]), [["reserved", 0], ["reconciled", 0]]);
    for (const [served, detail] of [["vendor/other:free", "reason=model_mismatch"], ["google/gemma-4-26b-a4b-it", "reason=model_not_free"]] as const) {
      const x = await attempt({ ...base, completionTokens: 120, model: served, finishReason: "stop" }, undefined, pinnedEnv());
      assert.equal(x.r.ok, false); assert.equal(x.r.diagnosis?.category, "free_model_rejected"); assert.equal(x.r.diagnosis?.detail, detail);
      assert.equal(x.f.saved(), false); assert.equal(x.f.status(), "SUBMITTED"); assert.equal(x.f.calls(), 1); noLeak(JSON.stringify(x.r));
    }
    const costly = await attempt({ ...base, completionTokens: 120, model: PINNED_FREE_MODEL, finishReason: "stop", costUsd: 0.01 }, undefined, pinnedEnv());
    assert.equal(costly.r.diagnosis?.detail, "reason=cost_reported"); assert.equal(costly.f.saved(), false);
    const truncated = await attempt({ ...base, text: "", model: PINNED_FREE_MODEL, finishReason: "length", costUsd: 0 }, undefined, pinnedEnv());
    assert.equal(truncated.r.diagnosis?.category, "completion_truncated"); assert.equal(truncated.f.saved(), false); assert.equal(truncated.f.calls(), 1);
    const notJson = await attempt({ ...base, text: "not json model-output-fragment", completionTokens: 120, model: PINNED_FREE_MODEL, finishReason: "stop", costUsd: 0 }, undefined, pinnedEnv());
    assert.equal(notJson.r.diagnosis?.category, "invalid_json"); assert.equal(notJson.f.saved(), false); noLeak(JSON.stringify(notJson.r));
    console.log("PASS pinned free model: allowlist, config, request shape (JSON mode, no routing/reasoning fields), free-only policy, substitution/paid/cost refusals, failure handling");
  }
}
run().catch(() => { console.error("FAIL mocked provider assertion"); process.exitCode = 1; });
