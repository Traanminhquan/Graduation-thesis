import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { progressMessages } from "@/i18n/messages/progress";
/**
 * Presentation helpers for the progress dashboard.
 * Dates are formatted in UTC so the server-rendered HTML is deterministic.
 */

const longDate = (locale: Locale) => new Intl.DateTimeFormat(INTL_LOCALE[locale], {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const shortDate = (locale: Locale) => new Intl.DateTimeFormat(INTL_LOCALE[locale], {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatAttemptDate(date: Date, locale: Locale = "en"): string {
  return longDate(locale).format(date);
}

export function formatShortDate(date: Date, locale: Locale = "en"): string {
  return shortDate(locale).format(date);
}

export type ScoreBand = {
  label: string;
  /** Tailwind classes written out in full so the compiler can find them. */
  className: string;
};

/** Coarse banding used to colour scores — presentation only, never a grade. */
export function scoreBand(percentage: number | null, locale: Locale = "en"): ScoreBand {
  const t = progressMessages[locale];
  if (percentage === null) {
    return { label: t.noMarks, className: "text-ink-muted" };
  }
  if (percentage >= 80) {
    return {
      label: t.strong,
      className: "text-tick",
    };
  }
  if (percentage >= 60) {
    return { label: t.steady, className: "text-caution" };
  }
  return { label: t.needsWork, className: "text-pen" };
}

/** `null` → em dash, for "no average yet" style placeholders. */
export function formatPercentage(percentage: number | null): string {
  return percentage === null ? "—" : `${percentage}%`;
}
