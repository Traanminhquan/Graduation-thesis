/** Offline profile checks. Fake writes and an anonymous route request only. */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";

import { PROFILE_UPDATE_RULE, RateLimiter } from "../../src/lib/auth/rate-limit";
import { updateName, type NameDatabase } from "../../src/lib/auth/update-name";
import { validateLogin, validateName, validatePassword, validateRegistration } from "../../src/lib/auth/validation";

async function main() {
  // Root parameters are compiler-provided; these route checks use cookies only.
  const require = createRequire(import.meta.url);
  const rootParams = require.resolve("next/root-params");
  require.cache[rootParams] = { id: rootParams, filename: rootParams, loaded: true, exports: {} } as NodeJS.Module;
  assert.equal(validateName(""), "Name is required.");
  assert.equal(validateName("   "), "Name is required.");
  assert.equal(validateName("a".repeat(80)), undefined);
  assert.equal(validateName("a".repeat(81)), "Name must be 80 characters or fewer.");
  assert.equal(validateName("", "vi"), "Bạn cần nhập tên.");
  assert.equal(validateName("a".repeat(81), "vi"), "Tên không được quá 80 ký tự.");
  assert.equal(validatePassword("short", "vi"), "Mật khẩu phải có ít nhất 8 ký tự.");
  assert.deepEqual(validateLogin({}, "vi"), {
    ok: false, errors: { email: "Bạn cần nhập email.", password: "Bạn cần nhập mật khẩu." },
  });
  for (const name of ["", "a".repeat(81)]) {
    assert.deepEqual(validateRegistration({ email: "valid@example.test", password: "password123", name }), {
      ok: false, errors: { name: name ? "Name must be 80 characters or fewer." : "Name is required." },
    });
  }

  const writes: unknown[] = [];
  const db: NameDatabase = { user: { async update(args) { writes.push(args); } } };
  for (const input of [null, undefined, [], "name", 1, {}, { name: null }, { name: 42 },
    { name: "" }, { name: "   " }, { name: "a".repeat(81) }, new Date(),
    Object.assign(Object.create({ inherited: true }), { name: "Ada" })]) {
    const result = await updateName("user-one", input, { db });
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.errors.name);
    assert.equal(writes.length, 0);
  }
  assert.deepEqual(await updateName("user-one", { name: "  Ada  ", id: "user-two", email: "ignored" }, { db }), { ok: true, name: "Ada" });
  assert.deepEqual(writes, [{ where: { id: "user-one" }, data: { name: "Ada" } }]);
  assert.deepEqual(await updateName("user-two", { name: "a".repeat(80) }, { db }), { ok: true, name: "a".repeat(80) });
  assert.deepEqual(writes[1], { where: { id: "user-two" }, data: { name: "a".repeat(80) } });

  assert.deepEqual(PROFILE_UPDATE_RULE, { limit: 20, windowMs: 900_000 });
  const limiter = new RateLimiter();
  for (let i = 0; i < 20; i++) assert.equal(limiter.consume("user-one", PROFILE_UPDATE_RULE, 0).ok, true);
  assert.equal(limiter.consume("user-one", PROFILE_UPDATE_RULE, 1).ok, false);
  assert.equal(limiter.consume("user-two", PROFILE_UPDATE_RULE, 1).ok, true);
  assert.equal(limiter.consume("user-one", PROFILE_UPDATE_RULE, 900_000).ok, true);

  // Supply Next's request context with no cookie. getCurrentUser returns
  // before any database query; these imports never start a server.
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { createWorkStore } = await import("next/dist/server/async-storage/work-store");
  const { POST } = await import("../../src/app/api/auth/profile/route");
  const request = new NextRequest("http://localhost/api/auth/profile", { method: "POST", headers: { host: "localhost", origin: "http://localhost" }, body: "not json" });
  const store = createRequestStoreForAPI(request, { pathname: "/api/auth/profile" },
    { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined, undefined);
  const workStore = createWorkStore({
    page: "/api/auth/profile/route", buildId: "offline", deploymentId: "offline",
    previouslyRevalidatedTags: [],
    renderOpts: {
      waitUntil: undefined, onClose: () => {}, onAfterTaskError: undefined,
      cacheLifeProfiles: { default: { stale: 0, revalidate: 0, expire: 60 } }, staticPageGenerationTimeout: 60,
      cacheComponents: false, validationLevel: "warning",
      experimental: { authInterrupts: false, useCacheTimeout: 5000, durableUseCacheEntries: false },
    },
  });
  const response = await workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(store, () => POST(request)));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Đăng nhập để cập nhật tên của bạn." });
  console.log("PASS auth profile: name validation, registration compatibility, fake updates, per-user limits, anonymous route (offline)");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
