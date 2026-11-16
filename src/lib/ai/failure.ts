export type AiFailureCode = "limit" | "busy" | "unavailable";

export function aiFailureCode(result: { message?: string; diagnosis?: { category?: string; providerCategory?: string } }): AiFailureCode {
  if (result.message === "Daily AI assessment limit reached" || result.message === "AI pilot budget exceeded") return "limit";
  if (result.message === "AI assessment already in progress") return "busy";
  const { category, providerCategory } = result.diagnosis ?? {};
  if ([category, providerCategory].some(value => value === "rate_limited" || value === "network_timeout")) return "busy";
  return "unavailable";
}
