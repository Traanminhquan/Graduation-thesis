import { compare, hash } from "bcryptjs";

/**
 * bcrypt cost factor. 10 is the usual demo/dev default: strong enough that a
 * leaked hash is expensive to attack, fast enough that registration and login
 * stay well under a second.
 */
const BCRYPT_COST = 10;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, BCRYPT_COST);
}

/** Constant-time-ish comparison; never throws on malformed hashes. */
export async function verifyPassword(plaintext: string, passwordHash: string): Promise<boolean> {
  try {
    return await compare(plaintext, passwordHash);
  } catch {
    return false;
  }
}

/**
 * Real bcrypt hash of a discarded random value, compared against when no user
 * matches the submitted email so that "unknown email" and "wrong password"
 * take a similar amount of time. Not a secret and authenticates nothing — the
 * login handler always fails when no user row matched.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$10$yuMSMKdbG.9BS7KhlAJ0p.joLDgtUnXIjNQJt5kXD8PxXmCeVJEOq";
