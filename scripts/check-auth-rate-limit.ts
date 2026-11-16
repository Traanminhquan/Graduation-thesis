/**
 * Offline checks for the auth rate limiter (T-016). No network, no database:
 * the route handlers are only driven down paths that return before any query.
 *
 *   npx tsx scripts/check-auth-rate-limit.ts
 */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";

import {
  authRateLimiter,
  clientAddress,
  LOGIN_ADDRESS_RULE,
  LOGIN_EMAIL_FAILURE_RULE,
  RateLimiter,
  PASSWORD_CHANGE_FAILURE_RULE,
  REGISTER_ADDRESS_RULE,
  tooManyRequests,
} from "../src/lib/auth/rate-limit";

const rule = { limit: 3, windowMs: 1000 };

// Sliding window: the limit-th hit is allowed, the next one is not.
{
  const limiter = new RateLimiter();
  for (let i = 0; i < 3; i++) assert.deepEqual(limiter.consume("k", rule, 100 + i), { ok: true });
  const blocked = limiter.consume("k", rule, 200);
  assert.equal(blocked.ok, false);
  // Oldest hit at t=100 leaves the window at t=1100: 900 ms away, rounded up.
  assert.deepEqual(blocked, { ok: false, retryAfterSeconds: 1 });
  // A blocked attempt is not recorded, so the window is not extended by retries.
  assert.equal(limiter.consume("k", rule, 1099).ok, false);
  assert.equal(limiter.consume("k", rule, 1100).ok, true);
  // Keys are independent.
  assert.equal(limiter.consume("other", rule, 200).ok, true);
}

// check() never records; record() and reset() behave as the login route needs.
{
  const limiter = new RateLimiter();
  for (let i = 0; i < 10; i++) assert.equal(limiter.check("k", rule, i).ok, true);
  for (let i = 0; i < 3; i++) limiter.record("k", rule, i);
  assert.equal(limiter.check("k", rule, 5).ok, false);
  limiter.reset("k");
  assert.equal(limiter.check("k", rule, 5).ok, true);
  assert.equal(limiter.size, 0);
}

// Retry-After is at least one second and counts from the hit that frees a slot.
{
  const limiter = new RateLimiter();
  const slow = { limit: 2, windowMs: 60_000 };
  limiter.record("k", slow, 0);
  limiter.record("k", slow, 30_000);
  assert.deepEqual(limiter.check("k", slow, 30_001), { ok: false, retryAfterSeconds: 30 });
  assert.deepEqual(limiter.check("k", slow, 59_999), { ok: false, retryAfterSeconds: 1 });
  assert.equal(limiter.check("k", slow, 60_000).ok, true);
}

// Memory stays bounded when many distinct keys arrive (forged addresses).
{
  const limiter = new RateLimiter();
  for (let i = 0; i < 12_000; i++) limiter.record(`k${i}`, { limit: 5, windowMs: 3_600_000 }, i);
  assert.ok(limiter.size <= 10_000, `size ${limiter.size}`);
  // The newest key survives eviction.
  assert.equal(limiter.check("k11999", { limit: 1, windowMs: 3_600_000 }, 12_000).ok, false);
}

