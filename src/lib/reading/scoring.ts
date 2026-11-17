/**
 * Rule-based grading for the Reading module.
 *
 * Pure functions with no server or database imports, so the exact same rules
 * can run in a Server Action and in a test script. There is deliberately no AI
 * call here: every question has a stored canonical answer.
 *
 * The five question types all reduce to "is the response one of the accepted
 * answers?":
 *   MULTIPLE_CHOICE / MAIN_IDEA / VOCAB_IN_CONTEXT -> option text at
 *     `correctOptionIndex` (plus `correctAnswer` itself)
 *   TRUE_FALSE                                     -> "true" / "false"
 *   FILL_BLANK                                     -> `correctAnswer` plus any
 *     `acceptedAnswers` spellings
 */

export const READING_QUESTION_TYPES = [
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MAIN_IDEA",
  "VOCAB_IN_CONTEXT",
] as const;

export type ReadingQuestionKind = (typeof READING_QUESTION_TYPES)[number];

/** Everything grading needs from a ReadingQuestion row. */
export type GradableQuestion = {
  type: ReadingQuestionKind;
  correctAnswer: string;
  correctOptionIndex: number | null;
  acceptedAnswers: string[];
  options: string[];
};

/** Choice-style questions are answered with a radio button. */
export function isChoiceQuestion(type: ReadingQuestionKind): boolean {
  return (
    type === "MULTIPLE_CHOICE" ||
    type === "MAIN_IDEA" ||
    type === "VOCAB_IN_CONTEXT"
  );
}

const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

/**
 * Comparison key for an answer: case-, whitespace- and edge-punctuation
 * insensitive, so "Spaced " and "spaced." both match "spaced".
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

/** All strings that should be treated as correct for one question. */
export function acceptedAnswersFor(question: GradableQuestion): string[] {
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

export function isAnswerCorrect(
  question: GradableQuestion,
  response: string | null | undefined,
): boolean {
  if (response === null || response === undefined) return false;
  const normalized = normalizeAnswer(response);
  if (!normalized) return false;
  return acceptedAnswersFor(question).some(
    (accepted) => normalizeAnswer(accepted) === normalized,
  );
}

/** Human label for a question type badge. */

/** Human label for the seeded difficulty enum. */

/** Coerce a Prisma `Json?` column (options / acceptedAnswers) to string[]. */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
