import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { speakingMessages } from "@/i18n/messages/speaking";
/**
 * Pure validation and timing rules for the Speaking module.
 *
 * Shared by the browser recorder and the Server Action, so the limit the
 * learner sees and the limit the server enforces cannot drift. No DOM, no
 * database, no network — checked by scripts/check-speaking-helpers.ts.
 */

/** Used when a prompt does not define `speakingSeconds`. */
export const DEFAULT_SPEAKING_SECONDS = 120;

/** Bounds used to keep a malformed prompt row from producing a useless timer. */
export const MIN_SPEAKING_SECONDS = 15;
export const MAX_SPEAKING_SECONDS = 120;

/** A tap on the stop button must not be saved as a speaking attempt. */
export const MIN_RECORDING_MS = 1_000;

/**
 * Browsers fire the auto-stop timer a little late, so a recording made at the
 * limit can arrive a moment over it. Allowed slack, not extra speaking time.
 */
export const DURATION_TOLERANCE_MS = 2_000;

/** Notes / self-typed transcript cap (the schema stores this in a text column). */
export const MAX_TRANSCRIPT_CHARACTERS = 5_000;

/**
 * The prompt's speaking budget in seconds, clamped to a sane range.
 * Null, NaN and non-positive values fall back to the default.
 */
export function resolveMaxDurationSeconds(
  speakingSeconds: number | null | undefined,
): number {
  if (
    speakingSeconds === null ||
    speakingSeconds === undefined ||
    !Number.isFinite(speakingSeconds) ||
    speakingSeconds <= 0
  ) {
    return DEFAULT_SPEAKING_SECONDS;
  }

  const rounded = Math.round(speakingSeconds);
  if (rounded < MIN_SPEAKING_SECONDS) return MIN_SPEAKING_SECONDS;
  if (rounded > MAX_SPEAKING_SECONDS) return MAX_SPEAKING_SECONDS;
  return rounded;
}

/** The same budget in milliseconds, for the recorder and the Server Action. */
export function resolveMaxDurationMs(
  speakingSeconds: number | null | undefined,
): number {
  return resolveMaxDurationSeconds(speakingSeconds) * 1000;
}

/** Elapsed milliseconds clamped to [0, maxMs]; non-finite input becomes 0. */
export function clampElapsedMs(elapsedMs: number, maxMs: number): number {
  const max = Number.isFinite(maxMs) ? Math.max(0, maxMs) : 0;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.min(elapsed, max);
}

/** Time left before the auto-stop, never negative. */
export function remainingMs(maxMs: number, elapsedMs: number): number {
  const max = Number.isFinite(maxMs) ? Math.max(0, maxMs) : 0;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.max(0, max - elapsed);
}

/** 0–100 integer used by the recorder's progress bar. */
export function recordingProgressPercent(
  elapsedMs: number,
  maxMs: number,
): number {
  if (!Number.isFinite(maxMs) || maxMs <= 0) return 100;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return Math.min(100, Math.round((elapsed / maxMs) * 100));
}

export type RecordingDurationCheck =
  | { ok: true; durationMs: number }
  | { ok: false; error: string };

/**
 * Validates the length of a recording before anything is saved.
 *
 * The client sends only a number; the server still checks it because the
 * browser is not trusted. Longer than the prompt budget plus the tolerance is
 * rejected rather than silently truncated.
 */
export function validateRecordingDuration(
  durationMs: unknown,
  maxMs: number,
  locale: Locale = "en",
): RecordingDurationCheck {
  const t = speakingMessages[locale];
  const value =
    typeof durationMs === "number"
      ? durationMs
      : typeof durationMs === "string" && durationMs.trim() !== ""
        ? Number(durationMs)
        : Number.NaN;

  if (!Number.isFinite(value) || value <= 0) {
    return {
      ok: false,
      error: t.noRecording,
    };
  }

  const rounded = Math.round(value);

  if (rounded < MIN_RECORDING_MS) {
    return {
      ok: false,
      error:
        t.shortRecording,
    };
  }

  const limit = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : 0;
  // Hard product limit (120 s) plus the usual measurement tolerance: a take that the recorder stopped at the limit can run slightly over.
  if (rounded > Math.min(MAX_SPEAKING_SECONDS * 1000 + DURATION_TOLERANCE_MS, limit > 0 ? limit + DURATION_TOLERANCE_MS : MAX_SPEAKING_SECONDS * 1000 + DURATION_TOLERANCE_MS)) {
    return {
      ok: false,
      error: t.longRecording(Math.round(
        (limit > 0 ? Math.min(limit, MAX_SPEAKING_SECONDS * 1000) : MAX_SPEAKING_SECONDS * 1000) / 1000,
      )),
    };
  }

  return { ok: true, durationMs: rounded };
}

/**
 * Normalises optional learner-typed notes / transcript: strips NUL, converts
 * CRLF to LF, drops trailing spaces per line and collapses runs of blank lines.
 */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export type TranscriptCheck =
  | { ok: true; transcript: string | null }
  | { ok: false; error: string };

/**
 * Validates the optional notes field. Absent / empty is a valid value and is
 * stored as NULL, because the schema column is nullable and no STT runs here.
 */
export function validateTranscript(input: unknown, locale: Locale = "en"): TranscriptCheck {
  const t = speakingMessages[locale];
  if (input === null || input === undefined) {
    return { ok: true, transcript: null };
  }

  if (typeof input !== "string") {
    return { ok: false, error: t.invalidNotes };
  }

  if (input.length > MAX_TRANSCRIPT_CHARACTERS) {
    return {
      ok: false,
      error: t.longNotes(MAX_TRANSCRIPT_CHARACTERS.toLocaleString(INTL_LOCALE[locale])),
    };
  }

  const cleaned = cleanTranscript(input);
  return { ok: true, transcript: cleaned === "" ? null : cleaned };
}

export type SpeakingAttemptCheck =
  | { ok: true; durationMs: number; transcript: string | null }
  | { ok: false; error: string };

/**
 * Validates everything the form sends in one step. The prompt budget comes from
 * the database (never from the form), so this is the single rule the write path
 * depends on.
 */
export function validateSpeakingAttempt(input: {
  durationMs: unknown;
  transcript: unknown;
  maxMs: number;
}, locale: Locale = "en"): SpeakingAttemptCheck {
  const duration = validateRecordingDuration(input.durationMs, input.maxMs, locale);
  if (!duration.ok) return duration;

  const transcript = validateTranscript(input.transcript, locale);
  if (!transcript.ok) return transcript;

  return {
    ok: true,
    durationMs: duration.durationMs,
    transcript: transcript.transcript,
  };
}
