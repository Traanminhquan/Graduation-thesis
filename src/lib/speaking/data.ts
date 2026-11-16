import type { Correction } from "../ai/schema";
import type { Difficulty, SubmissionStatus } from "@prisma/client";

import type { SpeakingDb } from "./draft";

/**
 * Server-side read access for the Speaking module.
 * Only called from Server Components / Server Actions — never from the client.
 *
 * Reads are sequential (not Promise.all) because this project's Supabase
 * pooler rejects a second concurrent client connection.
 */

export type SpeakingSubmissionSummary = {
  id: string;
  /** Null is possible for a row saved by a future flow; this MVP always sets it. */
  durationMs: number | null;
  submittedAt: Date | null;
};

export type SpeakingPromptSummary = {
  id: string;
  title: string;
  /** Opening line of the task, used as a card preview. */
  excerpt: string;
  topic: string | null;
  difficulty: Difficulty;
  /** Finer level, once labelled; null until then. */
  cefr: "A1" | "A2" | "B1" | "B2" | "C1" | null;
  preparationSeconds: number | null;
  speakingSeconds: number | null;
  /** How many recordings this learner has saved for the prompt. */
  submissionCount: number;
  /** Most recent submission, so the learner can reopen the last result. */
  latestSubmission: SpeakingSubmissionSummary | null;
};

export type SpeakingPromptDetail = {
  id: string;
  title: string;
  promptText: string;
  topic: string | null;
  difficulty: Difficulty;
  preparationSeconds: number | null;
  speakingSeconds: number | null;
};

function excerptOf(promptText: string, maxLength = 160): string {
  const singleLine = promptText.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 1).trimEnd()}…`;
}

export async function listSpeakingPrompts(
  userId: string,
  db?: SpeakingDb,
): Promise<SpeakingPromptSummary[]> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const prompts = await prisma.speakingPrompt.findMany({
    select: {
      id: true,
      title: true,
      promptText: true,
      topic: true,
      difficulty: true,
      cefr: true,
      preparationSeconds: true,
      speakingSeconds: true,
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });

  if (prompts.length === 0) return [];

  const submissions = await prisma.speakingSubmission.findMany({
    where: { userId, status: { not: "DRAFT" } },
    select: {
      id: true,
      promptId: true,
      audioDurationMs: true,
      submittedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const history = new Map<
    string,
    { count: number; latest: SpeakingSubmissionSummary }
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
        durationMs: submission.audioDurationMs,
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
      preparationSeconds: prompt.preparationSeconds,
      speakingSeconds: prompt.speakingSeconds,
      submissionCount: record?.count ?? 0,
      latestSubmission: record?.latest ?? null,
    };
  });
}

export async function getSpeakingPrompt(
  promptId: string,
): Promise<SpeakingPromptDetail | null> {
  const prisma = (await import("@/lib/db")).prisma;
  return prisma.speakingPrompt.findUnique({
    where: { id: promptId },
    select: {
      id: true,
      title: true,
      promptText: true,
      topic: true,
      difficulty: true,
      preparationSeconds: true,
      speakingSeconds: true,
    },
  });
}

export type SpeakingAssessmentView = {
  topicRelevanceScore: number; grammarScore: number; vocabularyScore: number; coherenceScore: number; overallScore: number;
  summary: string | null;
  corrections: Correction[]; suggestions: string[]; model: string; assessedAt: Date;
};
export function mapSpeakingAssessment(row: Omit<SpeakingAssessmentView, "corrections" | "suggestions" | "overallScore" | "model"> & { corrections: unknown; suggestions: unknown; overallScore: number | null; model: string | null }): SpeakingAssessmentView {
  const keys = ["original", "corrected", "errorType", "explanation"];
  const corrections = Array.isArray(row.corrections) && row.corrections.length <= 20 && row.corrections.every(c => c && typeof c === "object" && !Array.isArray(c) && Object.keys(c).length === 4 && keys.every(key => typeof c[key] === "string" && !!c[key].trim() && c[key].length <= 500)) ? row.corrections as Correction[] : [];
  const suggestions = Array.isArray(row.suggestions) && row.suggestions.length <= 5 && row.suggestions.every(s => typeof s === "string" && !!s.trim() && s.length <= 300) ? row.suggestions as string[] : [];
  return { summary: row.summary, topicRelevanceScore: row.topicRelevanceScore, grammarScore: row.grammarScore, vocabularyScore: row.vocabularyScore, coherenceScore: row.coherenceScore, overallScore: row.overallScore ?? (row.topicRelevanceScore + row.grammarScore + row.vocabularyScore + row.coherenceScore) / 4, corrections, suggestions, model: row.model ?? "Unknown", assessedAt: row.assessedAt };
}

export type SpeakingSubmissionReview = {
  source: "stt" | "manual";
  status: SubmissionStatus;
  assessment: SpeakingAssessmentView | null;
  id: string;
  promptId: string;
  promptTitle: string;
  promptTopic: string | null;
  promptDifficulty: Difficulty;
  speakingSeconds: number | null;
  durationMs: number | null;
  /** True when a stored audio reference exists. */
  hasAudio: boolean;
  audioUrl: string | null;
  /** Learner-typed notes / self-transcript; null when they left it blank. */
  transcript: string | null;
  rawTranscript: string | null;
  submittedAt: Date | null;
};

/**
 * Loads one submission, scoped to the owning user. Returns null for both
 * "no such submission" and "someone else's submission", so the page can render
 * a plain 404 without leaking existence.
 */
export async function getSpeakingSubmissionForUser(
  submissionId: string,
  userId: string,
  db?: SpeakingDb,
): Promise<SpeakingSubmissionReview | null> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const submission = await prisma.speakingSubmission.findFirst({
    where: { id: submissionId, userId, status: { not: "DRAFT" } },
    select: {
      id: true,
      promptId: true,
      audioUrl: true,
      audioDurationMs: true,
      status: true,
      assessment: true,
      confirmedTranscript: true,
      rawTranscript: true,
      submittedAt: true,
      prompt: {
        select: {
          title: true,
          topic: true,
          difficulty: true,
          speakingSeconds: true,
        },
      },
    },
  });

  if (!submission) return null;

  return {
    source: submission.rawTranscript ? "stt" : "manual",
    status: submission.status,
    assessment: submission.assessment ? mapSpeakingAssessment(submission.assessment) : null,
    id: submission.id,
    promptId: submission.promptId,
    promptTitle: submission.prompt.title,
    promptTopic: submission.prompt.topic,
    promptDifficulty: submission.prompt.difficulty,
    speakingSeconds: submission.prompt.speakingSeconds,
    durationMs: submission.audioDurationMs,
    hasAudio: Boolean(submission.audioUrl),
    audioUrl: submission.audioUrl,
    transcript: submission.confirmedTranscript,
    rawTranscript: submission.rawTranscript,
    submittedAt: submission.submittedAt,
  };
}
