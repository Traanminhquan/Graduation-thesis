import { FreeModelRejection, ProviderError, safeFinishReason } from "./provider";
import { IntegrationConfigError } from "./integration-guard";

// Sanitized failure diagnosis. Never includes keys, headers, request/response bodies,
// learner text, model output or raw provider/exception messages: only fixed category
// names, a numeric HTTP status, a validated request id and a few fixed detail strings.
export type Diagnosis = { category: string; status?: number; requestId?: string; detail?: string };

const SCHEMA_MESSAGES = new Set(["Invalid AI JSON", "Invalid AI score", "Unexpected AI field", "Invalid AI feedback", "Invalid AI correction"]);
const LOCAL_CONFIG_MESSAGES = new Set([
  "Unsupported AI provider",
  "AI free test requires openrouter, AI_FREE_TEST_MODE=true and an allowlisted model",
  "Invalid AI timeout",
  "Free integration prerequisites missing",
]);
const safeModel = (value?: string) => (value && /^[A-Za-z0-9._:/@+-]{1,100}$/.test(value) ? value : "unprintable");

export function diagnose(error: unknown): Diagnosis {
  if (error instanceof IntegrationConfigError) return { category: "local_configuration_rejection", detail: error.problems.join("; ") };
  if (error instanceof FreeModelRejection) {
    const parts = [`reason=${error.reason}`];
    if (error.servedModel !== undefined) parts.push(`served_model=${safeModel(error.servedModel)}`);
    if (typeof error.reportedCostUsd === "number" && Number.isFinite(error.reportedCostUsd)) parts.push(`reported_cost_usd=${error.reportedCostUsd}`);
    return { category: "free_model_verification_rejected", detail: parts.join(" ") };
  }
  if (error instanceof ProviderError) {
    const { category, status, requestId } = error.details;
    return { category: category === "local_configuration" ? "local_configuration_rejection" : category, status, requestId };
  }
  if (error instanceof SyntaxError) return { category: "invalid_json" };
  if (error instanceof Error && SCHEMA_MESSAGES.has(error.message)) return { category: "schema_validation_failed", detail: error.message };
  if (error instanceof Error && LOCAL_CONFIG_MESSAGES.has(error.message)) return { category: "local_configuration_rejection", detail: error.message };
  return { category: "unexpected_error" };
}

export function formatDiagnosis(diagnosis: Diagnosis): string {
  let line = `FAIL category=${diagnosis.category}`;
  if (diagnosis.status !== undefined) line += ` http_status=${diagnosis.status}`;
  if (diagnosis.requestId) line += ` request_id=${diagnosis.requestId}`;
  if (diagnosis.detail) line += ` detail=${diagnosis.detail}`;
  return line;
}


// ---- Assessment-level sanitized diagnosis (what happened between provider response and persistence) ----
export type AssessmentCategory =
  | "completion_truncated" | "empty_model_output" | "invalid_json" | "schema_validation_failed"
  | "free_model_rejected" | "persistence_failed" | "provider_error" | "request_refused" | "unexpected_error";
