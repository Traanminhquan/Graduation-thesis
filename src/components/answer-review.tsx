import { sharedMessages } from "@/i18n/messages/shared";
import { getMessages } from "@/i18n/server";

import type { ReactNode } from "react";

import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Seeded explanations use *asterisks* for emphasis. Render them as emphasis
 * instead of showing the literal markers.
 */
function Emphasised({ text }: { text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*") ? (
          <em key={index} className="font-medium text-ink">
            {part.slice(1, -1)}
          </em>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

/** One marked question: a tick or a cross in the margin, then the reasoning. */
export async function AnswerReview({
  number,
  prompt,
  correct,
  response,
  answer,
  explanation,
}: {
  number: number;
  prompt: string;
  correct: boolean;
  response: ReactNode;
  answer: ReactNode;
  explanation: string | null;
}) {
  const t = await getMessages(sharedMessages);
  return (
    <article className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid size-7 place-items-center rounded-full font-semibold",
          correct ? "bg-tick-soft text-tick" : "bg-pen-soft text-pen",
        )}
      >
        {correct ? <CheckIcon className="size-4" /> : "✕"}
      </span>

      <div className="min-w-0">
        <h3 className="font-sans text-base font-semibold leading-7 text-ink">
          <span className="sr-only">{correct ? t.correct : t.incorrect}</span>
          {number}. {prompt}
        </h3>

        <dl className="mt-2 space-y-1 text-[0.9375rem] leading-6">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-muted">{t.yourAnswer}</dt>
            <dd className={cn("min-w-0 font-medium", correct ? "text-tick" : "text-pen")}>
              {response}
            </dd>
          </div>
          {correct ? null : (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-ink-muted">{t.correctAnswer}</dt>
              <dd className="min-w-0 font-medium text-ink">{answer}</dd>
            </div>
          )}
        </dl>

        {explanation ? (
          <p className="mt-2 text-[0.9375rem] leading-6 text-ink-soft">
            <Emphasised text={explanation} />
          </p>
        ) : null}
      </div>
    </article>
  );
}
