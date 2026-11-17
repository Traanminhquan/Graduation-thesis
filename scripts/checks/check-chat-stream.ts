import assert from "node:assert/strict";
import { chatStreamConfig, streamChat, type ChatStreamInput, type ChatStreamDeps } from "../../src/lib/ai/chat-stream";
import { ProviderError, categoryForStatus, type FailureCategory } from "../../src/lib/ai/provider";

const env: NodeJS.ProcessEnv = { NODE_ENV: "test", CONVERSATION_MODEL: " test/model:1 ", GROQ_API_KEY: "fake-key", AI_API_KEY: "fake-deepseek" };
const input: ChatStreamInput = { messages: [{ role: "user", content: "Hello!" }], maxTokens: 120 };
const event = (content: string, extra = {}) => `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: "stop" }], ...extra })}\n\n`;
const end = "data: [DONE]\n\n";
function fixture(text: string, bytewise = false, open = false) {
  let cancelled = false;
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset < bytes.length) {
        const next = bytewise ? offset + 1 : bytes.length;
        controller.enqueue(bytes.slice(offset, next)); offset = next;
      } else if (!open) controller.close();
    },
    cancel() { cancelled = true; },
  });
  const fetch: typeof globalThis.fetch = async () => new Response(body);
  return { fetch, cancelled: () => cancelled };
}
async function collect(fetch: typeof globalThis.fetch, overrides: Partial<ChatStreamDeps> = {}, data = input) {
  return Array.fromAsync(streamChat(data, { env, fetch, ...overrides }));
}
const category = (expected: FailureCategory, status?: number) => (error: unknown) => {
  assert.ok(error instanceof ProviderError);
  assert.equal(error.details.category, expected);
  if (status !== undefined) assert.equal(error.details.status, status);
  assert.equal(error.message.includes("CANARY"), false);
  assert.equal(error.message.includes("fake-key"), false);
  return true;
};

