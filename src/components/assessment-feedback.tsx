import { sharedMessages } from "@/i18n/messages/shared";
import { getMessages } from "@/i18n/server";

import type { ReactNode } from "react";

import { PenMark } from "@/components/pen-mark";
import { readingText, sheet } from "@/lib/ui";

export function AssessmentSummary({ summary }: { summary: string | null }) {
  if (!summary?.trim()) return null;
  return <p className={`${readingText} mt-6 min-w-0 [overflow-wrap:anywhere]`}>{summary}</p>;
}

/** Stored labels come from the model as keys (`verb_tense`); show them as words. */
function errorLabel(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\.$/, "");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

type Correction = { original: string; corrected: string; explanation: string; errorType?: string };

/** The overall score and its four dimensions, for Writing and Speaking. */
export async function ScoreBreakdown({
  overall,
  scores,
}: {
  overall: number;
  scores: readonly (readonly [string, number])[];
}) {
  const t = await getMessages(sharedMessages);
  const rounded = String(Math.round(overall * 10) / 10);
  return (
    <div className="flex flex-col items-start gap-x-12 gap-y-6 sm:flex-row sm:items-center">
      <PenMark value={rounded} outOf="100" label={t.overallScore(rounded)} />
      {/* The marking scheme: one ruled line per criterion, as on a printed rubric. */}
      <dl className="w-full min-w-0 max-w-sm">
        {scores.map(([label, score]) => (
          <div key={label} className="flex items-baseline gap-2 py-1.5">
            <dt className="text-base text-ink-soft">{label}</dt>
            <span
              aria-hidden="true"
              className="min-w-4 flex-1 -translate-y-1 border-b border-dotted border-line-strong"
            />
            <dd className="font-display text-xl font-semibold tabular-nums text-ink">{score}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export async function CorrectionList({ corrections }: { corrections: readonly Correction[] }) {
  const t = await getMessages(sharedMessages);
  if (corrections.length === 0) {
    return (
      <p className="mt-2 text-base leading-7 text-ink-soft">
        {t.noCorrections}
      </p>
    );
  }

  return (
    <ul className="mt-2 divide-y divide-line">
      {corrections.map((correction, index) => (
        <li key={index} className="py-4">
          <p className="font-display text-lg leading-8 text-ink">
            <del className="text-pen decoration-pen decoration-2">{correction.original}</del>{" "}
            <ins className="marked no-underline">{correction.corrected}</ins>
          </p>
          <p className="mt-1 text-[0.9375rem] leading-6 text-ink-soft">
            {correction.errorType ? (
              <span className="font-semibold text-ink">{errorLabel(correction.errorType)}. </span>
            ) : null}
            {correction.explanation}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function SuggestionList({ suggestions }: { suggestions: readonly string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-2 pl-5 text-base leading-7 text-ink-soft marker:text-ink-muted">
      {suggestions.map((suggestion, index) => (
        <li key={index}>{suggestion}</li>
      ))}
    </ul>
  );
}

/**
 * The learner's text with each correction marked where it occurs. Originals are
 * matched left to right; one that cannot be found stays in the list above but
 * is not forced into the text.
 */
export function MarkedText({
  text,
  corrections,
}: {
  text: string;
  corrections: readonly Correction[];
}) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  const ordered = [...corrections].sort(
    (a, b) => text.indexOf(a.original) - text.indexOf(b.original),
  );

  ordered.forEach((correction, index) => {
    if (!correction.original) return;
    const at = text.indexOf(correction.original, cursor);
    if (at === -1) return;
    nodes.push(text.slice(cursor, at));
    nodes.push(
      <span key={index}>
        <del className="text-pen decoration-pen decoration-2">{correction.original}</del>{" "}
        <ins className="marked no-underline">{correction.corrected}</ins>
      </span>,
    );
    cursor = at + correction.original.length;
  });
  nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}

/** A plain section heading inside the feedback sheet. */
export function FeedbackHeading({ children }: { children: ReactNode }) {
  return <h3 className="mt-8 font-sans text-base font-semibold text-ink">{children}</h3>;
}

export function TextSheet({ children }: { children: ReactNode }) {
  return <div className={`${sheet} mt-3 p-6 sm:p-8`}>{children}</div>;
}
