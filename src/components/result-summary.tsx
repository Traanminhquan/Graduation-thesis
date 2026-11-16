import { sharedMessages } from "@/i18n/messages/shared";
import { getMessages } from "@/i18n/server";
import type { ReactNode } from "react";

import { PenMark } from "@/components/pen-mark";

/**
 * The mark at the top of a Reading or Listening result: the score as the
 * teacher wrote it, one remark, and what to do next.
 */
export async function ResultSummary({
  score,
  maxScore,
  correctCount,
  questionCount,
  message,
  completedAt,
  actions,
}: {
  score: number;
  maxScore: number;
  correctCount: number;
  questionCount: number;
  message: string;
  completedAt: string | null;
  actions: ReactNode;
}) {
  const t = await getMessages(sharedMessages);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return (
    <section aria-label={t.yourScore} className="mt-8">
      <div className="flex flex-col items-start gap-x-10 gap-y-4 sm:flex-row sm:items-center">
        <PenMark
          value={String(correctCount)}
          outOf={String(questionCount)}
          label={t.correctCount(correctCount, questionCount)}
        />
        <div className="min-w-0">
          <p className="font-display text-2xl leading-snug text-ink">{message}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {percentage}%{completedAt ? t.saved(completedAt) : ""}
          </p>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">{actions}</div>
    </section>
  );
}

/** Per-attempt message, phrased for the skill by the caller. */
export function bandMessage(
  percentage: number,
  messages: { perfect?: string; excellent: string; good: string; fair: string; low: string },
): string {
  if (percentage >= 100 && messages.perfect) return messages.perfect;
  if (percentage >= 90) return messages.excellent;
  if (percentage >= 70) return messages.good;
  if (percentage >= 50) return messages.fair;
  return messages.low;
}
