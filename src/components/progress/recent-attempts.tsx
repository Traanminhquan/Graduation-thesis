import { getMessages, getLocale } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatAttemptDate, scoreBand } from "@/lib/progress/format";
import type { AttemptView } from "@/lib/progress/stats";
import { sheet } from "@/lib/ui";


/**
 * Newest-first activity feed across all four skills. Every row links to the
 * existing result page for that attempt, so progress leads straight back into
 * the per-question review.
 */
export async function RecentAttempts({ attempts }: { attempts: readonly AttemptView[] }) {
  const t = await getMessages(progressMessages);
  const locale = await getLocale();
  return (
    <ul className={`${sheet} divide-y divide-line`}>
      {attempts.map((attempt) => {
        const band = scoreBand(attempt.percentage);
        return (
          <li key={`${attempt.skill}-${attempt.id}`}>
            <Link
              href={`/${attempt.skill}/${attempt.lessonId}/result/${attempt.id}`}
              className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors first:rounded-t-[3px] hover:bg-canvas"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">
                  {attempt.lessonTitle}
                </span>
                <span className="block text-sm text-ink-muted">
                  {t.skills[attempt.skill]}, {formatAttemptDate(attempt.completedAt, locale)}
                </span>
              </span>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", band.className)}>
                {attempt.percentage === null ? t.notScored : `${attempt.percentage}%`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
