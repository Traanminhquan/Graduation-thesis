import { validateAssessment } from "../ai/schema";
import type { Difficulty } from "@prisma/client";

import type { PrismaClient } from "@prisma/client";

/**
 * Server-side read access for the Writing module.
 * Only called from Server Components / Server Actions — never from the client.
 *
 * Reads are sequential (not Promise.all) because this project's Supabase
 * pooler rejects a second concurrent client connection.
 */

export type WritingSubmissionSummary = {
  id: string;
  wordCount: number;
  submittedAt: Date | null;
};

export type WritingPromptSummary = {
  id: string;
  title: string;
  /** Opening line of the task, used as a card preview. */
  excerpt: string;
  topic: string | null;
  difficulty: Difficulty;
  /** Finer level, once labelled; null until then. */
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | null;
  minWords: number | null;
  maxWords: number | null;
  /** How many times this learner has submitted a response to the prompt. */
  submissionCount: number;
  hasDraft: boolean;
  /** Most recent submission, so the learner can reopen the last result. */
  latestSubmission: WritingSubmissionSummary | null;
};

export type WritingPromptDetail = {
  id: string;
  title: string;
  promptText: string;
  topic: string | null;
  difficulty: Difficulty;
  minWords: number | null;
  maxWords: number | null;
};

function excerptOf(promptText: string, maxLength = 160): string {
  const singleLine = promptText.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function listWritingPrompts(
  userId: string,
  db?: PrismaClient,
): Promise<WritingPromptSummary[]> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const prompts = await prisma.writingPrompt.findMany({
    select: {
      id: true,
      title: true,
      promptText: true,
      topic: true,
      difficulty: true,
      cefr: true,
      minWords: true,
      maxWords: true,
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });

  if (prompts.length === 0) return [];

  const submissions = await prisma.writingSubmission.findMany({
    where: { userId, status: { not: "DRAFT" } },
    select: {
      id: true,
      promptId: true,
      wordCount: true,
      submittedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const drafts = await prisma.writingSubmission.findMany({ where: { userId, status: "DRAFT" }, select: { promptId: true } });
  const history = new Map<
    string,
    { count: number; latest: WritingSubmissionSummary }
  >();

  for (const submission of submissions) {
    const entry = history.get(submission.promptId);
    if (entry) {
      entry.count += 1;
      continue;
    }
    history.set(submission.promptId, {
      count: 1,
      latest: {
        id: submission.id,
        wordCount: submission.wordCount,
        submittedAt: submission.submittedAt,
      },
    });
  }

  return prompts.map((prompt) => {
    const record = history.get(prompt.id);
    return {
      id: prompt.id,
      title: prompt.title,
      excerpt: excerptOf(prompt.promptText),
      topic: prompt.topic,
      difficulty: prompt.difficulty,
      cefr: prompt.cefr,
      minWords: prompt.minWords,
      maxWords: prompt.maxWords,
      submissionCount: record?.count ?? 0,
      hasDraft: drafts.some((draft) => draft.promptId === prompt.id),
      latestSubmission: record?.latest ?? null,
    };
  });
}

export async function getWritingPrompt(
  promptId: string,
): Promise<WritingPromptDetail | null> {
  const prisma = (await import("@/lib/db")).prisma;
  return prisma.writingPrompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      title: true,
      promptText: true,
      topic: true,
      difficulty: true,
      minWords: true,
      maxWords: true,
    },
  });
}

export type WritingSubmissionReview = {
  assessment: (Omit<ReturnType<typeof validateAssessment>, "summary"> & { summary: string | null }) | null;
  id: string;
  promptId: string;
  promptTitle: string;
  promptTopic: string | null;
  promptDifficulty: Difficulty;
  minWords: number | null;
  maxWords: number | null;
  /** Stored text; null only for a row saved by a future draft flow. */
  text: string | null;
  wordCount: number;
  submittedAt: Date | null;
};

/**
 * Loads one submission, scoped to the owning user. Returns null for both
 * "no such submission" and "someone else's submission", so the page can render
 * a plain 404 without leaking existence.
 */
export async function getWritingSubmissionForUser(
  submissionId: string,
  userId: string,
  db?: PrismaClient,
): Promise<WritingSubmissionReview | null> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const submission = await prisma.writingSubmission.findFirst({
    where: { id: submissionId, userId, status: { not: "DRAFT" } },
    select: {
      id: true,
      promptId: true,
      finalText: true,
      assessment: true,
      wordCount: true,
      submittedAt: true,
      prompt: {
        select: {
          title: true,
          topic: true,
          difficulty: true,
          minWords: true,
          maxWords: true,
        },
      },
    },
  });

  if (!submission) return null;

  return {
    id: submission.id,
    promptId: submission.promptId,
    assessment: submission.assessment ? {
      ...validateAssessment(JSON.stringify({
        grammarScore: submission.assessment.grammarScore, vocabularyScore: submission.assessment.vocabularyScore,
        coherenceScore: submission.assessment.coherenceScore, taskAchievementScore: submission.assessment.taskAchievementScore,
        corrections: submission.assessment.corrections, suggestions: submission.assessment.suggestions, summary: "Stored assessment",
      }), submission.finalText ?? ""),
      summary: submission.assessment.summary,
    } : null,
    promptTitle: submission.prompt.title,
    promptTopic: submission.prompt.topic,
    promptDifficulty: submission.prompt.difficulty,
    minWords: submission.prompt.minWords,
    maxWords: submission.prompt.maxWords,
    text: submission.finalText,
    wordCount: submission.wordCount,
    submittedAt: submission.submittedAt,
  };
}
