/** Offline password and session checks. No database or network. */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

import { changePassword, type PasswordDatabase } from "../src/lib/auth/change-password";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { PASSWORD_CHANGE_FAILURE_RULE, RateLimiter } from "../src/lib/auth/rate-limit";
import { createSessionToken, sessionMatchesPassword, verifySessionToken } from "../src/lib/auth/session";

async function main() {
  const secret = "offline-password-check-secret-at-least-32-characters";
  process.env.AUTH_SECRET = secret;
  const oldPassword = "old-password-123";
  const newPassword = "new-password-456";
  const originalHash = await hashPassword(oldPassword);
  const user = { id: "offline-user", email: "offline@example.invalid", passwordHash: originalHash };
  const { token } = createSessionToken(user);
  const payload = verifySessionToken(token)!;
  assert.ok(payload);
  assert.equal(payload.pv, createHmac("sha256", secret).update(`pv:${originalHash}`).digest("base64url").slice(0, 16));
  assert.equal(sessionMatchesPassword(payload, originalHash), true);
  assert.equal(sessionMatchesPassword(payload, "different-hash"), false);
  assert.ok(!token.includes(originalHash));
  assert.ok(!Buffer.from(token.split(".")[0], "base64url").toString().includes(originalHash));
  const legacy = { ...payload };
  delete legacy.pv;
  const encoded = Buffer.from(JSON.stringify(legacy)).toString("base64url");
  const legacyToken = `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
  assert.ok(verifySessionToken(legacyToken));
  assert.equal(sessionMatchesPassword(verifySessionToken(legacyToken)!, originalHash), false);

  let stored = originalHash;
  let writes = 0;
  let reads = 0;
  let exists = true;
  const db: PasswordDatabase = { user: {
    async findUnique(args) {
      assert.equal(args.where.id, user.id);
      reads++;
      return exists ? { passwordHash: stored } : null;
    },
    async update(args) {
      assert.equal(args.where.id, user.id);
      writes++;
      stored = args.data.passwordHash;
    },
  } };
  for (const input of [null, [], {}, { currentPassword: 42, newPassword: false },
    { currentPassword: "", newPassword }, { currentPassword: oldPassword, newPassword: "" },
    { currentPassword: oldPassword, newPassword: "1234567" },
    { currentPassword: oldPassword, newPassword: "a".repeat(73) },
    { currentPassword: oldPassword, newPassword: "é".repeat(37) },
    { currentPassword: oldPassword, newPassword: oldPassword }]) {
    const result = await changePassword(user.id, input, { db });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "fields");
    assert.equal(writes, 0);
    assert.equal(reads, 0, "field validation must happen before database/bcrypt work");
  }
  assert.deepEqual(await changePassword(user.id, { currentPassword: "wrong-password", newPassword }, { db }), { ok: false, reason: "wrong-password" });
  assert.equal(writes, 0);
  exists = false;
  assert.deepEqual(await changePassword(user.id, { currentPassword: oldPassword, newPassword }, { db }), { ok: false, reason: "wrong-password" });
  assert.equal(writes, 0);
  exists = true;
  const result = await changePassword(user.id, { currentPassword: oldPassword, newPassword }, { db });
  assert.ok(result.ok);
  assert.equal(writes, 1);
  assert.equal(stored, result.passwordHash);
  assert.match(stored, /^\$2[aby]\$/);
  assert.equal(await verifyPassword(newPassword, stored), true);
  assert.equal(await verifyPassword(oldPassword, stored), false);
  assert.ok(verifySessionToken(token), "stale tokens still pass signature verification");
  assert.equal(sessionMatchesPassword(payload, stored), false);
  const renewed = verifySessionToken(createSessionToken({ ...user, passwordHash: stored }).token)!;
  assert.notEqual(renewed.pv, payload.pv);
  assert.equal(sessionMatchesPassword(renewed, stored), true);

  // Both policy boundaries are accepted, including UTF-8 byte accounting.
  for (const password of ["12345678", "a".repeat(72), "é".repeat(36)]) {
    const previous = newPassword;
    stored = await hashPassword(previous);
    assert.equal((await changePassword(user.id, { currentPassword: previous, newPassword: password }, { db })).ok, true);
    assert.equal(await verifyPassword(password, stored), true);
  }
  assert.deepEqual(PASSWORD_CHANGE_FAILURE_RULE, { limit: 8, windowMs: 900_000 });
  const limiter = new RateLimiter();
  for (let i = 0; i < 8; i++) {
    assert.equal(limiter.check(user.id, PASSWORD_CHANGE_FAILURE_RULE, 0).ok, true);
    limiter.record(user.id, PASSWORD_CHANGE_FAILURE_RULE, 0);
  }
  assert.equal(limiter.check(user.id, PASSWORD_CHANGE_FAILURE_RULE, 1).ok, false);
  assert.equal(limiter.check("other-user", PASSWORD_CHANGE_FAILURE_RULE, 1).ok, true);
  limiter.reset(user.id);
  assert.equal(limiter.check(user.id, PASSWORD_CHANGE_FAILURE_RULE, 1).ok, true);
  console.log("PASS auth password: fingerprints, legacy/stale sessions, validation, fake database writes, bcrypt, per-user limits (offline)");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
