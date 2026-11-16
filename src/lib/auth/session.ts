import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless, signed session cookie.
 *
 * Why not NextAuth + Prisma adapter: the live schema only has `users`
 * (see prisma/schema.prisma). NextAuth's Prisma adapter needs `accounts`,
 * `sessions` and `verification_tokens` tables — adding them requires a
 * migration, which this task explicitly forbids. NextAuth's Credentials
 * provider also forces the JWT session strategy, so the adapter buys nothing
 * for email+password auth. A small HMAC-signed cookie gives the same
 * properties (tamper-proof, revocable-by-expiry, httpOnly) with no schema
 * change and no extra runtime dependency.
 *
 * Token format: base64url(JSON payload) "." base64url(HMAC-SHA256)
 */

export const SESSION_COOKIE = "el_session";

/** 7 days. Sessions are stateless, so expiry lives in the signed payload. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  /** User.id (cuid) — the only value trusted for DB lookups. */
  sub: string;
  /** Optional only so legacy signed tokens can reach the expiry handler. */
  pv?: string;
  email: string;
  /** Issued at, seconds since epoch. */
  iat: number;
  /** Expires at, seconds since epoch. */
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    // Never include the value itself in the message.
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Set it in .env (see .env.example).",
    );
  }
  return secret;
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.sub === "string" &&
    record.sub.length > 0 &&
    typeof record.email === "string" &&
    typeof record.iat === "number" &&
    Number.isFinite(record.iat) &&
    typeof record.exp === "number" &&
    Number.isFinite(record.exp) &&
    (record.pv === undefined || (typeof record.pv === "string" && /^[A-Za-z0-9_-]{16}$/.test(record.pv)))
  );
}

export function createSessionToken(
  user: { id: string; email: string; passwordHash: string },
  now: number = Date.now(),
): { token: string; expiresAt: Date } {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    pv: passwordFingerprint(user.passwordHash),
    email: user.email,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { token: `${encoded}.${sign(encoded)}`, expiresAt: new Date(payload.exp * 1000) };
}

export function verifySessionToken(
  token: string | undefined | null,
  now?: number,
): SessionPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  // Read the clock only once a token exists: touching Date.now() during a
  // prerender pass would trip Next's unstable-value check for no reason.
  const currentTime = now ?? Date.now();

  let expected: string;
  try {
    expected = sign(encoded);
  } catch {
    // Missing/short AUTH_SECRET — treat as "no valid session" rather than 500.
    return null;
  }

  const given = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!isSessionPayload(parsed)) return null;

  if (parsed.exp <= Math.floor(currentTime / 1000)) return null;
  return parsed;
}

/**
 * Cookie attributes. `secure` follows the request protocol so that a local
 * http:// demo can still store the cookie, while any https deployment gets
 * the Secure flag.
 */
export function sessionCookieOptions(requestUrl: string) {
  let secure = process.env.NODE_ENV === "production";
  try {
    secure = new URL(requestUrl).protocol === "https:";
  } catch {
    // keep the NODE_ENV default
  }
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

function passwordFingerprint(passwordHash: string): string {
  return createHmac("sha256", getSecret()).update(`pv:${passwordHash}`).digest("base64url").slice(0, 16);
}

export function sessionMatchesPassword(payload: SessionPayload, passwordHash: string): boolean {
  if (typeof payload.pv !== "string") return false;
  const given = Buffer.from(payload.pv, "utf8");
  const expected = Buffer.from(passwordFingerprint(passwordHash), "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
