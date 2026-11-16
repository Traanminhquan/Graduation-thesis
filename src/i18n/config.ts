/**
 * Interface languages. Pages live under `app/[lang]`; `next.config.ts` rewrites
 * every visible path (`/reading`) to `/vi/reading` or `/en/reading` from the
 * `lang` cookie, so links and URLs never carry the language.
 */
export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "lang";
/** One year, so the choice survives closing the browser. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** BCP 47 tags for `Intl` date and number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { vi: "vi-VN", en: "en-GB" };

export function isLocale(value: unknown): value is Locale {
  return value === "vi" || value === "en";
}

/**
 * The pathname the learner sees. A prerendered page knows its rewritten path
 * (`/vi/reading`) while the browser shows `/reading`; stripping the prefix
 * makes both sides agree, so `usePathname()` comparisons do not mismatch.
 */
export function visiblePath(pathname: string): string {
  const match = /^\/(?:vi|en)(?=\/|$)/.exec(pathname);
  if (!match) return pathname;
  return pathname.slice(match[0].length) || "/";
}

/**
 * A message table: the English and Vietnamese entries must have the same keys
 * and value types (strings, or functions for text with numbers in it).
 */
export function defineMessages<T>(messages: { en: T; vi: NoInfer<T> }): { en: T; vi: T } {
  return messages;
}
