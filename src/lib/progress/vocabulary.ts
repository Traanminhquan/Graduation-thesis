import type { PrismaClient } from "@prisma/client";

/**
 * "Words to review": vocabulary the learner got wrong in Reading.
 *
 * Derived on read, like the rest of the progress page: there is no vocabulary
 * table. A word comes from a Vocabulary-in-context question (the word is quoted
 * in the prompt, the meaning is the correct option). It is listed while the
 * learner's latest answer to that question is wrong, and drops off once they
 * answer it correctly in a later attempt.
 *
 * Read-only: one ownership-scoped SELECT. The pure functions are exercised by
 * `scripts/check-vocabulary.ts` without a database.
 */

export const VOCABULARY_LIMITS = {
  /** Most recent answers examined. */
  answers: 200,
  /** Words shown. */
  words: 12,
} as const;

export type VocabularyAnswer = {
  questionId: string;
  prompt: string;
  correctAnswer: string;
  lessonId: string;
  lessonTitle: string;
  isCorrect: boolean;
  answeredAt: Date;
};

export type VocabularyWord = {
  questionId: string;
  word: string;
  meaning: string;
  lessonId: string;
  lessonTitle: string;
  /** How many times this word was answered wrongly. */
  misses: number;
  lastMissedAt: Date;
};

/**
 * The word a Vocabulary-in-context prompt asks about: the first quoted run,
 * e.g. `In the passage, "deliver" means:`. Null when nothing is quoted, in
 * which case the question is left out rather than guessed at.
 */
export function wordFromPrompt(prompt: string): string | null {
  const match = prompt.match(/"([^"]{1,60})"|“([^”]{1,60})”/);
  const word = (match?.[1] ?? match?.[2] ?? "").trim();
  return word ? word : null;
}

/** Pure: turns answer rows (any order) into the list to show. */
export function wordsToReview(
  answers: readonly VocabularyAnswer[],
  limit: number = VOCABULARY_LIMITS.words,
): VocabularyWord[] {
  const byQuestion = new Map<string, VocabularyAnswer[]>();
  for (const answer of answers) {
    const rows = byQuestion.get(answer.questionId);
    if (rows) rows.push(answer);
    else byQuestion.set(answer.questionId, [answer]);
  }

  const words: VocabularyWord[] = [];
  for (const rows of byQuestion.values()) {
    const newestFirst = [...rows].sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime());
    const latest = newestFirst[0];
    if (latest.isCorrect) continue;
    const word = wordFromPrompt(latest.prompt);
    if (!word) continue;
    words.push({
      questionId: latest.questionId,
      word,
      meaning: latest.correctAnswer,
      lessonId: latest.lessonId,
      lessonTitle: latest.lessonTitle,
      misses: rows.filter((row) => !row.isCorrect).length,
      lastMissedAt: latest.answeredAt,
    });
  }

  return words
    .sort(
      (a, b) =>
        b.lastMissedAt.getTime() - a.lastMissedAt.getTime() ||
        a.questionId.localeCompare(b.questionId),
    )
    .slice(0, Math.max(0, limit));
}

export async function getWordsToReview(
  userId: string,
  db?: Pick<PrismaClient, "readingAnswer">,
): Promise<VocabularyWord[]> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const rows = await prisma.readingAnswer.findMany({
    relationLoadStrategy: "join",
    where: {
      attempt: { userId, completedAt: { not: null } },
      question: { type: "VOCAB_IN_CONTEXT" },
    },
    select: {
      questionId: true,
      isCorrect: true,
      answeredAt: true,
      question: {
        select: {
          prompt: true,
          correctAnswer: true,
          lesson: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { answeredAt: "desc" },
    take: VOCABULARY_LIMITS.answers,
  });

  return wordsToReview(
    rows.map((row) => ({
      questionId: row.questionId,
      prompt: row.question.prompt,
      correctAnswer: row.question.correctAnswer,
      lessonId: row.question.lesson.id,
      lessonTitle: row.question.lesson.title,
      isCorrect: row.isCorrect,
      answeredAt: row.answeredAt,
    })),
  );
}
