import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * The language for Server Actions, Route Handlers and the server code they
 * call. Root parameters are not available there (and `next/root-params` must
 * not even be imported there), so this reads the cookie the rewrite uses.
 */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getRequestMessages<T>(messages: { en: T; vi: T }): Promise<T> {
  return messages[await getRequestLocale()];
}