// Client address: first forwarded hop, trimmed and length-bounded.
{
  const request = (headers: Record<string, string>) => new Request("http://localhost/x", { headers });
  assert.equal(clientAddress(request({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" })), "203.0.113.7");
  assert.equal(clientAddress(request({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientAddress(request({})), "unknown");
  assert.equal(clientAddress(request({ "x-forwarded-for": "a".repeat(500) })).length, 64);
}

// 429 response shape.
{
  const response = tooManyRequests({ retryAfterSeconds: 61 });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "61");
}

// Published limits (changing one must be a deliberate edit here too).
assert.deepEqual(PASSWORD_CHANGE_FAILURE_RULE, { limit: 8, windowMs: 900_000 });
assert.deepEqual(LOGIN_ADDRESS_RULE, { limit: 60, windowMs: 900_000 });
assert.deepEqual(LOGIN_EMAIL_FAILURE_RULE, { limit: 8, windowMs: 900_000 });
assert.deepEqual(REGISTER_ADDRESS_RULE, { limit: 30, windowMs: 3_600_000 });

async function main() {
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
  const require = createRequire(import.meta.url);
  const rootParams = require.resolve("next/root-params");
  require.cache[rootParams] = { id: rootParams, filename: rootParams, loaded: true, exports: {} } as NodeJS.Module;
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { createWorkStore } = await import("next/dist/server/async-storage/work-store");
  const inRequest = (handler: (request: Request) => Promise<Response>) => (request: Request) => {
    const nextRequest = new NextRequest(request);
    const store = createRequestStoreForAPI(nextRequest, { pathname: new URL(request.url).pathname },
      { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined, undefined);
    const workStore = createWorkStore({
      page: "/api/auth/route", buildId: "offline", deploymentId: "offline", previouslyRevalidatedTags: [],
      renderOpts: {
        waitUntil: undefined, onClose: () => {}, onAfterTaskError: undefined,
        cacheLifeProfiles: { default: { stale: 0, revalidate: 0, expire: 60 } }, staticPageGenerationTimeout: 60,
        cacheComponents: false, validationLevel: "warning",
        experimental: { authInterrupts: false, useCacheTimeout: 5000, durableUseCacheEntries: false },
      },
    });
    return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(store, () => handler(nextRequest)));
  };
  // Route handlers: the address limit applies before parsing, so malformed
  // bodies (which never reach the database) are enough to exercise it.
  const login = inRequest((await import("../src/app/api/auth/login/route")).POST);
  const register = inRequest((await import("../src/app/api/auth/register/route")).POST);
  const bad = (path: string, address: string) =>
    new Request(`http://localhost${path}`, {
      method: "POST",
      body: "not json",
      headers: { "x-forwarded-for": address },
    });

  for (let i = 0; i < LOGIN_ADDRESS_RULE.limit; i++) {
    assert.equal((await login(bad("/api/auth/login", "203.0.113.50"))).status, 400);
  }
  const blockedLogin = await login(bad("/api/auth/login", "203.0.113.50"));
  assert.equal(blockedLogin.status, 429);
  assert.ok(Number(blockedLogin.headers.get("Retry-After")) >= 1);
  assert.match((await blockedLogin.json()).error, /^Quá nhiều lượt thử\. Hãy thử lại sau \d+ phút\.$/);
  const englishRequest = bad("/api/auth/login", "203.0.113.50");
  englishRequest.headers.set("cookie", "lang=en");
  const englishBlocked = await login(englishRequest);
  assert.equal(englishBlocked.status, 429);
  assert.match((await englishBlocked.json()).error, /^Too many attempts\. Try again in \d+ minutes?\.$/);
  // Another address is unaffected, and login traffic does not use the register budget.
  assert.equal((await login(bad("/api/auth/login", "203.0.113.51"))).status, 400);
  assert.equal((await register(bad("/api/auth/register", "203.0.113.50"))).status, 400);

  for (let i = 1; i < REGISTER_ADDRESS_RULE.limit; i++) {
    assert.equal((await register(bad("/api/auth/register", "203.0.113.50"))).status, 400);
  }
  assert.equal((await register(bad("/api/auth/register", "203.0.113.50"))).status, 429);

  // The per-email failure limit refuses before any lookup once it is full.
  const email = "locked@example.test";
  for (let i = 0; i < LOGIN_EMAIL_FAILURE_RULE.limit; i++) {
    authRateLimiter.record(`login:email:${email}`, LOGIN_EMAIL_FAILURE_RULE);
  }
  const locked = await login(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "  Locked@Example.test ", password: "x".repeat(12) }),
      headers: { "x-forwarded-for": "203.0.113.60", "content-type": "application/json" },
    }),
  );
  assert.equal(locked.status, 429);

  console.log("PASS auth rate limiter: window, retry-after, reset, bounded memory, address parsing, route 429s (offline)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
