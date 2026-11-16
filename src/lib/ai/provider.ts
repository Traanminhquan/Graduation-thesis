export const MAX_TOKENS = 1600;
export const safeFinishReason = (value: unknown): string | undefined =>
  typeof value === "string" && ["stop", "length", "tool_calls", "function_call", "content_filter", "error"].includes(value) ? value : undefined;
type ShapeType = "undefined" | "null" | "array" | "object" | "string" | "number" | "boolean" | "other";
const shapeType = (value: unknown): ShapeType => value === null ? "null" : Array.isArray(value) ? "array" : ["undefined", "object", "string", "number", "boolean"].includes(typeof value) ? typeof value as ShapeType : "other";
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export type ResponseShape = { status: number; bodyType: ShapeType; choicesType: ShapeType; choiceCount: number; contentType: ShapeType; contentLength: number; usageType: ShapeType; errorPresent: boolean; finishReason?: string };
export function describeResponseShape(parsed: unknown, status: number): ResponseShape {
  const body = object(parsed); const choices = body.choices; const first = object(Array.isArray(choices) ? choices[0] : undefined);
  const content = object(first.message).content;
  return { status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0, bodyType: shapeType(parsed), choicesType: shapeType(choices), choiceCount: Array.isArray(choices) ? choices.length : 0, contentType: shapeType(content), contentLength: typeof content === "string" ? content.length : 0, usageType: shapeType(body.usage), errorPresent: body.error !== undefined, finishReason: safeFinishReason(first.finish_reason) };
}
export function formatResponseShape(shape: ResponseShape): string {
  const type = (v: ShapeType) => ["undefined", "null", "array", "object", "string", "number", "boolean", "other"].includes(v) ? v : "other";
  const count = (v: number) => Number.isSafeInteger(v) && v >= 0 ? v : 0;
  return `http_status=${count(shape.status)} body_type=${type(shape.bodyType)} choices_type=${type(shape.choicesType)} choices_count=${count(shape.choiceCount)} content_type=${type(shape.contentType)} content_length=${count(shape.contentLength)} usage_type=${type(shape.usageType)} error_present=${shape.errorPresent === true} finish_reason=${safeFinishReason(shape.finishReason) ?? "unknown"}`;
}
export type FailureCategory =
  | "local_configuration" | "authentication" | "billing_restriction" | "forbidden" | "rate_limited"
  | "model_or_json_mode_unsupported" | "model_or_endpoint_unavailable" | "provider_server_error" | "http_error"
  | "network_timeout" | "network_error" | "invalid_provider_response" | "provider_error_in_body" | "provider_error";