async function run() {
  assert.equal(chatStreamConfig(env).provider, "groq");
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_PROVIDER: " " }).provider, "groq");
  // Reasoning effort: optional, Groq only, documented values only; blank means unset.
  assert.equal(chatStreamConfig(env).reasoningEffort, undefined);
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_REASONING_EFFORT: "" }).reasoningEffort, undefined);
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_REASONING_EFFORT: "none" }).reasoningEffort, "none");
  for (const bad of [{ CONVERSATION_REASONING_EFFORT: "off" }, { CONVERSATION_REASONING_EFFORT: "none", CONVERSATION_PROVIDER: "deepseek" }]) {
    assert.throws(() => chatStreamConfig({ ...env, ...bad }));
  }
  // Blank optional URLs, as in a copied .env.example, mean the defaults.
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_BASE_URL: "" }).url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_PROVIDER: "deepseek", CONVERSATION_BASE_URL: " ", AI_BASE_URL: "" }).url, "https://api.deepseek.com/chat/completions");
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_PROVIDER: "deepseek" }).url, "https://api.deepseek.com/chat/completions");
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_PROVIDER: "deepseek", AI_BASE_URL: "https://deep.test/v1/" }).url, "https://deep.test/v1/chat/completions");
  assert.equal(chatStreamConfig({ ...env, CONVERSATION_BASE_URL: "https://override.test/v1/" }).url, "https://override.test/v1/chat/completions");
  for (const patch of [
    { CONVERSATION_PROVIDER: "other" }, { CONVERSATION_MODEL: "" }, { CONVERSATION_MODEL: "has space" },
    { CONVERSATION_MODEL: "x".repeat(101) }, { GROQ_API_KEY: " " },
    ...["http://bad.test", "https://user:pass@bad.test", "https://bad.test/?secret", "https://bad.test/#fragment"].map(CONVERSATION_BASE_URL => ({ CONVERSATION_BASE_URL })),
  ]) assert.throws(() => chatStreamConfig({ ...env, ...patch }), category("local_configuration"));

  for (const provider of ["groq", "deepseek"] as const) {
    for (const temperature of [undefined, -3, 8]) {
      const fetch: typeof globalThis.fetch = async (url, init) => {
        assert.equal(url, provider === "groq" ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.deepseek.com/chat/completions");
        assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), `Bearer ${provider === "groq" ? "fake-key" : "fake-deepseek"}`);
        assert.equal(headers.get("content-type"), "application/json"); assert.equal(headers.get("accept"), "text/event-stream");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          model: "test/model:1", messages: input.messages, max_tokens: 120, temperature: temperature === undefined ? 0.7 : temperature < 0 ? 0 : 1.5,
          stream: true, stream_options: { include_usage: true }, ...(provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
        });
        return new Response(end);
      };
      await collect(fetch, { env: { ...env, CONVERSATION_PROVIDER: provider } }, { ...input, temperature });
    }
  }
  // With a reasoning effort set, Groq receives it; nothing else in the body changes.
  {
    const fetch: typeof globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.reasoning_effort, "none");
      assert.equal(body.thinking, undefined);
      return new Response(end);
    };
    await collect(fetch, { env: { ...env, CONVERSATION_REASONING_EFFORT: "none" } }, input);
  }
  const forbiddenFetch: typeof fetch = async () => { assert.fail("invalid input reached fetch"); };
  for (const data of [
    { ...input, messages: [] }, { ...input, messages: Array(41).fill(input.messages[0]) },
    { ...input, messages: [{ role: "user" as const, content: "" }] },
    { ...input, messages: [{ role: "user" as const, content: "x".repeat(8001) }] },
    ...[0, 401, 1.5].map(maxTokens => ({ ...input, maxTokens })),
  ]) await assert.rejects(() => collect(forbiddenFetch, {}, data), category("local_configuration"));

  const normal = event("café ☕", { model: "served", usage: { prompt_tokens: 4, completion_tokens: 5 } }) + end;
  const expected = [{ type: "delta", text: "café ☕" }, { type: "done", model: "served", finishReason: "stop", usage: { promptTokens: 4, completionTokens: 5, estimated: false } }];
  for (const bytewise of [false, true]) {
    assert.deepEqual(await collect(fixture(normal, bytewise).fetch), expected);
    assert.deepEqual(await collect(fixture(": comment\r\n\r\nother: ignored\r\n" + normal.replace(/\n/g, "\r\n"), bytewise).fetch), expected);
  }
  assert.deepEqual(await collect(fixture(event("café ☕", { model: "served", x_groq: { usage: { prompt_tokens: 4, completion_tokens: 5 } } }) + end).fetch), expected);
  const estimated = await collect(fixture(event("abcd") + end).fetch);
  assert.deepEqual(estimated[1], { type: "done", model: "test/model:1", finishReason: "stop", usage: { promptTokens: 2, completionTokens: 2, estimated: true } });
  const unsafe = await collect(fixture('data: {"choices":[{"delta":{"content":"x"},"finish_reason":"<bad>"}]}\n' + end).fetch);
  assert.equal("finishReason" in unsafe[1], false);
  for (const status of [429, 500, 401]) {
    await assert.rejects(() => collect(async () => new Response("CANARY provider body", { status })), category(categoryForStatus(status), status));
  }
  for (const text of ["data: {broken}\n", ": only comment\n", 'data: {"choices":[]}\n']) {
    await assert.rejects(() => collect(fixture(text).fetch), category("invalid_provider_response"));
  }
  await assert.rejects(() => collect(async () => new Response(null)), category("invalid_provider_response"));
  assert.equal((await collect(fixture(event("accepted")).fetch)).at(-1)?.type, "done");
  await assert.rejects(() => collect(async () => { throw new TypeError("CANARY network"); }), category("network_error"));

  const first = fixture("", false, true);
  await assert.rejects(() => collect(first.fetch, { firstTokenTimeoutMs: 5, totalTimeoutMs: 100 }), category("network_timeout"));
  assert.equal(first.cancelled(), true);
  const total = fixture(event("first"), false, true);
  await assert.rejects(() => collect(total.fetch, { firstTokenTimeoutMs: 100, totalTimeoutMs: 10 }), category("network_timeout"));
  assert.equal(total.cancelled(), true);
  let abortedRequest = false;
  await assert.rejects(() => collect(async (_url, init) => {
    init?.signal?.addEventListener("abort", () => { abortedRequest = true; });
    return new Promise<Response>(() => {});
  }, { firstTokenTimeoutMs: 5 }), category("network_timeout"));
  assert.equal(abortedRequest, true);
  const controller = new AbortController();
  const pending = collect(fixture("", false, true).fetch, { signal: controller.signal });
  controller.abort();
  await assert.rejects(() => pending, category("network_error"));
  const alreadyAborted = new AbortController(); alreadyAborted.abort();
  await assert.rejects(() => collect(forbiddenFetch, { signal: alreadyAborted.signal }), category("network_error"));

  const runaway = fixture(event("x".repeat(5000)), false, true);
  const capped = await collect(runaway.fetch);
  assert.equal(capped.filter(e => e.type === "delta").map(e => e.text).join("").length, 4000);
  assert.equal(capped.filter(e => e.type === "done").length, 1); assert.equal(runaway.cancelled(), true);
  const early = fixture(event("first") + event("second"), false, true);
  const iterator = streamChat(input, { env, fetch: early.fetch });
  assert.equal((await iterator.next()).value?.type, "delta");
  await iterator.return(undefined);
  assert.equal(early.cancelled(), true);
  console.log("PASS chat stream: configuration, request, byte streaming, usage, errors, timeouts, abort, cap and cleanup (offline)");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
