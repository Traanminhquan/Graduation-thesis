import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { speakingMessages } from "@/i18n/messages/speaking";
/**
 * Presentation helpers for the Speaking module.
 *
 * No DOM, no database and no network: every function is pure so it can be
 * unit-checked with `npx tsx scripts/check-speaking-helpers.ts`.
 */

export const DIFFICULTY_LABEL: Record<
  "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
  string
> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

/**
 * Seconds -> `m:ss`. Used by the live timer, where whole seconds are enough.
 *
 * Non-finite and negative input renders as `0:00` rather than `NaN:NaN`, so a
 * clock that has not started yet can be rendered safely. Minutes are not
 * capped: 3,661 seconds renders as `61:01`.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Milliseconds -> `m:ss`, rounded to the nearest second.
 *
 * The value saved in `audioDurationMs` is rendered with this function, so the
 * result page shows the same length the learner saw when they stopped.
 */
export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  return formatClock(Math.round(ms / 1000));
}

/**
 * Human description of a time budget, used on prompt cards and guidance rows:
 * 30 -> "30 seconds", 60 -> "1 minute", 90 -> "1 minute 30 seconds".
 */
export function durationLimitLabel(seconds: number | null, locale: Locale = "en"): string {
  const t = speakingMessages[locale];
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return t.noTimeLimit;
  const whole = Math.round(seconds);
  return t.duration(Math.floor(whole / 60), whole % 60);
}

/** UTC timestamp, matching the reading / listening / writing result pages. */
export function formatSubmittedAt(date: Date | null, locale: Locale = "en"): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
