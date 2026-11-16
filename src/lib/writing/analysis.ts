import type { Locale } from "@/i18n/config";
import { writingMessages } from "@/i18n/messages/writing";
/**
 * Deterministic, rule-based writing analysis.
 *
 * Everything here is pure: no database, no network, no AI/LLM call. The same
 * functions run in the browser (live word counter), in the Server Action (the
 * stored word count) and in `scripts/check-writing-analysis.ts`, so the number
 * the learner sees while typing is exactly the number that gets saved.
 *
 * The checks are intentionally shallow and honest:
 *   - word count            (whitespace-separated tokens with a word character)
 *   - sentence count        (terminal punctuation or a paragraph break)
 *   - average / longest sentence length
 *   - frequently repeated content words
 *
 * They do NOT judge grammar, vocabulary or ideas. Those need the AI feedback
 * step, which is a later task.
 */

/** A character that makes a whitespace-separated token count as a word. */
const WORD_CHARACTER =
  /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]/;

/** Trims punctuation/symbols from both edges of a token (keeps inner ones). */
const TOKEN_EDGES =
  /^[^A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]+|[^A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]+$/g;

/** Sentence boundary: terminal punctuation, optional closing quote, then space. */
const SENTENCE_BOUNDARY = /([.!?\u2026]+)(["'\u2019\u201D)\]]*)(\s+)/g;

/** Internal marker used to split sentences without a look-behind regex. */
const SENTENCE_SPLIT = "\u0000";

/**
 * Words too common to be interesting in a "repeated word" list. Words shorter
 * than the minimum length are already ignored, so only longer function words
 * are listed here.
 */
const STOP_WORDS = new Set([
  "about", "after", "again", "all", "also", "although", "always", "among",
  "and", "another", "any", "because", "been", "before", "being", "between",
  "both", "but", "can", "could", "did", "does", "doing", "down", "during",
  "each", "even", "every", "few", "for", "from", "further", "had", "has",
  "have", "having", "here", "how", "however", "into", "its", "itself",
  "just", "like", "make", "many", "might", "more", "most", "much", "must",
  "myself", "never", "not", "now", "off", "once", "only", "other", "our",
  "out", "over", "own", "same", "should", "since", "some", "still", "such",
  "than", "that", "the", "their", "them", "then", "there", "these", "they",
  "this", "those", "through", "too", "under", "until", "very", "was", "were",
  "what", "when", "where", "which", "while", "who", "whom", "why", "will",
  "with", "would", "you", "your",
]);

export type RepeatedWord = { word: string; count: number };

export type WordTargetStatus = "none" | "under" | "within" | "over";

export type WordTarget = {
  min: number | null;
  max: number | null;
  status: WordTargetStatus;
  /** How many words are still missing when under the minimum. */
  wordsToMinimum: number | null;
  /** How many words are over the maximum. */
  wordsOverMaximum: number | null;
};

export type WritingAnalysis = {
  wordCount: number;
  /** Trimmed character length of the submitted text. */
  characterCount: number;
  sentenceCount: number;
  /** Mean words per sentence, one decimal place; null when no sentence. */
  averageSentenceLength: number | null;
  longestSentenceWords: number;
  repeatedWords: RepeatedWord[];
  target: WordTarget;
  /** Short deterministic notes for the result page (max 4). */
  notes: string[];
};

export type AnalysisOptions = {
  minWords?: number | null;
  maxWords?: number | null;
  /** Occurrences before a word is considered repetitive. */
  repeatThreshold?: number;
  /** How many repeated words to report. */
  repeatLimit?: number;
  /** Shortest word considered for the repeated-word list. */
  repeatMinLength?: number;
};

/**
 * Canonical form used by every helper: NFKC, unified newlines and quotes,
 * em/en dashes turned into spaced hyphens, runs of spaces collapsed.
 * Paragraph breaks are preserved.
 */
export function normalizeWritingText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    .replace(/[\u2013\u2014]/g, " - ")
    .replace(/[ \t\f\v]+/g, " ");
}

/**
 * Counts words as whitespace-separated tokens containing at least one letter
 * or digit. Pure punctuation ("—", "...", "?!") is not a word, and a dash with
 * no spaces ("well-known" stays one word, "word—word" becomes two).
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return normalizeWritingText(text)
    .split(/\s+/)
    .filter((token) => WORD_CHARACTER.test(token)).length;
}

/**
 * Splits text into sentences on terminal punctuation (`.` `!` `?` `…`) or on
 * a blank line, and ignores fragments with no words.
 *
 * This is a heuristic, not a parser: "Mr. Smith" and "e.g. this" each count as
 * two sentences. That limitation is deliberate — a rule-based check should be
 * simple, predictable and explainable.
 */
export function splitSentences(text: string): string[] {
  const normalized = normalizeWritingText(text).trim();
  if (!normalized) return [];

  const marked = normalized
    .replace(/\n+/g, `${SENTENCE_SPLIT} `)
    .replace(SENTENCE_BOUNDARY, `$1$2${SENTENCE_SPLIT}`);

  return marked
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter((sentence) => countWords(sentence) > 0);
}

export function countSentences(text: string): number {
  return splitSentences(text).length;
}

/** Mean words per sentence rounded to one decimal; null when there is none. */
export function averageSentenceLength(
  wordCount: number,
  sentenceCount: number,
): number | null {
  if (
    !Number.isFinite(wordCount) ||
    !Number.isFinite(sentenceCount) ||
    sentenceCount <= 0 ||
    wordCount < 0
  ) {
    return null;
  }
  return Math.round((wordCount / sentenceCount) * 10) / 10;
}

/** Lowercased word tokens, punctuation trimmed from the edges. */
function wordTokens(text: string): string[] {
  if (!text || !text.trim()) return [];
  return normalizeWritingText(text)
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(TOKEN_EDGES, ""))
    .filter((token) => token.length > 0);
}

