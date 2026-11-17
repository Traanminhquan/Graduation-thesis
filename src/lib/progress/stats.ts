import type { PrismaClient } from "@prisma/client";

/**
 * Progress aggregation for the `/progress` dashboard.
 *
 * Design notes
 * - Progress is derived on read from the attempt tables (see the note at the
 *   top of prisma/schema.prisma). There is no summary table, so this module is
 *   the single place that turns attempt history into displayable statistics.
 * - Read-only by construction: the only database access here is four `findMany`
 *   SELECTs. No insert/update/delete, no schema change, no migration.
 * - The pure functions at the top have no database dependency, so
 *   `scripts/checks/check-progress-stats.ts` can exercise every edge case (zero
 *   attempts, `maxScore = 0`, averaging) without touching Postgres.
 */

export const PROGRESS_SKILLS = ["reading", "listening", "writing", "speaking"] as const;

export type ProgressSkill = (typeof PROGRESS_SKILLS)[number];

/** How many attempts the dashboard shows per skill ("last 10 attempts"). */
export const RECENT_ATTEMPT_LIMIT = 10;

/** A completed attempt as it comes out of the database. */
export type AttemptInput = {
  id: string;
  lessonId: string;
  lessonTitle: string;
  score: number;
  maxScore: number;
  /** `null` while an attempt is still in progress. */
  completedAt: Date | null;
};

/** Submission scores are already on a 0-100 scale; absent assessments carry no marks. */
export function submissionToAttempt(row: {
  id: string;
  promptId: string;
  submittedAt?: Date | null;
  prompt: { title: string };
  assessment?: { overallScore: number | null } | null;
}): AttemptInput {
  const score = row.assessment?.overallScore;
  const scored = typeof score === "number" && Number.isFinite(score);
  return {
    id: row.id,
    lessonId: row.promptId,
    lessonTitle: row.prompt.title,
    completedAt: row.submittedAt ?? null,
    score: scored ? score : 0,
    maxScore: scored ? 100 : 0,
  };
}

/** A completed attempt that is safe to render (percentage already guarded). */
export type AttemptView = {
  id: string;
  skill: ProgressSkill;
  lessonId: string;
  lessonTitle: string;
  score: number;
  maxScore: number;
  completedAt: Date;
  /** Rounded 0-100 percentage, or `null` when maxScore is 0/absent. */
  percentage: number | null;
};

/** One plotted point on the trend line — always has a real percentage. */
export type TrendPoint = {
  id: string;
  percentage: number;
  completedAt: Date;
};

export type SkillStats = {
  skill: ProgressSkill;
  /** Completed attempts, including ones with `maxScore = 0`. */
  attemptCount: number;
  /** Completed attempts that carry marks (and so have a percentage). */
  scoredAttemptCount: number;
  /** Sum of rounded per-attempt percentages, before averaging. */
  percentageSum: number;
  averagePercentage: number | null;
  bestPercentage: number | null;
  /** Newest first, capped at `RECENT_ATTEMPT_LIMIT`. */
  recent: AttemptView[];
  /** Oldest → newest, for the SVG trend line. */
  trend: TrendPoint[];
};

export type ProgressOverview = {
  reading: SkillStats;
  listening: SkillStats;
  writing: SkillStats;
  speaking: SkillStats;
  /** Newest-first merge of all four skills, capped at `RECENT_ATTEMPT_LIMIT`. */
  recentAttempts: AttemptView[];
  totalAttempts: number;
  /** Attempts that carry marks, across all four skills. */
  totalScoredAttempts: number;
  overallAveragePercentage: number | null;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Rounded percentage for one attempt.
 *
 * Returns `null` when there is nothing to divide by (`maxScore <= 0`) or the
 * numbers are unusable, so callers never have to guard against `NaN`/`Infinity`.
 * A score above maxScore is clamped to 100 instead of producing a percentage
 * that would break the chart scale.
 */
export function percentageOf(score: number, maxScore: number): number | null {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore)) return null;
  if (maxScore <= 0) return null;

  const boundedScore = Math.min(Math.max(score, 0), maxScore);
  return Math.round((boundedScore / maxScore) * 100);
}

/** Mean of a list of percentages, rounded. `null` for an empty list. */
export function averageOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

/** Only finished attempts count towards progress. */
export function isCompleted(attempt: Pick<AttemptInput, "completedAt">): boolean {
  return attempt.completedAt instanceof Date && !Number.isNaN(attempt.completedAt.getTime());
}

/**
 * Turns raw attempt rows for ONE skill into the dashboard statistics.
 *
 * In-progress attempts are dropped, the rest are sorted newest-first, and the
 * percentage-bearing subset drives the average, the best score and the trend.
 */
