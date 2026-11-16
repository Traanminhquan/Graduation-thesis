import { listeningMessages } from "@/i18n/messages/listening";
import type { Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import {
  isListeningAnswerCorrect,
  isMatchingAnswerComplete,
  parseMatchingPairs,
  toStringArray,
  type GradableListeningQuestion,
  type ListeningQuestionKind,
  type MatchingPair,
} from "@/lib/listening/scoring";

/**
 * Writes one graded Listening attempt.
 *
 * The lesson questions are re-read from the database here — the browser only
 * ever sends the learner's responses, never the answer key — so scoring cannot
 * be influenced by a tampered form. No AI call is involved: every question has
 * a stored canonical answer.
 *
 * The attempt and all of its answers are written in a single nested `create`,
 * so a partial submission can never be persisted.
 */

export type SubmitListeningAttemptInput = {
  locale?: Locale;
  userId: string;
  lessonId: string;
  /**
   * questionId -> raw response.
   * MATCHING questions arrive as a JSON array of the learner's selections in
   * pair order; everything else arrives as text (option text, "true"/"false"
   * or a typed word).
   */
  responses: Record<string, string | null | undefined>;
};

export type SubmitListeningAttemptResult =
  | { ok: true; attemptId: string; score: number; maxScore: number }
  | { ok: false; message: string };

const MAX_RESPONSE_LENGTH = 500;
const MAX_MATCHING_RESPONSE_LENGTH = 4000;

type LessonQuestion = {
  id: string;
  type: ListeningQuestionKind;
  options: unknown;
  matchingPairs: unknown;
  correctAnswer: string;
  correctOptionIndex: number | null;
  acceptedAnswers: unknown;
  points: number;
};

/**
 * Converts the MATCHING form payload (ordered selections) into the
 * `{ left: right }` JSON object that `ListeningAnswer.response` stores.
 * Returns null when any pair is unselected, which the caller counts as an
 * unanswered question.
 */
function matchingResponseFor(
  question: LessonQuestion,
  pairs: MatchingPair[],
  raw: string | null | undefined,
): string | null {
  if (pairs.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "");
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const mapping: Record<string, string> = {};
  for (let index = 0; index < pairs.length; index += 1) {
    const choice = parsed[index];
    if (typeof choice !== "string" || !choice.trim()) return null;
    mapping[pairs[index].left] = choice.trim();
  }

  // Guard against a payload longer than the question's own pair list.
  if (parsed.length > pairs.length) return null;

  return JSON.stringify(mapping);
}

export async function submitListeningAttemptForUser({
  locale = "en",
  userId,
  lessonId,
  responses,
}: SubmitListeningAttemptInput): Promise<SubmitListeningAttemptResult> {
  const t = listeningMessages[locale];
  const lesson = await prisma.listeningLesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      questions: {
        select: {
          id: true,
          order: true,
          type: true,
          options: true,
          matchingPairs: true,
          correctAnswer: true,
          correctOptionIndex: true,
          acceptedAnswers: true,
          points: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!lesson) {
    return { ok: false, message: t.missingLesson };
  }
  if (lesson.questions.length === 0) {
    return { ok: false, message: t.emptyLesson };
  }

  const cleaned = new Map<string, string | null>();
  let unanswered = 0;

  for (const question of lesson.questions) {
    const raw = responses[question.id];
    let response: string | null;

    if (question.type === "MATCHING") {
      response = matchingResponseFor(
        question,
        parseMatchingPairs(question.matchingPairs),
        typeof raw === "string"
          ? raw.slice(0, MAX_MATCHING_RESPONSE_LENGTH)
          : null,
      );
    } else {
      const trimmed =
        typeof raw === "string" ? raw.trim().slice(0, MAX_RESPONSE_LENGTH) : "";
      response = trimmed || null;
    }

    if (!response) unanswered += 1;
    cleaned.set(question.id, response);
  }

  if (unanswered > 0) {
    return {
      ok: false,
      message: t.unanswered(unanswered),
    };
  }

  const graded = lesson.questions.map((question) => {
    const response = cleaned.get(question.id) ?? null;
    const pairs = parseMatchingPairs(question.matchingPairs);
    const gradable: GradableListeningQuestion = {
      type: question.type,
      correctAnswer: question.correctAnswer,
      correctOptionIndex: question.correctOptionIndex,
      acceptedAnswers: toStringArray(question.acceptedAnswers),
      options: toStringArray(question.options),
      matchingPairs: pairs,
    };

    // Belt-and-braces: a returned response must still be complete for a
    // matching question before it can earn points.
    const isCorrect =
      question.type === "MATCHING"
        ? isMatchingAnswerComplete(gradable, response) &&
          isListeningAnswerCorrect(gradable, response)
        : isListeningAnswerCorrect(gradable, response);

    return {
      questionId: question.id,
      response,
      isCorrect,
      points: question.points,
    };
  });

  const score = graded.reduce(
    (total, answer) => total + (answer.isCorrect ? answer.points : 0),
    0,
  );
  const maxScore = graded.reduce((total, answer) => total + answer.points, 0);

  // One nested create => the attempt and its answers commit atomically.
  const attempt = await prisma.listeningAttempt.create({
    data: {
      userId,
      lessonId: lesson.id,
      completedAt: new Date(),
      score,
      maxScore,
      answers: {
        create: graded.map((answer) => ({
          questionId: answer.questionId,
          response: answer.response,
          isCorrect: answer.isCorrect,
        })),
      },
    },
    select: { id: true },
  });

  return { ok: true, attemptId: attempt.id, score, maxScore };
}
