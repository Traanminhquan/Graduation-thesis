import { prisma } from "@/lib/db";
import {
  isChoiceQuestion,
  toStringArray,
  type ReadingQuestionKind,
} from "@/lib/reading/scoring";

/**
 * Server-side read access for the Reading module.
 * Only called from Server Components / Server Actions — never from the client.
 */

export type ReadingLessonSummary = {
  id: string;
  title: string;
  topic: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  /** Finer level, once labelled; null until then. */
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | null;
  summary: string | null;
  estimatedMinutes: number | null;
  questionCount: number;
  attemptCount: number;
  /** Best score as a percentage across this learner's attempts, if any. */
  bestPercentage: number | null;
};

export type ReadingQuestionView = {
  id: string;
  order: number;
  type: ReadingQuestionKind;
  prompt: string;
  /** Choice list for radio questions; empty for TRUE_FALSE / FILL_BLANK. */
  options: string[];
};

export type ReadingLessonDetail = {
  id: string;
  title: string;
  topic: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  content: string;
  summary: string | null;
  estimatedMinutes: number | null;
  /** Total marks available, used by the runner and by results. */
  maxScore: number;
  questions: ReadingQuestionView[];
};

export async function listReadingLessons(
  userId: string,
): Promise<ReadingLessonSummary[]> {
  // Sequential on purpose: the Supabase pooler accepts one client connection, so parallel Prisma reads fail with P1001.
  const lessons = await prisma.readingLesson.findMany({
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      cefr: true,
      summary: true,
      estimatedMinutes: true,
      _count: { select: { questions: true } },
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });

  const attempts = await prisma.readingAttempt.findMany({
    where: { userId },
    select: { lessonId: true, score: true, maxScore: true },
  });

  const byLesson = new Map<
    string,
    { attemptCount: number; bestPercentage: number | null }
  >();

  for (const attempt of attempts) {
    const entry = byLesson.get(attempt.lessonId) ?? {
      attemptCount: 0,
      bestPercentage: null,
    };
    entry.attemptCount += 1;
    if (attempt.maxScore > 0) {
      const percentage = Math.round((attempt.score / attempt.maxScore) * 100);
      entry.bestPercentage =
        entry.bestPercentage === null
          ? percentage
          : Math.max(entry.bestPercentage, percentage);
    }
    byLesson.set(attempt.lessonId, entry);
  }

  return lessons.map((lesson) => {
    const history = byLesson.get(lesson.id);
    return {
      id: lesson.id,
      title: lesson.title,
      topic: lesson.topic,
      difficulty: lesson.difficulty,
      cefr: lesson.cefr,
      summary: lesson.summary,
      estimatedMinutes: lesson.estimatedMinutes,
      questionCount: lesson._count.questions,
      attemptCount: history?.attemptCount ?? 0,
      bestPercentage: history?.bestPercentage ?? null,
    };
  });
}

export async function getReadingLesson(
  lessonId: string,
): Promise<ReadingLessonDetail | null> {
  const lesson = await prisma.readingLesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      content: true,
      summary: true,
      estimatedMinutes: true,
      questions: {
        select: {
          id: true,
          order: true,
          type: true,
          prompt: true,
          options: true,
          points: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!lesson) return null;

  const questions: ReadingQuestionView[] = lesson.questions.map((question) => ({
      id: question.id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      options: isChoiceQuestion(question.type)
        ? toStringArray(question.options)
        : [],
    }));

  return {
    id: lesson.id,
    title: lesson.title,
    topic: lesson.topic,
    difficulty: lesson.difficulty,
    content: lesson.content,
    summary: lesson.summary,
    estimatedMinutes: lesson.estimatedMinutes,
    maxScore: lesson.questions.reduce(
      (total, question) => total + question.points,
      0,
    ),
    questions,
  };
}

export type ReadingReviewQuestion = {
  id: string;
  order: number;
  type: ReadingQuestionKind;
  prompt: string;
  options: string[];
  response: string | null;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  points: number;
};

export type ReadingAttemptReview = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonTopic: string;
  score: number;
  maxScore: number;
  completedAt: Date | null;
  questions: ReadingReviewQuestion[];
};

/**
 * Loads one attempt, scoped to the owning user. Returns null for both
 * "no such attempt" and "someone else's attempt" so the caller can render a
 * plain 404 without leaking existence.
 */
export async function getReadingAttemptForUser(
  attemptId: string,
  userId: string,
): Promise<ReadingAttemptReview | null> {
  const attempt = await prisma.readingAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      lessonId: true,
      score: true,
      maxScore: true,
      completedAt: true,
      lesson: { select: { title: true, topic: true } },
      answers: {
        select: {
          response: true,
          isCorrect: true,
          question: {
            select: {
              id: true,
              order: true,
              type: true,
              prompt: true,
              options: true,
              correctAnswer: true,
              explanation: true,
              points: true,
            },
          },
        },
      },
    },
  });

  if (!attempt) return null;

  return {
    id: attempt.id,
    lessonId: attempt.lessonId,
    lessonTitle: attempt.lesson.title,
    lessonTopic: attempt.lesson.topic,
    score: attempt.score,
    maxScore: attempt.maxScore,
    completedAt: attempt.completedAt,
    questions: attempt.answers
      .map((answer) => ({
        id: answer.question.id,
        order: answer.question.order,
        type: answer.question.type,
        prompt: answer.question.prompt,
        options: toStringArray(answer.question.options),
        response: answer.response,
        isCorrect: answer.isCorrect,
        correctAnswer: answer.question.correctAnswer,
        explanation: answer.question.explanation,
        points: answer.question.points,
      }))
      .sort((a, b) => a.order - b.order),
  };
}

/** Read-only retry context; absent or unanswered rows count as missed. */
export async function getReadingRetryForUser(attemptId: string, userId: string, lessonId: string) {
  const attempt = await prisma.readingAttempt.findFirst({
    where: { id: attemptId, userId, lessonId },
    include: { answers: true, lesson: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!attempt) return null;
  const rightIds = new Set(attempt.answers.filter((answer) => answer.isCorrect && Boolean(answer.response?.trim())).map((answer) => answer.questionId));
  return { questions: attempt.lesson.questions, wrongIds: attempt.lesson.questions.filter((question) => !rightIds.has(question.id)).map((question) => question.id) };
}
