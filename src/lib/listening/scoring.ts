/**
 * Rule-based grading for the Listening module.
 *
 * Pure functions with no server or database imports, so the same rules run in
 * a Server Action, on the results page and in `scripts/checks/check-listening-scoring.ts`.
 * Every question has a stored canonical answer; there is no AI call.
 *
 * The four question types reduce to two rules:
 *   MULTIPLE_CHOICE / TRUE_FALSE / FILL_BLANK -> "is the response one of the
 *     accepted answers?" (option text at `correctOptionIndex`, `correctAnswer`
 *     and `acceptedAnswers`)
 *   MATCHING -> "does every left-hand item map to the right-hand item stored in
 *     the `correctAnswer` JSON object?"
 *
 * The normalisation rules intentionally mirror `src/lib/reading/scoring.ts` so
 * both modules grade with the same tolerance (case, whitespace, curly quotes
 * and trailing punctuation). Keep the two in sync if either changes.
 */

export const LISTENING_QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCHING",
] as const;

export type ListeningQuestionKind = (typeof LISTENING_QUESTION_TYPES)[number];

/** One `{ left, right }` row of a MATCHING question. */
export type MatchingPair = { left: string; right: string };

/** Everything grading needs from a ListeningQuestion row. */
export type GradableListeningQuestion = {
  type: ListeningQuestionKind;
  correctAnswer: string;
  correctOptionIndex: number | null;
  acceptedAnswers: string[];
  options: string[];
  matchingPairs: MatchingPair[];
};

/** Choice-style questions are answered with a radio button. */
export function isChoiceQuestion(type: ListeningQuestionKind): boolean {
  return type === "MULTIPLE_CHOICE";
}

const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

/**
 * Comparison key for an answer: case-, whitespace- and edge-punctuation
 * insensitive, so " Spaced. " and "spaced" compare equal.
 */
export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(TRAILING_PUNCTUATION, "")
    .trim();
}

/** All strings that should be treated as correct for a non-MATCHING question. */
export function acceptedAnswersFor(question: GradableListeningQuestion): string[] {
  const candidates: string[] = [question.correctAnswer];

  if (
    question.correctOptionIndex !== null &&
    question.options[question.correctOptionIndex] !== undefined
  ) {
    candidates.push(question.options[question.correctOptionIndex]);
  }

  candidates.push(...question.acceptedAnswers);

  const unique = new Map<string, string>();
  for (const candidate of candidates) {
    const normalized = normalizeAnswer(candidate);
    if (normalized) unique.set(normalized, candidate);
  }
  return [...unique.values()];
}

/** Grade a multiple-choice, true/false or fill-in-the-blank response. */
export function isAnswerCorrect(
  question: GradableListeningQuestion,
  response: string | null | undefined,
): boolean {
  if (response === null || response === undefined) return false;
  const normalized = normalizeAnswer(response);
  if (!normalized) return false;
  return acceptedAnswersFor(question).some(
    (accepted) => normalizeAnswer(accepted) === normalized,
  );
}

/** Coerce a Prisma `Json?` column (options / acceptedAnswers) to string[]. */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/** Coerce the `matchingPairs` JSON column to validated `{ left, right }` rows. */
export function parseMatchingPairs(value: unknown): MatchingPair[] {
  if (!Array.isArray(value)) return [];

  const pairs: MatchingPair[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { left, right } = entry as { left?: unknown; right?: unknown };
    if (
      typeof left === "string" &&
      left.trim() &&
      typeof right === "string" &&
      right.trim()
    ) {
      pairs.push({ left: left.trim(), right: right.trim() });
    }
  }
  return pairs;
}

/**
 * Parse a stored learner response for a MATCHING question. The response is a
 * JSON object of `{ left: chosenRight }`; anything else is unparseable.
 */
export function parseMapping(
  value: string | null | undefined,
): Record<string, string> | null {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const mapping: Record<string, string> = {};
  for (const [left, right] of Object.entries(parsed)) {
    if (typeof right === "string" && right.trim()) {
      mapping[left] = right.trim();
    }
  }
  return Object.keys(mapping).length > 0 ? mapping : null;
}

/**
 * The answer key for a MATCHING question, as `{ left: right }`.
 * Falls back to `matchingPairs` if `correctAnswer` is not valid JSON, so a
 * malformed key degrades to "grade against the pairs" instead of crashing.
 */
export function correctMatchingMap(
  question: GradableListeningQuestion,
): Record<string, string> {
  const parsed = parseMapping(question.correctAnswer);
  if (parsed) return parsed;

  const fallback: Record<string, string> = {};
  for (const pair of question.matchingPairs) fallback[pair.left] = pair.right;
  return fallback;
}

/**
 * A MATCHING answer is complete only when every left-hand item has a selection.
 * Used by the submit service to reject partial submissions.
 */
export function isMatchingAnswerComplete(
  question: GradableListeningQuestion,
  response: string | null | undefined,
): boolean {
  const correct = correctMatchingMap(question);
  const chosen = parseMapping(response);
  if (!chosen) return false;

  const lefts = Object.keys(correct);
  if (lefts.length === 0) return false;

  return lefts.every((left) => {
    const key = Object.keys(chosen).find(
      (candidate) => normalizeAnswer(candidate) === normalizeAnswer(left),
    );
    return key !== undefined && Boolean(normalizeAnswer(chosen[key]));
  });
}

/** Grade a MATCHING response: every pair must match, and there must be no extras. */
export function isMatchingCorrect(
  question: GradableListeningQuestion,
  response: string | null | undefined,
): boolean {
  const correct = correctMatchingMap(question);
  const chosen = parseMapping(response);
  if (!chosen) return false;

  const lefts = Object.keys(correct);
  if (lefts.length === 0) return false;
  if (Object.keys(chosen).length !== lefts.length) return false;

  return lefts.every((left) => {
    const key = Object.keys(chosen).find(
      (candidate) => normalizeAnswer(candidate) === normalizeAnswer(left),
    );
    return (
      key !== undefined &&
      normalizeAnswer(chosen[key]) === normalizeAnswer(correct[left])
    );
  });
}

/** Single entry point used by the submit service and the review page. */
export function isListeningAnswerCorrect(
  question: GradableListeningQuestion,
  response: string | null | undefined,
): boolean {
  if (question.type === "MATCHING") {
    return isMatchingCorrect(question, response);
  }
  return isAnswerCorrect(question, response);
}

/** Human label for a question type badge. */

/** Human label for the seeded difficulty enum. */

/**
 * `{ left, right }` rows of a stored mapping, in insertion order — used by the
 * results page to print "Your answer" and "Correct answer" readably.
 */
export function matchingEntries(
  value: string | null | undefined,
): MatchingPair[] {
  const mapping = parseMapping(value);
  if (!mapping) return [];
  return Object.entries(mapping).map(([left, right]) => ({ left, right }));
}