/**
 * Content words used at least `threshold` times, most frequent first (ties
 * alphabetical). Stop words and short words are ignored, so the list points at
 * something the learner can actually act on.
 */
export type RepeatedWordOptions = {
  threshold?: number;
  limit?: number;
  minLength?: number;
};

export function findRepeatedWords(
  text: string,
  { threshold = 3, limit = 6, minLength = 4 }: RepeatedWordOptions = {},
): RepeatedWord[] {
  const safeThreshold = Math.max(2, Math.floor(threshold));
  const safeLimit = Math.max(0, Math.floor(limit));
  const safeMinLength = Math.max(1, Math.floor(minLength));

  const counts = new Map<string, number>();
  for (const token of wordTokens(text)) {
    if (token.length < safeMinLength) continue;
    if (STOP_WORDS.has(token)) continue;
    if (!WORD_CHARACTER.test(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= safeThreshold)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, safeLimit);
}

/** Compares the word count with the prompt's target range. */
export function evaluateWordTarget(
  wordCount: number,
  minWords?: number | null,
  maxWords?: number | null,
): WordTarget {
  const min = typeof minWords === "number" && minWords > 0 ? Math.floor(minWords) : null;
  const max = typeof maxWords === "number" && maxWords > 0 ? Math.floor(maxWords) : null;

  const wordsToMinimum = min !== null && wordCount < min ? min - wordCount : null;
  const wordsOverMaximum = max !== null && wordCount > max ? wordCount - max : null;

  let status: WordTargetStatus;
  if (wordsToMinimum !== null) status = "under";
  else if (wordsOverMaximum !== null) status = "over";
  else if (min !== null || max !== null) status = "within";
  else status = "none";

  return { min, max, status, wordsToMinimum, wordsOverMaximum };
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function targetNote(target: WordTarget): string | null {
  const { min, max, status, wordsToMinimum, wordsOverMaximum } = target;

  if (status === "under" && min !== null) {
    return `Add ${plural(wordsToMinimum ?? 0, "word", "words")} to reach the ${min}-word minimum.`;
  }
  if (status === "over" && max !== null) {
    return `Cut ${plural(wordsOverMaximum ?? 0, "word", "words")} to stay within the ${max}-word maximum.`;
  }
  if (min !== null && max !== null) {
    return `Word count is inside the ${min}–${max} word target.`;
  }
  if (min !== null) return `Word count meets the ${min}-word minimum.`;
  if (max !== null) return `Word count is within the ${max}-word maximum.`;
  return null;
}

/**
 * One analysis object for a piece of writing. `notes` holds at most four short
 * observations, in a fixed order, so the result page reads the same way every
 * time for the same text.
 */
export function analyseWriting(
  text: string,
  {
    minWords = null,
    maxWords = null,
    repeatThreshold = 3,
    repeatLimit = 6,
    repeatMinLength = 4,
  }: AnalysisOptions = {},
): WritingAnalysis {
  const wordCount = countWords(text);
  const sentences = splitSentences(text);
  const sentenceCount = sentences.length;
  const sentenceWordCounts = sentences.map((sentence) => countWords(sentence));
  const longestSentenceWords =
    sentenceWordCounts.length > 0 ? Math.max(...sentenceWordCounts) : 0;
  const average = averageSentenceLength(wordCount, sentenceCount);
  const repeatedWords = findRepeatedWords(text, {
    threshold: repeatThreshold,
    limit: repeatLimit,
    minLength: repeatMinLength,
  });
  const target = evaluateWordTarget(wordCount, minWords, maxWords);

  const notes: string[] = [];
  const note = targetNote(target);
  if (note) notes.push(note);

  if (average !== null && sentenceCount >= 2) {
    if (average >= 25) {
      notes.push(
        `Sentences average ${average} words. Long sentences are harder to follow — consider splitting the longest (${longestSentenceWords} words).`,
      );
    } else if (average <= 8 && sentenceCount >= 3) {
      notes.push(
        `Sentences average ${average} words. Joining a few short sentences may improve flow.`,
      );
    }
  }

  for (const { word, count } of repeatedWords.slice(0, 3)) {
    notes.push(
      `“${word}” appears ${plural(count, "time", "times")}. A synonym or a pronoun may read better.`,
    );
  }

  return {
    wordCount,
    characterCount: text.trim().length,
    sentenceCount,
    averageSentenceLength: average,
    longestSentenceWords,
    repeatedWords,
    target,
    notes: notes.slice(0, 4),
  };
}

/** Translate deterministic notes without changing the analysis or learner words. */
export function localizeAnalysisNote(note: string, analysis: WritingAnalysis, locale: Locale): string {
  if (locale === "en") return note;
  const t = writingMessages[locale];
  if (note.startsWith("Sentences average") && analysis.averageSentenceLength !== null) {
    return analysis.averageSentenceLength >= 25 ? t.longSentences(analysis.averageSentenceLength, analysis.longestSentenceWords) : t.shortSentences(analysis.averageSentenceLength);
  }
  for (const { word, count } of analysis.repeatedWords) {
    if (note === writingMessages.en.repeated(word, count)) return t.repeated(word, count);
  }
  if (note.startsWith("Add ")) return t.underCheck(analysis.target.wordsToMinimum, analysis.target.min);
  if (note.startsWith("Cut ")) return t.overCheck(analysis.target.wordsOverMaximum, analysis.target.max);
  return note;
}
