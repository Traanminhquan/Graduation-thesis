"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_LOCALE, visiblePath, type Locale } from "./config";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** Set once by the root layout from the `[lang]` segment. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext value={locale}>{children}</LocaleContext>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** The table for the current language, in Client Components. */
export function useMessages<T>(messages: { en: T; vi: T }): T {
  return messages[useLocale()];
}

/** `usePathname()` without the `/vi` or `/en` prefix of a rewritten page. */
export function useVisiblePath(): string {
  return visiblePath(usePathname());
}
