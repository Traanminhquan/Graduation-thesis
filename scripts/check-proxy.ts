/** Offline proxy regression checks: npx tsx scripts/check-proxy.ts */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";

async function main() {
  // Next internals expect this global (its server runtime sets it); import Next modules only after it exists.
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
  const { NextRequest } = await import("next/server");
  const { getRedirectUrl, isRewrite, unstable_doesMiddlewareMatch } = await import("next/experimental/testing/server");
  process.env.AUTH_SECRET = ["fake", "offline", "proxy", "check", "value", "not", "real"].join("-"); // test-only, 39 characters
  const { config, proxy } = await import("../src/proxy");
  const { createSessionToken, SESSION_MAX_AGE_SECONDS } = await import("../src/lib/auth/session");
  const origin = "https://proxy-check.example";
  const prefetch = { "next-router-prefetch": "1" };
  const matches = (url: string, headers: Record<string, string> = {}) =>
    unstable_doesMiddlewareMatch({ config, nextConfig: {}, url, headers });

  const protectedPaths = [
    "/profile", "/profile/x", "/reading", "/reading/lesson/result/attempt",
    "/listening", "/writing/p/result/s", "/speaking", "/progress",
    "/conversation", "/conversation/start/x", "/conversation/abc",
  ];
  for (const path of protectedPaths) {
    assert.equal(matches(path), true, `${path} must be protected`);
    // Security guard: never exclude protected prefetches from the proxy gate.
    assert.equal(matches(path, prefetch), true, `${path} prefetch bypasses protection`);
    const response = proxy(new NextRequest(origin + path, { headers: prefetch }));
    assert.equal(getRedirectUrl(response), origin + "/login", `${path} anonymous prefetch`);
  }
  for (const path of ["/login", "/register"]) {
    assert.equal(matches(path), true, `${path} navigation must match`);
    assert.equal(matches(path, { rsc: "1" }), true, `${path} non-prefetch RSC must match`);
    assert.equal(matches(path, prefetch), false, `${path} prefetch must skip proxy`);
  }
  for (const path of ["/", "/api/auth/session", "/_next/static/x.js"]) {
    assert.equal(matches(path), false, `${path} must not match`);
    assert.equal(matches(path, prefetch), false, `${path} prefetch must not match`);
  }

  const user = { id: "offline-user", passwordHash: "offline-hash", email: "offline@example.invalid" };
  const { token } = createSessionToken(user);
  const expired = createSessionToken(user, Date.now() - (SESSION_MAX_AGE_SECONDS + 60) * 1000).token;
  const tampered = (token[0] === "a" ? "b" : "a") + token.slice(1);

  function checkResponse(path: string, cookie: string | undefined, target?: string, rsc = false) {
    const headers: Record<string, string> = {};
    if (cookie) headers.cookie = `el_session=${cookie}`;
    if (rsc) headers.rsc = "1";
    const response = proxy(new NextRequest(origin + path, { headers }));
    assert.equal(isRewrite(response), false, `${path} must not rewrite`);
    assert.equal(getRedirectUrl(response), target ? origin + target : null, path);
    if (target) assert.equal(response.status, 307, path);
    else assert.equal(response.headers.get("x-middleware-next"), "1", `${path} must pass through`);
  }

  for (const path of ["/login?next=/reading&_rsc=test", "/register?_rsc=test"]) {
    for (const rsc of [false, true]) {
      checkResponse(path, token, "/profile", rsc);
      for (const cookie of [undefined, tampered, expired]) {
        checkResponse(path, cookie, undefined, rsc);
      }
    }
  }
  for (const path of ["/profile", "/reading/x", "/progress", "/conversation", "/conversation/start/x", "/conversation/abc"]) {
    for (const cookie of [undefined, tampered, expired]) {
      checkResponse(path, cookie, "/login");
      // The redirect to /login never carries the original query (it could hold tokens or identifiers).
      checkResponse(`${path}?next=secret&_rsc=x`, cookie, "/login");
    }
  }
  for (const path of ["/profile", "/reading", "/conversation", "/conversation/start/x", "/conversation/abc"]) checkResponse(path, token);

  console.log("PASS proxy matcher and session redirects (offline; protected prefetch guard included)");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
