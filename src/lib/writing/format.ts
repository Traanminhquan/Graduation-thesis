import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { writingMessages } from "@/i18n/messages/writing";


/** Human description of a prompt's word range. */
export function wordTargetLabel(
  minWords: number | null,
  maxWords: number | null,
  locale: Locale = "en",
): string {
  return writingMessages[locale].wordTarget(minWords, maxWords);
}

/** Short label used next to the live counter. */
export function wordRangeLabel(
  minWords: number | null,
  maxWords: number | null,
): string | null {
  if (minWords !== null && maxWords !== null) return `${minWords}–${maxWords}`;
  if (minWords !== null) return `${minWords}+`;
  if (maxWords !== null) return `≤${maxWords}`;
  return null;
}

/** UTC timestamp, matching the reading/listening result pages. */
export function formatSubmittedAt(date: Date | null, locale: Locale = "en"): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
