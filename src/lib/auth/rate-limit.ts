import { type Locale } from "@/i18n/config";
import { authMessages } from "@/i18n/messages/auth";

/**
 * In-memory sliding-window rate limiter for auth and learning actions.
 *
 * Scope and limits (deliberate):
 * - State lives in this server process: it resets on restart and is not shared
 *   between serverless instances. Good enough for a single `next start`.
 * - The client address comes from `x-forwarded-for`, which a direct client can
 *   forge. The per-email limit therefore carries the protection against
 *   guessing one account; the per-address limit only slows bulk traffic.
 * - Limits are generous because a classroom usually shares one address.
 */

export type RateLimitRule = { limit: number; windowMs: number };

export type RateLimitDecision = { ok: true } | { ok: false; retryAfterSeconds: number };

const MINUTE = 60_000;

export const LOGIN_ADDRESS_RULE: RateLimitRule = { limit: 60, windowMs: 15 * MINUTE };
export const LOGIN_EMAIL_FAILURE_RULE: RateLimitRule = { limit: 8, windowMs: 15 * MINUTE };
export const PASSWORD_CHANGE_FAILURE_RULE: RateLimitRule = { limit: 8, windowMs: 15 * MINUTE };
export const PROFILE_UPDATE_RULE: RateLimitRule = { limit: 20, windowMs: 15 * MINUTE };
export const REGISTER_ADDRESS_RULE: RateLimitRule = { limit: 30, windowMs: 60 * MINUTE };

export const ATTEMPT_RULE: RateLimitRule = { limit: 30, windowMs: 10 * MINUTE };
export const SUBMISSION_RULE: RateLimitRule = { limit: 20, windowMs: 60 * MINUTE };
export const RETRY_RULE: RateLimitRule = { limit: 60, windowMs: 10 * MINUTE };

/** Hard ceiling on tracked keys so forged addresses cannot grow memory without bound. */
const MAX_KEYS = 10_000;

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  /** Hits for `key` that are still inside the window. */
  private recent(key: string, windowMs: number, now: number): number[] {
    const kept = (this.hits.get(key) ?? []).filter((at) => now - at < windowMs);
    if (kept.length > 0) this.hits.set(key, kept);
    else this.hits.delete(key);
    return kept;
  }

  /** Whether `key` is currently over its limit. Does not record anything. */
  check(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitDecision {
    const kept = this.recent(key, rule.windowMs, now);
    if (kept.length < rule.limit) return { ok: true };
    // The oldest counted hit decides when one slot becomes free again.
    const oldest = kept[kept.length - rule.limit];
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000)) };
  }

  /** Records one hit for `key`. */
  record(key: string, rule: RateLimitRule, now: number = Date.now()): void {
    const kept = this.recent(key, rule.windowMs, now);
    kept.push(now);
    // Never keep more timestamps than the limit needs.
    this.hits.set(key, kept.slice(-rule.limit));
    if (this.hits.size > MAX_KEYS) this.evict();
  }

  /** `check`, then `record` when allowed. */
  consume(key: string, rule: RateLimitRule, now: number = Date.now()): RateLimitDecision {
    const decision = this.check(key, rule, now);
    if (decision.ok) this.record(key, rule, now);
    return decision;
  }

  /** Forgets `key` (used after a successful login). */
  reset(key: string): void {
    this.hits.delete(key);
  }

  get size(): number {
    return this.hits.size;
  }

  /** Drops the oldest tenth of the keys (Map keeps insertion order). */
  private evict(): void {
    let remaining = Math.ceil(MAX_KEYS / 10);
    for (const key of this.hits.keys()) {
      if (remaining-- <= 0) break;
      this.hits.delete(key);
    }
  }
}

/** One limiter per server process, shared across hot reloads in development. */
const globalForLimiter = globalThis as unknown as { authRateLimiter?: RateLimiter };
export const authRateLimiter = (globalForLimiter.authRateLimiter ??= new RateLimiter());

/**
 * Best-effort client address: the first `x-forwarded-for` hop, bounded in
 * length so a forged header cannot be used as a large map key.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return address.slice(0, 64);
}

export function limitMessage(decision: { retryAfterSeconds: number }, locale: Locale): string {
  return authMessages[locale].tooMany(Math.ceil(decision.retryAfterSeconds / 60));
}

export function tooManyRequests(decision: { retryAfterSeconds: number }, locale: Locale = "en"): Response {
  return Response.json(
    { error: limitMessage(decision, locale) },
    { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
  );
}
