import { prisma } from "@/lib/db";
import {
  parseMatchingPairs,
  toStringArray,
  type ListeningQuestionKind,
  type MatchingPair,
} from "@/lib/listening/scoring";

/**
 * Server-side read access for the Listening module.
 * Only called from Server Components / Server Actions — never from the client.
 *
 * Question rows are projected without `correctAnswer`, `correctOptionIndex`,
 * `acceptedAnswers` or `explanation`, so the answer key never reaches the
 * browser before an attempt is submitted.
 */

export type ListeningLessonSummary = {
  id: string;
  title: string;
  topic: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  /** Finer level, once labelled; null until then. */
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | null;
  questionCount: number;
  attemptCount: number;
  /** Best score as a percentage across this learner's attempts, if any. */
  bestPercentage: number | null;
  /** Seeded estimate of the spoken length, in seconds. */
  audioDurationMs: number | null;
};

export type ListeningQuestionView = {
  id: string;
  order: number;
  type: ListeningQuestionKind;
  prompt: string;
  /** Choice list for MULTIPLE_CHOICE; empty for the other types. */
  options: string[];
  /** Rows for MATCHING; empty for the other types. */
  matchingPairs: MatchingPair[];
};

export type ListeningLessonDetail = {
  id: string;
  title: string;
  topic: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  transcript: string;
  audioUrl: string;
  audioDurationMs: number | null;
  /** Total marks available, used by the runner and by results. */
  maxScore: number;
  questions: ListeningQuestionView[];
};

export async function listListeningLessons(
  userId: string,
): Promise<ListeningLessonSummary[]> {
  // Sequential on purpose: the Supabase pooler accepts one client connection, so parallel Prisma reads fail with P1001.
  const lessons = await prisma.listeningLesson.findMany({
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      cefr: true,
      audioDurationMs: true,
      _count: { select: { questions: true } },
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });

  const attempts = await prisma.listeningAttempt.findMany({
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
      questionCount: lesson._count.questions,
      attemptCount: history?.attemptCount ?? 0,
      bestPercentage: history?.bestPercentage ?? null,
      audioDurationMs: lesson.audioDurationMs,
    };
  });
}

export async function getListeningLesson(
  lessonId: string,
): Promise<ListeningLessonDetail | null> {
  const lesson = await prisma.listeningLesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      transcript: true,
      audioUrl: true,
      audioDurationMs: true,
      questions: {
        select: {
          id: true,
          order: true,
          type: true,
          prompt: true,
          options: true,
          matchingPairs: true,
          points: true,
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!lesson) return null;

  const questions: ListeningQuestionView[] = lesson.questions.map((question) => ({
    id: question.id,
    order: question.order,
    type: question.type,
    prompt: question.prompt,
    options:
      question.type === "MULTIPLE_CHOICE" ? toStringArray(question.options) : [],
    matchingPairs:
      question.type === "MATCHING" ? parseMatchingPairs(question.matchingPairs) : [],
  }));

  return {
    id: lesson.id,
    title: lesson.title,
    topic: lesson.topic,
    difficulty: lesson.difficulty,
    transcript: lesson.transcript,
    audioUrl: lesson.audioUrl,
    audioDurationMs: lesson.audioDurationMs,
    maxScore: lesson.questions.reduce(
      (total, question) => total + question.points,
      0,
    ),
    questions,
  };
}

export type ListeningReviewQuestion = {
  id: string;
  order: number;
  type: ListeningQuestionKind;
  prompt: string;
  matchingPairs: MatchingPair[];
  response: string | null;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string | null;
  points: number;
};

export type ListeningAttemptReview = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  lessonTopic: string;
  transcript: string;
  score: number;
  maxScore: number;
  completedAt: Date | null;
  questions: ListeningReviewQuestion[];
};

/**
 * Loads one attempt, scoped to the owning user. Returns null for both
 * "no such attempt" and "someone else's attempt" so the caller can render a
 * plain 404 without leaking existence.
 */
export async function getListeningAttemptForUser(
  attemptId: string,
  userId: string,
): Promise<ListeningAttemptReview | null> {
  const attempt = await prisma.listeningAttempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      lessonId: true,
      score: true,
      maxScore: true,
      completedAt: true,
      lesson: { select: { title: true, topic: true, transcript: true } },
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
              matchingPairs: true,
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
    transcript: attempt.lesson.transcript,
    score: attempt.score,
    maxScore: attempt.maxScore,
    completedAt: attempt.completedAt,
    questions: attempt.answers
      .map((answer) => ({
        id: answer.question.id,
        order: answer.question.order,
        type: answer.question.type,
        prompt: answer.question.prompt,
        matchingPairs: parseMatchingPairs(answer.question.matchingPairs),
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
export async function getListeningRetryForUser(attemptId: string, userId: string, lessonId: string) {
  const attempt = await prisma.listeningAttempt.findFirst({
    where: { id: attemptId, userId, lessonId },
    include: { answers: true, lesson: { include: { questions: { orderBy: { order: "asc" } } } } },
  });
  if (!attempt) return null;
  const rightIds = new Set(attempt.answers.filter((answer) => answer.isCorrect && Boolean(answer.response?.trim())).map((answer) => answer.questionId));
  return { questions: attempt.lesson.questions, wrongIds: attempt.lesson.questions.filter((question) => !rightIds.has(question.id)).map((question) => question.id) };
}
