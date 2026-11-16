import { lang } from "next/root-params";

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * Server Components only. Server Actions and Route Handlers use `./request`.
 *
 * The page's language in Server Components and `generateMetadata`. It is a
 * root parameter, known while prerendering, so it keeps static pages static.
 */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The table for the page's language. */
export async function getMessages<T>(messages: { en: T; vi: T }): Promise<T> {
  return messages[await getLocale()];
}
