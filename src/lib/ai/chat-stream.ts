import { ProviderError, categoryForStatus, type FailureCategory } from "./provider";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatStreamInput = { messages: ChatMessage[]; maxTokens: number; temperature?: number };
export type ChatUsage = { promptTokens: number; completionTokens: number; estimated: boolean };
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; usage: ChatUsage; model: string; finishReason?: string };
export type ChatStreamDeps = {
  env: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  firstTokenTimeoutMs?: number;
  totalTimeoutMs?: number;
};

const failure = (category: FailureCategory) => new ProviderError(category === "network_timeout", { category });
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};

/** Values Groq documents for `reasoning_effort`; which ones a model accepts depends on the model. */
const REASONING_EFFORTS = ["none", "default", "low", "medium", "high"] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function chatStreamConfig(env: NodeJS.ProcessEnv): { provider: "groq" | "deepseek"; url: string; apiKey: string; model: string; reasoningEffort?: ReasoningEffort } {
  const provider = env.CONVERSATION_PROVIDER?.trim() || "groq";
  const model = env.CONVERSATION_MODEL?.trim() || "";
  if ((provider !== "groq" && provider !== "deepseek") || !/^[A-Za-z0-9._:/-]{1,100}$/.test(model)) throw failure("local_configuration");
  const apiKey = (provider === "groq" ? env.GROQ_API_KEY : env.AI_API_KEY)?.trim();
  if (!apiKey) throw failure("local_configuration");
  // Blank means unset, as in a copied .env.example.
  const base = env.CONVERSATION_BASE_URL?.trim() || (provider === "groq" ? "https://api.groq.com/openai/v1" : env.AI_BASE_URL?.trim() || "https://api.deepseek.com");
  try {
    const parsed = new URL(base);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash || base.includes("?") || base.includes("#")) throw new Error();
  } catch { throw failure("local_configuration"); }
  // Reasoning models spend reply tokens on thinking; for a spoken reply it is switched off where the model allows.
  const effort = env.CONVERSATION_REASONING_EFFORT?.trim() || undefined;
  if (effort !== undefined && (provider !== "groq" || !(REASONING_EFFORTS as readonly string[]).includes(effort))) throw failure("local_configuration");
  return { provider, url: `${base.replace(/\/+$/, "")}/chat/completions`, apiKey, model, ...(effort ? { reasoningEffort: effort as ReasoningEffort } : {}) };
}

export async function* streamChat(input: ChatStreamInput, deps: ChatStreamDeps): AsyncGenerator<ChatStreamEvent> {
  const config = chatStreamConfig(deps.env);
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > 40 ||
    input.messages.some(m => !m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string" || !m.content.length || m.content.length > 8000) ||
    !Number.isInteger(input.maxTokens) || input.maxTokens < 1 || input.maxTokens > 400 ||
    (input.temperature !== undefined && !Number.isFinite(input.temperature))) throw failure("local_configuration");

  const controller = new AbortController();
  let timedOut = false;
  let rejectAbort: (error: ProviderError) => void = () => {};
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  // A timeout can fire while the consumer is paused at a yield.
  void aborted.catch(() => {});
  const abort = () => { controller.abort(); rejectAbort(failure(timedOut ? "network_timeout" : "network_error")); };
  const timeout = () => { timedOut = true; abort(); };
  const firstTimer = setTimeout(timeout, deps.firstTokenTimeoutMs ?? 8000);
  const totalTimer = setTimeout(timeout, deps.totalTimeoutMs ?? 30000);
  deps.signal?.addEventListener("abort", abort, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let replyLength = 0;
  let model = config.model;
  let finishReason: string | undefined;
  let usage: ChatUsage | undefined;
  let finished = false;
  const parseLine = (line: string): string | undefined => {
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).replace(/^ /, "");
    if (data === "[DONE]") { finished = true; return; }
    let payload: Record<string, unknown>;
    try { payload = object(JSON.parse(data)); } catch { throw failure("invalid_provider_response"); }
    const choice = object(Array.isArray(payload.choices) ? payload.choices[0] : undefined);
    if (typeof payload.model === "string") model = payload.model;
    if (typeof choice.finish_reason === "string" && /^[a-z_]{1,32}$/.test(choice.finish_reason)) finishReason = choice.finish_reason;
    for (const candidate of [payload.usage, object(payload.x_groq).usage]) {
      const value = object(candidate);
      if (typeof value.prompt_tokens === "number" && Number.isFinite(value.prompt_tokens) && value.prompt_tokens >= 0 &&
        typeof value.completion_tokens === "number" && Number.isFinite(value.completion_tokens) && value.completion_tokens >= 0) {
        usage = { promptTokens: value.prompt_tokens, completionTokens: value.completion_tokens, estimated: false };
        break;
      }
    }
    const content = object(choice.delta).content;
    if (typeof content === "string" && content.length) return content;
  };
  try {
    if (deps.signal?.aborted) abort();
    if (controller.signal.aborted) throw failure("network_error");
    const response = await Promise.race([(deps.fetch ?? fetch)(config.url, {
      method: "POST", signal: controller.signal, redirect: "error",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ model: config.model, messages: input.messages, max_tokens: input.maxTokens,
        temperature: Math.min(1.5, Math.max(0, input.temperature ?? 0.7)), stream: true, stream_options: { include_usage: true },
        ...(config.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
        ...(config.reasoningEffort ? { reasoning_effort: config.reasoningEffort } : {}) }),
    }), aborted]);
    if (!response.ok) throw new ProviderError(response.status >= 500 && response.status <= 599, { category: categoryForStatus(response.status), status: response.status });
    if (!response.body) throw failure("invalid_provider_response");
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!finished) {
      const chunk = await Promise.race([reader.read(), aborted]);
      buffer += chunk.done ? decoder.decode() : decoder.decode(chunk.value, { stream: true });
      let newline: number;
      while (!finished && ((newline = buffer.indexOf("\n")) >= 0 || (chunk.done && buffer.length > 0))) {
        const line = newline >= 0 ? buffer.slice(0, newline) : buffer;
        buffer = newline >= 0 ? buffer.slice(newline + 1) : "";
        const text = parseLine(line);
        if (text) {
          clearTimeout(firstTimer);
          const capped = text.slice(0, 4000 - replyLength);
          replyLength += capped.length;
          if (replyLength >= 4000) {
            finished = true;
            clearTimeout(totalTimer);
            void reader.cancel().catch(() => {});
            controller.abort();
          }
          yield { type: "delta", text: capped };
        }
      }
      if (chunk.done) break;
    }
    if (!finished && replyLength === 0) throw failure("invalid_provider_response");
    if (controller.signal.aborted && !finished) await aborted;
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
    yield { type: "done", usage: usage ?? {
      promptTokens: Math.ceil(input.messages.reduce((sum, m) => sum + m.content.length, 0) / 3),
      completionTokens: Math.ceil(replyLength / 3), estimated: true,
    }, model, ...(finishReason ? { finishReason } : {}) };
  } catch (error) {
    if (timedOut) throw failure("network_timeout");
    if (error instanceof ProviderError) throw error;
    throw failure("network_error");
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
    deps.signal?.removeEventListener("abort", abort);
    controller.abort();
    if (reader) {
      void reader.cancel().catch(() => {});
      // Never let cleanup replace the error that is already on its way out.
      try { reader.releaseLock(); } catch { /* a read may still be pending */ }
    }
  }
}
