"use client";

import { useLocale, useMessages } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/config";
import { commonMessages } from "@/i18n/messages/common";

/**
 * Switches the interface language. The choice is a cookie that `next.config.ts`
 * reads to rewrite the same visible URL to the other language, so a full reload
 * of the current page is all it takes.
 */
export function LanguageSwitch() {
  const locale = useLocale();
  const t = useMessages(commonMessages).language;
  const next = locale === "vi" ? "en" : "vi";

  function switchLanguage() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      aria-label={t.switchLabel}
      lang={next}
      className="min-h-9 shrink-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
    >
      {t.switchTo}
    </button>
  );
}
