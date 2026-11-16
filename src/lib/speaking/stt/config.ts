export type SttReason = "disabled" | "unauthenticated" | "invalid_audio" | "duration_unverifiable" | "invalid_duration" | "too_large" | "configuration" | "daily_cap" | "request_budget" | "pilot_budget" | "unavailable" | "timeout" | "rate_limited" | "provider_error" | "invalid_response" | "no_speech";
export class SttError extends Error {
  constructor(public readonly reason: SttReason) { super(reason); }
}
/** The recorder stops at the limit, but the recorded audio can run a fraction of a second over it. */
export const STT_DURATION_TOLERANCE_SECONDS = 2;
export function sttConfig(env: NodeJS.ProcessEnv) {
  if (env.SPEAKING_STT_ENABLED !== "true") throw new SttError("disabled");
  const price = Number(env.SPEAKING_STT_PRICE_PER_HOUR_USD);
  if (!env.GROQ_API_KEY?.trim() || !Number.isFinite(price) || price <= 0) throw new SttError("configuration");
  // An optional setting left blank (as in a copied `.env.example`) means "use the default".
  const unset = (name: string) => env[name] === undefined || env[name]?.trim() === "";
  const lower = (name: string, ceiling: number) => {
    const value = unset(name) ? ceiling : Number(env[name]);
    if (!Number.isFinite(value) || value <= 0 || value > ceiling) throw new SttError("configuration");
    return value;
  };
  const minBilled = unset("SPEAKING_STT_MIN_BILLED_SECONDS") ? 10 : Number(env.SPEAKING_STT_MIN_BILLED_SECONDS);
  if (!Number.isFinite(minBilled) || minBilled < 10) throw new SttError("configuration");
  return { price, minBilled, maxSeconds: lower("SPEAKING_STT_MAX_SECONDS", 120), maxBytes: lower("SPEAKING_STT_MAX_BYTES", 10 * 1024 * 1024), dailyCap: lower("SPEAKING_STT_DAILY_CAP", 5), requestCap: lower("SPEAKING_STT_REQUEST_CAP_USD", 0.01), pilotCap: lower("SPEAKING_STT_PILOT_CAP_USD", 1) };
}
