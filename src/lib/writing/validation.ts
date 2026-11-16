import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { writingMessages } from "@/i18n/messages/writing";
/**
 * Server-side validation for a Writing submission.
 *
 * Pure, so `scripts/check-writing-analysis.ts` can exercise every rule without
 * a database. The action calls this before touching Prisma; the database copy
 * of the prompt is the only thing that comes from outside.
 */
import { countWords } from "@/lib/writing/analysis";

/**
 * A response shorter than this cannot carry an answer to any of the seeded
 * prompts. It is a floor against accidental empty submits, not a grading rule.
 */
export const MIN_WRITING_CHARACTERS = 20;

/**
 * Hard cap on one submission (roughly 3,000 words). It protects the request
 * body, the row size and the analysis loop. The per-prompt maxWords target is
 * guidance, not a hard limit: going over it is reported, never rejected.
 */
export const MAX_WRITING_CHARACTERS = 20_000;

export type WritingValidation =
  | {
      ok: true;
      /** Cleaned text that will be stored. */
      text: string;
      wordCount: number;
      characterCount: number;
    }
  | { ok: false; error: string };

/**
 * Cleans and checks learner input.
 *
 * Cleaning: NUL characters removed, CRLF normalised to LF, trailing spaces on
 * each line dropped, 3+ blank lines collapsed to one blank line, outer
 * whitespace trimmed. The cleaned text is what gets stored, so the stored word
 * count always matches the stored text.
 */
export function cleanWritingText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function validateWritingText(raw: unknown, locale: Locale = "en"): WritingValidation {
  const t = writingMessages[locale];
  if (typeof raw !== "string") {
    return { ok: false, error: t.emptyResponse };
  }

  const text = cleanWritingText(raw);

  if (!text) {
    return { ok: false, error: t.emptyResponse };
  }

  if (text.length < MIN_WRITING_CHARACTERS) {
    return {
      ok: false,
      error: t.tooShort(text.length, MIN_WRITING_CHARACTERS),
    };
  }

  if (text.length > MAX_WRITING_CHARACTERS) {
    return {
      ok: false,
      error: t.tooLong(text.length.toLocaleString(INTL_LOCALE[locale]), MAX_WRITING_CHARACTERS.toLocaleString(INTL_LOCALE[locale])),
    };
  }

  const wordCount = countWords(text);
  if (wordCount === 0) {
    return {
      ok: false,
      error: t.noWords,
    };
  }

  return { ok: true, text, wordCount, characterCount: text.length };
}
