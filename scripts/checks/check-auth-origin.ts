import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import { readJsonBody } from "../../src/lib/http/json-body";
import { checkSameOrigin } from "../../src/lib/http/same-origin";

async function main() {
  const request = (body?: string) => new Request("http://localhost/test", { method: "POST", body });
  assert.deepEqual(await readJsonBody(request('{"a":1}')), { ok: true, value: { a: 1 } });
  assert.deepEqual(await readJsonBody(request("x".repeat(10_001))), { ok: false, reason: "too_large" });
  assert.deepEqual(await readJsonBody(request("bad")), { ok: false, reason: "invalid" });
  assert.deepEqual(await readJsonBody(request()), { ok: false, reason: "invalid" });
  assert.deepEqual(await readJsonBody(request('"\u00e9"'), 3), { ok: false, reason: "too_large" });
  assert.deepEqual(await readJsonBody(request('null'), 4), { ok: true, value: null });
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(10_001)); },
    cancel() { cancelled = true; },
  });
  const streamed = new Request("http://localhost/test", {
    method: "POST", body: stream, duplex: "half",
  } as RequestInit);
  assert.deepEqual(await readJsonBody(streamed), { ok: false, reason: "too_large" });
  assert.equal(cancelled, true);
  console.log("ok JSON body: valid, oversized, invalid, empty, byte limit, exact limit");
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
  const logout = inRequest((await import("../../src/app/api/auth/logout/route")).POST);
  for (const origin of [undefined, "https://foreign.test", "http://localhost"]) {
    const headers = new Headers({ host: "localhost" });
    if (origin) headers.set("origin", origin);
    const makeRequest = (body?: string) => new Request("http://localhost/api/auth/logout", { method: "POST", headers, body });
    assert.equal(checkSameOrigin(makeRequest(), { NODE_ENV: "test" }), origin === "http://localhost");
    const response = await logout(makeRequest());
    assert.equal(response.status, origin === "http://localhost" ? 200 : 403);
    assert.equal(response.headers.has("set-cookie"), origin === "http://localhost");
  }
  const oversized = await logout(new Request("http://localhost/api/auth/logout", {
    method: "POST", headers: { host: "localhost", origin: "http://localhost" }, body: "x".repeat(10_001),
  }));
  assert.equal(oversized.status, 413);
  assert.equal(oversized.headers.has("set-cookie"), false);
  console.log("ok logout: missing/foreign origins blocked, matching origin allowed, body capped (offline)");
}
main().catch((error) => { console.error("FAIL", error); process.exitCode = 1; });
