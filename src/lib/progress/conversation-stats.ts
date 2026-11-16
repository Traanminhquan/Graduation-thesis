import type { PrismaClient } from "@prisma/client";

import { averageOf, percentageOf, RECENT_ATTEMPT_LIMIT, type TrendPoint } from "./stats";

export type ConversationStats = {
  attemptCount: number;
  scoredAttemptCount: number;
  averagePercentage: number | null;
  bestPercentage: number | null;
  trend: TrendPoint[];
};

type ConversationRow = {
  id: string;
  scenarioId: string;
  endedAt: Date | null;
  startedAt: Date;
  overallScore: number | null;
};

/** Rows are ended sessions; a missing end timestamp falls back to the start. */
export function summariseConversations(rows: readonly ConversationRow[]): ConversationStats {
  const scored = rows.flatMap((row): TrendPoint[] => {
    const percentage = row.overallScore === null ? null : percentageOf(row.overallScore, 100);
    return percentage === null ? [] : [{
      id: row.id,
      percentage,
      completedAt: row.endedAt ?? row.startedAt,
    }];
  }).sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime() || a.id.localeCompare(b.id));
  const percentages = scored.map((point) => point.percentage);

  return {
    attemptCount: rows.length,
    scoredAttemptCount: scored.length,
    averagePercentage: averageOf(percentages),
    bestPercentage: percentages.length > 0 ? Math.max(...percentages) : null,
    trend: scored.slice(0, RECENT_ATTEMPT_LIMIT).reverse(),
  };
}

/** One bounded, owner-scoped read; importing this module does not open a database. */
export async function getConversationStats(
  userId: string,
  db?: Pick<PrismaClient, "conversationSession">,
): Promise<ConversationStats> {
  const prisma = db ?? (await import("@/lib/db")).prisma;
  const rows = await prisma.conversationSession.findMany({
    relationLoadStrategy: "join",
    where: { userId, status: "ENDED" },
    select: {
      id: true,
      scenarioId: true,
      startedAt: true,
      endedAt: true,
      assessment: { select: { overallScore: true } },
    },
    orderBy: { endedAt: "desc" },
    take: 50,
  });
  return summariseConversations(rows.map((row) => ({
    id: row.id,
    scenarioId: row.scenarioId,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    overallScore: row.assessment?.overallScore ?? null,
  })));
}
