import { INTL_LOCALE } from "@/i18n/config";

import { getMessages, getLocale } from "@/i18n/server";
import { writingMessages } from "@/i18n/messages/writing";
import { localizeAnalysisNote } from "@/lib/writing/analysis";
import type { WritingAnalysis } from "@/lib/writing/analysis";
import { cn } from "@/lib/cn";
import { sheet } from "@/lib/ui";

/**
 * Deterministic rule-based summary of one submission.
 *
 * Every figure comes from `analyseWriting`, which is recomputed from the stored
 * text on each request. Nothing here is an AI judgement, and the panel says so.
 */
export async function BasicCheck({
  analysis,
  minWords,
  maxWords,
}: {
  analysis: WritingAnalysis;
  minWords: number | null;
  maxWords: number | null;
}) {
  const t = await getMessages(writingMessages);
  const locale = await getLocale();
  const { target, repeatedWords, notes } = analysis;

  const targetTone =
    target.status === "within"
      ? "text-tick"
      : target.status === "under"
        ? "text-caution"
        : target.status === "over"
          ? "text-pen"
          : "text-ink-soft";

  return (
    <section aria-labelledby="basic-check-heading" className="mt-10">
      <h2 id="basic-check-heading" className="text-2xl font-semibold text-ink">
        {t.basicCheck}
      </h2>
      <p className="mt-1 text-base leading-7 text-ink-soft">
        {t.lengthAndRepetitionOnlyGrammarAndIdeasAreNotJudgedHere}
      </p>

      <div className={cn(sheet, "mt-3 p-6 sm:p-8")}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Stat label={t.words} value={analysis.wordCount.toLocaleString(INTL_LOCALE[locale])} />
          <Stat label={t.sentences} value={analysis.sentenceCount.toLocaleString(INTL_LOCALE[locale])} />
          <Stat
            label={t.wordsPerSentence}
            value={
              analysis.averageSentenceLength === null
                ? "—"
                : `${analysis.averageSentenceLength}`
            }
          />
          <Stat
            label={t.longestSentence}
            value={
              analysis.sentenceCount === 0
                ? "—"
                : analysis.longestSentenceWords.toLocaleString(INTL_LOCALE[locale])
            }
          />
        </dl>

        <p className={cn("mt-6 text-base font-semibold", targetTone)}>
          {target.status === "none" ? (
            <>{t.thisTopicHasNoWordTarget}</>
          ) : target.status === "under" ? (
            <>{t.underCheck(target.wordsToMinimum, target.min)}</>
          ) : target.status === "over" ? (
            <>{t.overCheck(target.wordsOverMaximum, target.max)}</>
          ) : (
            <>{t.insideCheck(t.wordTarget(minWords, maxWords))}</>
          )}
        </p>

        {repeatedWords.length > 0 ? (
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="font-sans text-base font-semibold text-ink">
              {t.wordsUsedThreeOrMoreTimes}
      </h3>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base text-ink">
              {repeatedWords.map(({ word, count }) => (
                <li key={word}>
                  {word} <span className="text-ink-muted">×{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {notes.filter((note) => !note.startsWith("Word count")).length > 0 ? (
          <ul className="mt-5 list-disc space-y-1 border-t border-line pl-5 pt-5 text-base leading-7 text-ink-soft marker:text-ink-muted">
            {notes
              .filter((note) => !note.startsWith("Word count"))
              .map((note) => (
                <li key={note}>{localizeAnalysisNote(note, analysis, locale)}</li>
              ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-3xl font-semibold tabular-nums text-ink">
        {value}
      </dd>
    </div>
  );
}
