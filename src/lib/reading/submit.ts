import { readingMessages } from "@/i18n/messages/reading";
import type { Locale } from "@/i18n/config";
import { prisma } from "@/lib/db";
import {
  isAnswerCorrect,
  isChoiceQuestion,
  toStringArray,
  type GradableQuestion,
  type ReadingQuestionKind,
} from "@/lib/reading/scoring";

/**
 * Writes one graded Reading attempt.
 *
 * The lesson questions are re-read from the database here — the browser only
 * ever sends the learner's responses, never the answers — so scoring cannot be
 * influenced by a tampered form. No AI call is involved: every question has a
 * stored canonical answer.
 */

export type SubmitReadingAttemptInput = {
  locale?: Locale;
  userId: string;
  lessonId: string;
  /** questionId -> raw response as submitted (option text, "true"/"false", typed text). */
  responses: Record<string, string | null | undefined>;
};

export type SubmitReadingAttemptResult =
  | { ok: true; attemptId: string; score: number; maxScore: number }
  | { ok: false; message: string };

const MAX_RESPONSE_LENGTH = 500;

export async function submitReadingAttemptForUser({
  locale = "en",
  userId,
  lessonId,
  responses,
}: SubmitReadingAttemptInput): Promise<SubmitReadingAttemptResult> {
  const t = readingMessages[locale];
  const lesson = await prisma.readingLesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      questions: {
        select: {
          id: true,
          order: true,
          type: true,
          options: true,
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
    const trimmed =
      typeof raw === "string" ? raw.trim().slice(0, MAX_RESPONSE_LENGTH) : "";
    if (!trimmed) unanswered += 1;
    cleaned.set(question.id, trimmed || null);
  }

  if (unanswered > 0) {
    return {
      ok: false,
      message: t.unanswered(unanswered),
    };
  }

  const graded = lesson.questions.map((question) => {
    const response = cleaned.get(question.id) ?? null;
    const gradable: GradableQuestion = {
      type: question.type as ReadingQuestionKind,
      correctAnswer: question.correctAnswer,
      correctOptionIndex: question.correctOptionIndex,
      acceptedAnswers: isChoiceQuestion(question.type as ReadingQuestionKind)
        ? []
        : toStringArray(question.acceptedAnswers),
      options: toStringArray(question.options),
    };

    return {
      questionId: question.id,
      response,
      isCorrect: isAnswerCorrect(gradable, response),
      points: question.points,
    };
  });

  const score = graded.reduce(
    (total, answer) => total + (answer.isCorrect ? answer.points : 0),
    0,
  );
  const maxScore = graded.reduce((total, answer) => total + answer.points, 0);

  const attempt = await prisma.readingAttempt.create({
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
