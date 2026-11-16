import { type Locale } from "@/i18n/config";
import { authMessages } from "@/i18n/messages/auth";

/** Server-side input validation for the auth endpoints. No client trust. */

export const MIN_PASSWORD_LENGTH = 8;
/** bcrypt only uses the first 72 bytes of a password, so reject longer input. */
export const MAX_PASSWORD_BYTES = 72;
export const MAX_NAME_LENGTH = 80;
export const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

export type RegistrationInput = { email: string; password: string; name: string };
export type LoginInput = { email: string; password: string };

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeEmail(value: unknown): string {
  return asString(value).trim().toLowerCase();
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRegistration(body: Record<string, unknown>, locale: Locale = "en"): ValidationResult<RegistrationInput> {
  const email = normalizeEmail(body.email);
  const password = asString(body.password);
  const name = asString(body.name).trim();
  const errors: FieldErrors = {};

  if (!email) {
    errors.email = authMessages[locale].emailRequired;
  } else if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = authMessages[locale].validEmail;
  }

  const passwordError = validatePassword(password, locale);
  if (passwordError) errors.password = passwordError;

  const nameError = validateName(name, locale);
  if (nameError) errors.name = nameError;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password, name } };
}

export function validateLogin(body: Record<string, unknown>, locale: Locale = "en"): ValidationResult<LoginInput> {
  const email = normalizeEmail(body.email);
  const password = asString(body.password);
  const errors: FieldErrors = {};

  if (!email) errors.email = authMessages[locale].emailRequired;
  if (!password) errors.password = authMessages[locale].passwordRequired;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password } };
}

/** Shared registration and profile name policy. */
export function validateName(name: string, locale: Locale = "en"): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return authMessages[locale].nameRequired;
  if (trimmed.length > MAX_NAME_LENGTH) return authMessages[locale].nameLength(MAX_NAME_LENGTH);
}

/** Shared registration and password-change policy. */
export function validatePassword(password: string, locale: Locale = "en"): string | undefined {
  if (!password) return authMessages[locale].passwordRequired;
  if (password.length < MIN_PASSWORD_LENGTH) return authMessages[locale].passwordLength(MIN_PASSWORD_LENGTH);
  if (byteLength(password) > MAX_PASSWORD_BYTES) return authMessages[locale].passwordBytes(MAX_PASSWORD_BYTES);
}
