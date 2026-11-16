import { getMessages } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import type { ReactNode } from "react";

import { RecentAttempts } from "@/components/progress/recent-attempts";
import { SkillSummaryRow } from "@/components/progress/skill-summary-row";
import { VocabularySection } from "@/components/progress/vocabulary-section";
import { formatPercentage } from "@/lib/progress/format";
import type { ConversationStats } from "@/lib/progress/conversation-stats";
import { type ProgressOverview } from "@/lib/progress/stats";
import type { VocabularyWord } from "@/lib/progress/vocabulary";
import { sheet } from "@/lib/ui";

/**
 * The populated /progress layout. Data and the (streamed) weakness section are
 * passed in, so this stays purely presentational.
 */
export async function ProgressDashboard({
  overview,
  weakness,
  words,
  conversation,
}: {
  overview: ProgressOverview;
  weakness: ReactNode;
  words: readonly VocabularyWord[];
  conversation?: ConversationStats | null;
}) {
  const t = await getMessages(progressMessages);
  return (
    <div className="mt-6 space-y-10">
      <section aria-label={t.summary}>
        <p className="max-w-3xl font-display text-2xl leading-snug text-ink sm:text-3xl sm:leading-snug">
          <Marked>{overview.totalAttempts}</Marked>{" "}
          {t.attemptsSoFar(overview.totalAttempts)}
          {overview.overallAveragePercentage === null ? (
            t.noneScored
          ) : (
            <>
              {overview.totalScoredAttempts < overview.totalAttempts ? (
                <>
                  , <Marked>{overview.totalScoredAttempts}</Marked>{t.scored}
                </>
              ) : null}
              {t.withAverage}{" "}
              <Marked>{formatPercentage(overview.overallAveragePercentage)}</Marked>.
            </>
          )}
        </p>
      </section>

      <section aria-labelledby="by-skill-heading">
        <h2 id="by-skill-heading" className="text-2xl font-semibold text-ink">
          {t.bySkill}
        </h2>
        <div className={`${sheet} mt-3 divide-y divide-line`}>
          <SkillSummaryRow stats={overview.reading} name={t.skills.reading} href="/reading" />
          <SkillSummaryRow stats={overview.listening} name={t.skills.listening} href="/listening" />
          <SkillSummaryRow stats={overview.writing} name={t.skills.writing} href="/writing" />
          <SkillSummaryRow stats={overview.speaking} name={t.skills.speaking} note={t.contentOnly} href="/speaking" />
          {conversation ? (
            <SkillSummaryRow stats={{ ...conversation, skill: "conversation" }} name={t.skills.conversation} href="/conversation" />
          ) : null}
        </div>
      </section>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {weakness}

        <div className="min-w-0 space-y-10">
          <section aria-labelledby="recent-attempts-heading" className="min-w-0">
            <h2 id="recent-attempts-heading" className="text-2xl font-semibold text-ink">
              {t.recent}
            </h2>
            <div className="mt-3">
              <RecentAttempts attempts={overview.recentAttempts} />
            </div>
          </section>

          <VocabularySection words={words} />
        </div>
      </div>

    </div>
  );
}

/** A figure inside the summary sentence, run over with the highlighter. */
function Marked({ children }: { children: ReactNode }) {
  return <span className="marked font-semibold tabular-nums">{children}</span>;
}
