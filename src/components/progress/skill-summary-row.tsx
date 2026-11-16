import { getMessages } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import Link from "next/link";

import { TrendChart } from "@/components/progress/trend-chart";
import { formatPercentage } from "@/lib/progress/format";
import type { SkillStats } from "@/lib/progress/stats";
import { linkInline } from "@/lib/ui";

/**
 * One skill as a row: attempts, average, best score and the recent trend.
 * Renders an honest empty state when nothing is scored yet.
 */
export async function SkillSummaryRow({
  stats,
  name,
  note,
  href,
}: {
  stats: Pick<SkillStats, "attemptCount" | "averagePercentage" | "bestPercentage" | "trend"> & { skill: string };
  name: string;
  /** Qualifier shown next to the name, e.g. "content only". */
  note?: string;
  href: string;
}) {
  const t = await getMessages(progressMessages);
  const hasAttempts = stats.attemptCount > 0;
  const scored = stats.averagePercentage !== null;

  return (
    <section
      aria-labelledby={`progress-${stats.skill}-heading`}
      className="grid items-center gap-x-6 gap-y-3 p-5 sm:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[11rem_6rem_5rem_minmax(0,1fr)_auto]"
    >
      <div>
        <h3
          id={`progress-${stats.skill}-heading`}
          className="text-xl font-semibold leading-tight text-ink"
        >
          {name}
        </h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          {t.attempts(stats.attemptCount)}
          {note ? `, ${note}` : ""}
        </p>
      </div>

      {scored ? (
        <div className="contents">
          <div className="flex gap-8 sm:col-start-1 md:contents">
            <div>
              <p className="text-sm text-ink-muted">{t.average}</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-ink">
                {formatPercentage(stats.averagePercentage)}
              </p>
            </div>
            <div>
              <p className="text-sm text-ink-muted">{t.best}</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-ink">
                {formatPercentage(stats.bestPercentage)}
              </p>
            </div>
          </div>
          <div className="min-w-0 max-w-xs sm:col-start-1 md:col-start-auto">
            {stats.trend.length > 1 ? (
              <TrendChart points={stats.trend} accentClassName="text-ink" skillLabel={name} />
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-muted sm:col-start-1 md:col-span-3 md:col-start-auto">
          {hasAttempts ? t.saved : t.noAttempts}
        </p>
      )}

      <Link
        href={href}
        className={`${linkInline} justify-self-start text-sm sm:col-start-2 sm:row-start-1 sm:justify-self-end md:col-start-auto md:row-start-auto`}
      >
        {hasAttempts ? t.practise : t.start}
        <span className="sr-only"> {name.toLowerCase()}</span>
      </Link>
    </section>
  );
}