export type AssessmentDiagnosis = {
  category: AssessmentCategory; detail?: string; providerCategory?: string; httpStatus?: number; requestId?: string;
  finishReason?: string; servedModel?: string; promptTokens?: number; completionTokens?: number; reasoningTokens?: number;
  jsonParse: "skipped" | "ok" | "failed"; schemaValidation: "skipped" | "ok" | "failed"; persistence: "not_attempted" | "saved" | "failed";
};
/** Thrown by the assessment flow; carries only a fixed category and an optional fixed detail string. */
export class AssessmentFailure extends Error {
  constructor(public category: AssessmentCategory, public detail?: string) { super("AI feedback unavailable, try again"); }
}
const REFUSALS = new Set([
  "Invalid AI budget period", "AI assessment already in progress",
  "AI pricing unavailable: configure both per-million-token prices", "AI pilot budget exceeded", "Daily AI assessment limit reached",
  "Invalid AI pilot budget", "Invalid AI timeout", "Invalid AI max attempts", "AI provider not configured", "Unsupported AI provider",
  "AI free test requires openrouter, AI_FREE_TEST_MODE=true and an allowlisted model", "Submission unavailable", "Invalid submitted text", "AI unavailable",
]);
export function classifyAssessmentFailure(error: unknown, base: AssessmentDiagnosis): AssessmentDiagnosis {
  const d: AssessmentDiagnosis = { ...base };
  if (error instanceof AssessmentFailure) {
    d.category = error.category;
    if (error.detail === "at_token_cap" || (error.detail !== undefined && SCHEMA_MESSAGES.has(error.detail))) d.detail = error.detail;
    return d;
  }
  if (error instanceof FreeModelRejection) { d.category = "free_model_rejected"; d.detail = `reason=${error.reason}`; return d; }
  if (error instanceof ProviderError) { d.category = "provider_error"; d.providerCategory = error.details.category; d.httpStatus = error.details.status; d.requestId = error.details.requestId ?? d.requestId; return d; }
  if (error instanceof Error && error.message === "Invalid AI usage") { d.category = "provider_error"; d.detail = "invalid_usage"; return d; }
  if (error instanceof Error && REFUSALS.has(error.message)) { d.category = "request_refused"; d.detail = error.message; return d; }
  d.category = "unexpected_error";
  return d;
}
const intField = (value: unknown) => (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : undefined);
export function sanitizeAssessmentDiagnosis(d: AssessmentDiagnosis): AssessmentDiagnosis {
  const categories = ["completion_truncated", "empty_model_output", "invalid_json", "schema_validation_failed", "free_model_rejected", "persistence_failed", "provider_error", "request_refused", "unexpected_error"];
  const detail = d.detail && (REFUSALS.has(d.detail) || SCHEMA_MESSAGES.has(d.detail) || ["at_token_cap", "invalid_usage", "reason=model_missing", "reason=model_not_free", "reason=model_mismatch", "reason=cost_reported"].includes(d.detail)) ? d.detail : undefined;
  const providerCategories = ["local_configuration", "authentication", "billing_restriction", "forbidden", "rate_limited", "model_or_json_mode_unsupported", "model_or_endpoint_unavailable", "provider_server_error", "http_error", "network_timeout", "network_error", "invalid_provider_response", "provider_error_in_body", "provider_error"];
  return { category: categories.includes(d.category) ? d.category : "unexpected_error", detail,
    providerCategory: d.providerCategory && providerCategories.includes(d.providerCategory) ? d.providerCategory : undefined,
    httpStatus: d.httpStatus !== undefined && d.httpStatus >= 100 && d.httpStatus <= 599 && Number.isInteger(d.httpStatus) ? d.httpStatus : undefined,
    requestId: d.requestId && /^[A-Za-z0-9._:-]{6,128}$/.test(d.requestId) ? d.requestId : undefined,
    finishReason: safeFinishReason(d.finishReason), servedModel: d.servedModel ? safeModel(d.servedModel) : undefined,
    promptTokens: intField(d.promptTokens) === undefined ? undefined : d.promptTokens,
    completionTokens: intField(d.completionTokens) === undefined ? undefined : d.completionTokens,
    reasoningTokens: intField(d.reasoningTokens) === undefined ? undefined : d.reasoningTokens,
    jsonParse: ["skipped", "ok", "failed"].includes(d.jsonParse) ? d.jsonParse : "skipped",
    schemaValidation: ["skipped", "ok", "failed"].includes(d.schemaValidation) ? d.schemaValidation : "skipped",
    persistence: ["not_attempted", "saved", "failed"].includes(d.persistence) ? d.persistence : "not_attempted" };
}
export function formatAssessmentDiagnosis(input: AssessmentDiagnosis): string {
  const d = sanitizeAssessmentDiagnosis(input);
  const parts = [`[writing-ai] category=${d.category}`];
  const add = (key: string, value?: string) => { if (value !== undefined) parts.push(`${key}=${value}`); };
  add("finish_reason", typeof d.finishReason === "string" && /^[a-z_]{1,32}$/.test(d.finishReason) ? d.finishReason : undefined);
  add("served_model", d.servedModel ? safeModel(d.servedModel) : undefined);
  add("prompt_tokens", intField(d.promptTokens)); add("completion_tokens", intField(d.completionTokens)); add("reasoning_tokens", intField(d.reasoningTokens));
  parts.push(`json_parse=${d.jsonParse}`, `schema_validation=${d.schemaValidation}`, `persistence=${d.persistence}`);
  add("provider_category", d.providerCategory && /^[a-z_]{1,40}$/.test(d.providerCategory) ? d.providerCategory : undefined);
  add("http_status", intField(d.httpStatus));
  add("request_id", d.requestId && /^[A-Za-z0-9._:-]{6,128}$/.test(d.requestId) ? d.requestId : undefined);
  add("detail", d.detail && /^[A-Za-z0-9_= .:,-]{1,120}$/.test(d.detail) ? d.detail : undefined);
  return parts.join(" ");
}
