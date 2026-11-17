/**
 * Writing AI E2E with a DETERMINISTIC MOCK PROVIDER and everything else real: Prisma + Supabase, submitWritingForUser,
 * assessWritingForUser, the real OpenRouter adapter and validator, the session login, the production Next.js server
 * and the result page. No OpenRouter/DeepSeek request is possible: the only thing that answers is the stub below.
 *
 *   node --env-file=.env --import tsx scripts/e2e-live/e2e-writing-ai-mock.ts --confirm-mock-e2e
 *
 * `.env` is needed only for DATABASE_URL / AUTH_SECRET; every AI_* setting is forced in-process (incl. a dummy key),
 * so a real provider key from `.env` can never be used. Real network is reachable only for the test-owned server.
 * Never import this module in offline checks (it needs a real database).
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileLedger } from "../../src/lib/ai/cost";
import { PINNED_FREE_MODEL } from "../../src/lib/ai/provider";
import { MOCK_API_KEY, MOCK_PROVIDER_CONTENT, PORT, runE2E } from "./e2e-writing-ai-core";
import { createRealDeps, prisma } from "./e2e-writing-ai-real";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const nativeFetch = globalThis.fetch;
let providerCalls = 0; // valid, answered provider requests
let blockedCalls = 0; // anything else that tried to leave the process

const mockFetch: typeof fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.href === OPENROUTER_URL) {
    try {
      if (init?.method !== "POST") throw new Error("method");
      if (new Headers(init.headers).get("authorization") !== `Bearer ${MOCK_API_KEY}`) throw new Error("credential");
      if (JSON.parse(String(init.body)).model !== PINNED_FREE_MODEL) throw new Error("model");
      if (providerCalls >= 1) throw new Error("second call");
    } catch { blockedCalls++; throw new Error("mock provider refused the request"); }
    providerCalls++;
    return Response.json(
      { id: "gen-mock-000001", model: PINNED_FREE_MODEL, choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: MOCK_PROVIDER_CONTENT } }], usage: { prompt_tokens: 321, completion_tokens: 187, cost: 0 } },
      { headers: { "x-request-id": "mock-req-000001" } },
    );
  }
  // The test-owned production server (login + result page) is the only real network destination.
  if (url.origin === `http://127.0.0.1:${PORT}`) return nativeFetch(input, init);
  blockedCalls++;
  throw new Error("mock fetch blocked a non-test request");
};

// Force the AI configuration for THIS process; overrides anything --env-file loaded (including a real key).
Object.assign(process.env, { AI_ASSESSMENT_ENABLED: "true", AI_PROVIDER: "openrouter", AI_MODEL: PINNED_FREE_MODEL, AI_FREE_TEST_MODE: "true", AI_MAX_ATTEMPTS: "1", AI_TIMEOUT_MS: "60000", AI_API_KEY: MOCK_API_KEY });
delete process.env.AI_BASE_URL;
globalThis.fetch = mockFetch;

async function isolationSelfCheck(): Promise<string[]> {
  const refused = async (work: () => Promise<unknown>) => { try { await work(); return false; } catch { return true; } };
  const post = (url: string, key: string, model: string) => () => fetch(url, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: JSON.stringify({ model }) });
  const problems: string[] = [];
  const must = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
  must(await refused(post("https://api.deepseek.com/chat/completions", MOCK_API_KEY, "deepseek-flash")), "DeepSeek host not blocked");
  must(await refused(() => fetch("https://openrouter.ai/api/v1/models")), "other OpenRouter URL not blocked");
  must(await refused(() => fetch(OPENROUTER_URL)), "GET to the provider URL not blocked");
  must(await refused(post(OPENROUTER_URL, "a-different-credential", PINNED_FREE_MODEL)), "foreign credential not blocked");
  must(await refused(post(OPENROUTER_URL, MOCK_API_KEY, "openrouter/free")), "non-pinned model not blocked");
  must(process.env.AI_API_KEY === MOCK_API_KEY && process.env.AI_PROVIDER === "openrouter" && process.env.AI_BASE_URL === undefined, "process env is not forced to the mock configuration");
  must(providerCalls === 0, "provider was answered during the self-check");
  blockedCalls = 0; // the self-check's deliberate probes are not counted as run-time attempts
  return problems;
}

async function main(): Promise<number> {
  const problems = await isolationSelfCheck();
  if (problems.length > 0) { console.log(`FAIL M0 Mock isolation self-check - ${problems.join("; ")}`); console.log("STOP: no database was touched."); return 1; }
  console.log("PASS M0 Mock isolation self-check - DeepSeek/other OpenRouter URLs/foreign credential/non-pinned model all blocked; env forced to dummy key; provider answered 0 times");

  const realLedgerFile = path.join("logs", "ai-usage.jsonl");
  const realRows = () => (existsSync(realLedgerFile) ? readFileSync(realLedgerFile, "utf8").split("\n").filter(Boolean).length : 0);
  const realRowsBefore = realRows();
  // submit/assess derive their default ledger from the working directory; run them from a throw-away directory.
  const tmp = mkdtempSync(path.join(os.tmpdir(), "e2e-mock-ledger-"));
  const tmpLedgerFile = path.join(tmp, "logs", "ai-usage.jsonl");
  const original = process.cwd();
  const wrap = async <T>(work: () => Promise<T>): Promise<T> => { process.chdir(tmp); try { return await work(); } finally { process.chdir(original); } };
  let exit = 1;
  try {
    const result = await runE2E(createRealDeps({
      args: process.argv.slice(2), mode: "mock", wrap,
      ledger: fileLedger(path.join(tmp, "logs")),
      readLedgerRaw: () => (existsSync(tmpLedgerFile) ? readFileSync(tmpLedgerFile, "utf8") : ""),
    }));
    exit = result.exitCode;
    const checks: [string, boolean][] = [
      [`provider mock answered exactly once (answered=${providerCalls})`, providerCalls === 1],
      [`no request was blocked at run time (blocked=${blockedCalls})`, blockedCalls === 0],
      [`real ledger logs/ai-usage.jsonl untouched (rows ${realRowsBefore} -> ${realRows()})`, realRows() === realRowsBefore],
      ["working directory restored", process.cwd() === original],
    ];
    for (const [what, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"} M1 ${what}`); if (!ok) exit = 1; }
  } finally {
    process.chdir(original);
    rmSync(tmp, { recursive: true, force: true }); // only the directory created above
    globalThis.fetch = nativeFetch;
  }
  console.log(`MOCK provider_invocations=${providerCalls} blocked_attempts=${blockedCalls} temp_ledger_removed=${!existsSync(tmp)}`);
  return exit;
}

main()
  .then(code => { process.exitCode = code; })
  .catch(() => { console.error("FAIL mock e2e crashed: unexpected error"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