export type FailureDetails = { category: FailureCategory; status?: number; requestId?: string };
export class ProviderError extends Error {
  constructor(public retryable: boolean, public details: FailureDetails = { category: retryable ? "network_timeout" : "provider_error" }) { super("AI provider unavailable"); }
}
// Only short opaque ids are ever surfaced; anything else is dropped.
const safeId = (value: unknown) => (typeof value === "string" && /^[A-Za-z0-9._:-]{6,128}$/.test(value) ? value : undefined);
export function categoryForStatus(status: number): FailureCategory {
  if (status === 401) return "authentication";
  if (status === 402) return "billing_restriction";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  if (status === 400) return "model_or_json_mode_unsupported";
  if (status === 404) return "model_or_endpoint_unavailable";
  if (status >= 500 && status <= 599) return "provider_server_error";
  return "http_error";
}
export type ProviderInput = { model: string; messages: { role: string; content: string }[]; max_tokens: number };
export type ProviderResult = { text: string; promptTokens: number; completionTokens: number; model?: string; costUsd?: number; requestId?: string; finishReason?: string; reasoningTokens?: number };
// Fixed free model used for reliable live tests (the router id picks a random free model, which may be a reasoning model).
export const PINNED_FREE_MODEL = "google/gemma-4-26b-a4b-it:free";
export const FREE_MODEL_ALLOWLIST: readonly string[] = Object.freeze([PINNED_FREE_MODEL, "openrouter/free"]);
export function providerConfig(env: NodeJS.ProcessEnv) {
  const provider = env.AI_PROVIDER ?? "deepseek";
  if (provider !== "deepseek" && provider !== "openrouter") throw new Error("Unsupported AI provider");
  const model = env.AI_MODEL || (provider === "openrouter" ? PINNED_FREE_MODEL : "deepseek-flash");
  const freeTest = env.AI_FREE_TEST_MODE === "true";
  if ((freeTest && (provider !== "openrouter" || !FREE_MODEL_ALLOWLIST.includes(model))) || (provider === "openrouter" && !freeTest)) throw new Error("AI free test requires openrouter, AI_FREE_TEST_MODE=true and an allowlisted model");
  return { provider, model, freeTest };
}
export class FreeModelRejection extends Error {
  constructor(public reason: "model_missing" | "model_not_free" | "model_mismatch" | "cost_reported", public servedModel?: string, public reportedCostUsd?: number) { super("AI free test response violated free-only policy"); }
}
export function assertFreeResponse(result: ProviderResult, requested?: string) {
  if (!result.model) throw new FreeModelRejection("model_missing");
  if (!FREE_MODEL_ALLOWLIST.includes(result.model) && !result.model.endsWith(":free")) throw new FreeModelRejection("model_not_free", result.model);
  // A pinned request must be served by that exact model (or its dated :free alias), never by a substitute.
  if (requested && requested !== "openrouter/free") {
    const base = requested.replace(/:free$/, "");
    const datedAlias = result.model.startsWith(`${base}-`) && /^[0-9]{8}:free$/.test(result.model.slice(base.length + 1));
    if (result.model !== requested && !datedAlias) throw new FreeModelRejection("model_mismatch", result.model);
  }
  if ((result.costUsd ?? 0) > 0) throw new FreeModelRejection("cost_reported", result.model, result.costUsd);
}
export function providerFromEnv(env: NodeJS.ProcessEnv): Provider {
  return providerConfig(env).provider === "openrouter" ? openRouterProvider(env) : deepSeekProvider(env);
}
export function openRouterProvider(env: NodeJS.ProcessEnv): Provider {
  return async (input, signal) => {
    const config = providerConfig(env);
    if (config.provider !== "openrouter" || input.model !== config.model || !env.AI_API_KEY) throw new ProviderError(false, { category: "local_configuration" });
    let response: Response;
    try { response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal, headers: { Authorization: `Bearer ${env.AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: input.model, messages: input.messages, max_tokens: input.max_tokens, response_format: { type: "json_object" }, temperature: 0 }),
    }); } catch (error) {
      if (signal.aborted || (error as { name?: string } | null)?.name === "AbortError") throw new ProviderError(true, { category: "network_timeout" });
      throw new ProviderError(false, { category: "network_error" });
    }
    const headerId = safeId(response.headers.get("x-request-id"));
    if (!response.ok) throw new ProviderError(response.status >= 500 && response.status <= 599, { category: categoryForStatus(response.status), status: response.status, requestId: headerId });
    const body = await response.json().catch(() => undefined);
    if (body == null || typeof body !== "object") throw new ProviderError(false, { category: "invalid_provider_response", requestId: headerId });
    const trace = headerId ?? safeId(body.id);
    // OpenRouter can answer HTTP 200 with an error object; surface only its numeric code.
    if (body.error !== undefined) { const code = body.error?.code; throw new ProviderError(false, { category: "provider_error_in_body", status: Number.isInteger(code) && code >= 100 && code <= 599 ? code : undefined, requestId: trace }); }
    const promptTokens = body?.usage?.prompt_tokens;
    const completionTokens = body?.usage?.completion_tokens;
    const costUsd = body?.usage?.cost;
    const choice = body?.choices?.[0]; const content = choice?.message?.content;
    const rawFinish = choice?.finish_reason; const finishReason = safeFinishReason(rawFinish);
    const rawReasoning = body?.usage?.completion_tokens_details?.reasoning_tokens; const reasoningTokens = Number.isSafeInteger(rawReasoning) && rawReasoning >= 0 ? rawReasoning : undefined;
    if (!choice || typeof choice !== "object" || (typeof content !== "string" && content != null) || !Number.isSafeInteger(promptTokens) || promptTokens < 0 || !Number.isSafeInteger(completionTokens) || completionTokens < 0 || (costUsd !== undefined && (typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0))) throw new ProviderError(false, { category: "invalid_provider_response", requestId: trace });
    return { text: typeof content === "string" ? content : "", promptTokens, completionTokens, ...(finishReason ? { finishReason } : {}), ...(reasoningTokens !== undefined ? { reasoningTokens } : {}), ...(typeof body.model === "string" ? { model: body.model } : {}), ...(costUsd !== undefined ? { costUsd } : {}), ...(trace ? { requestId: trace } : {}) };
  };
}
export type Provider = (input: ProviderInput, signal: AbortSignal) => Promise<ProviderResult>;
export function deepSeekProvider(env: NodeJS.ProcessEnv): Provider {
  return async (input, signal) => {
    if (!env.AI_API_KEY) throw new ProviderError(false, { category: "local_configuration" });
    let response: Response;
    // A dropped connection or DNS failure must be classified like any other provider failure, not escape as a raw TypeError.
    try { response = await fetch(`${(env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`, {
      method: "POST", signal, headers: { Authorization: `Bearer ${env.AI_API_KEY}`, "Content-Type": "application/json" },
      // Disable thinking so the token cap is available for the JSON answer.
      body: JSON.stringify({ ...input, response_format: { type: "json_object" }, temperature: 0, thinking: { type: "disabled" } }),
    }); } catch (error) {
      if (signal.aborted || (error as { name?: string } | null)?.name === "AbortError") throw new ProviderError(true, { category: "network_timeout" });
      throw new ProviderError(false, { category: "network_error" });
    }
    if (!response.ok) throw new ProviderError(response.status >= 500 && response.status <= 599, { category: categoryForStatus(response.status), status: response.status });
    const body = await response.json().catch(() => undefined);
    if (body == null || typeof body !== "object") throw new ProviderError(false, { category: "invalid_provider_response" });
    const promptTokens = body.usage?.prompt_tokens;
    const completionTokens = body.usage?.completion_tokens;
    if (typeof body.choices?.[0]?.message?.content !== "string" || !Number.isSafeInteger(promptTokens) || promptTokens < 0 || !Number.isSafeInteger(completionTokens) || completionTokens < 0) throw new ProviderError(false);
    const rawFinish = body.choices[0]?.finish_reason;
    const finishReason = safeFinishReason(rawFinish);
    return { text: body.choices[0].message.content, promptTokens, completionTokens, ...(finishReason ? { finishReason } : {}) };
  };
}
export async function timedCall(provider: Provider, input: ProviderInput, timeout: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([provider(input, controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new ProviderError(true)); }, timeout);
    })]);
  } finally { clearTimeout(timer); }
}