export function summariseAttempts(
  skill: ProgressSkill,
  attempts: readonly AttemptInput[],
  limit: number = RECENT_ATTEMPT_LIMIT,
): SkillStats {
  const completed = attempts
    .filter(isCompleted)
    .map<AttemptView>((attempt) => ({
      id: attempt.id,
      skill,
      lessonId: attempt.lessonId,
      lessonTitle: attempt.lessonTitle,
      score: attempt.score,
      maxScore: attempt.maxScore,
      completedAt: attempt.completedAt as Date,
      percentage: percentageOf(attempt.score, attempt.maxScore),
    }))
    .sort(
      (a, b) =>
        b.completedAt.getTime() - a.completedAt.getTime() ||
        a.id.localeCompare(b.id),
    );

  const percentages = completed
    .map((attempt) => attempt.percentage)
    .filter((percentage): percentage is number => percentage !== null);

  const recent = completed.slice(0, Math.max(0, limit));

  return {
    skill,
    attemptCount: completed.length,
    scoredAttemptCount: percentages.length,
    percentageSum: percentages.reduce((sum, value) => sum + value, 0),
    averagePercentage: averageOf(percentages),
    bestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
    recent,
    trend: toTrendPoints(recent),
  };
}

/** Oldest → newest, scored attempts only — the shape the SVG line consumes. */
export function toTrendPoints(attempts: readonly AttemptView[]): TrendPoint[] {
  return attempts
    .filter(
      (attempt): attempt is AttemptView & { percentage: number } =>
        attempt.percentage !== null,
    )
    .map((attempt) => ({
      id: attempt.id,
      percentage: attempt.percentage,
      completedAt: attempt.completedAt,
    }))
    .reverse();
}

/**
 * Merges each skill's recent list into one newest-first activity feed.
 *
 * Taking the top `limit` of the merge is correct even though each input list is
 * already capped: an attempt below a skill's own top `limit` is older than
 * `limit` attempts of that same skill, so it can never enter the global top
 * `limit`.
 */
export function combineRecent(
  statsList: readonly SkillStats[],
  limit: number = RECENT_ATTEMPT_LIMIT,
): AttemptView[] {
  return statsList
    .flatMap((stats) => stats.recent)
    .sort(
      (a, b) =>
        b.completedAt.getTime() - a.completedAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .slice(0, Math.max(0, limit));
}

/** Weighted average across every scored attempt, or `null` if there are none. */
export function overallAverage(statsList: readonly SkillStats[]): number | null {
  const scored = statsList.filter(
    (stats) => stats.scoredAttemptCount > 0,
  );
  if (scored.length === 0) return null;

  const total = scored.reduce(
    (sum, stats) => sum + stats.percentageSum,
    0,
  );
  const count = scored.reduce((sum, stats) => sum + stats.scoredAttemptCount, 0);
  return count === 0 ? null : Math.round(total / count);
}

// ---------------------------------------------------------------------------
// Database read (SELECT only)
// ---------------------------------------------------------------------------

/** Four ownership-scoped SELECTs, awaited sequentially for the single-connection pooler. */
export async function getProgressOverview(
  userId: string,
  db?: Pick<PrismaClient, "readingAttempt" | "listeningAttempt" | "writingSubmission" | "speakingSubmission">,
): Promise<ProgressOverview> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const readingRows = await prisma.readingAttempt.findMany({
    relationLoadStrategy: "join",
    where: { userId, completedAt: { not: null } },
    select: {
      id: true,
      lessonId: true,
      score: true,
      maxScore: true,
      completedAt: true,
      lesson: { select: { title: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  const listeningRows = await prisma.listeningAttempt.findMany({
    relationLoadStrategy: "join",
    where: { userId, completedAt: { not: null } },
    select: {
      id: true,
      lessonId: true,
      score: true,
      maxScore: true,
      completedAt: true,
      lesson: { select: { title: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  const writingRows = await prisma.writingSubmission.findMany({
    relationLoadStrategy: "join",
    where: { userId, status: { not: "DRAFT" } },
    select: {
      id: true,
      promptId: true,
      submittedAt: true,
      prompt: { select: { title: true } },
      assessment: { select: { overallScore: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const speakingRows = await prisma.speakingSubmission.findMany({
    relationLoadStrategy: "join",
    where: { userId, status: { not: "DRAFT" } },
    select: {
      id: true,
      promptId: true,
      submittedAt: true,
      prompt: { select: { title: true } },
      assessment: { select: { overallScore: true } },
    },
    orderBy: { submittedAt: "desc" },
  });

  const reading = summariseAttempts(
    "reading",
    readingRows.map((row) => ({
      id: row.id,
      lessonId: row.lessonId,
      lessonTitle: row.lesson.title,
      score: row.score,
      maxScore: row.maxScore,
      completedAt: row.completedAt,
    })),
  );

  const listening = summariseAttempts(
    "listening",
    listeningRows.map((row) => ({
      id: row.id,
      lessonId: row.lessonId,
      lessonTitle: row.lesson.title,
      score: row.score,
      maxScore: row.maxScore,
      completedAt: row.completedAt,
    })),
  );

  const writing = summariseAttempts("writing", writingRows.map(submissionToAttempt));
  const speaking = summariseAttempts("speaking", speakingRows.map(submissionToAttempt));
  const statsList = [reading, listening, writing, speaking];

  return {
    reading,
    listening,
    writing,
    speaking,
    recentAttempts: combineRecent(statsList),
    totalAttempts: statsList.reduce((sum, stats) => sum + stats.attemptCount, 0),
    totalScoredAttempts: statsList.reduce((sum, stats) => sum + stats.scoredAttemptCount, 0),
    overallAveragePercentage: overallAverage(statsList),
  };
}
