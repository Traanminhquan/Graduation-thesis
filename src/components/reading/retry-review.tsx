"use client";

import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

/** The result page's red-pen layout, with labels supplied by the retry form. */
export function RetryReview({ number, prompt, correct, response, answer, explanation, labels, showCorrectAnswer = false }: {
  number: number; prompt: string; correct: boolean; response: ReactNode; answer: ReactNode; explanation: string | null;
  labels: { correct: string; incorrect: string; yourAnswer: string; correctAnswer: string };
  showCorrectAnswer?: boolean;
}) {
  return (
    <article className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 py-6 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
      <span aria-hidden="true" className={cn("mt-0.5 grid size-7 place-items-center rounded-full font-semibold", correct ? "bg-tick-soft text-tick" : "bg-pen-soft text-pen")}>
        {correct ? <CheckIcon className="size-4" /> : "✕"}
      </span>
      <div className="min-w-0">
        <h3 className="font-sans text-base font-semibold leading-7 text-ink">
          <span className="sr-only">{correct ? labels.correct : labels.incorrect}</span>
          {number}. {prompt}
        </h3>
        <dl className="mt-2 space-y-1 text-[0.9375rem] leading-6">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-muted">{labels.yourAnswer}</dt>
            <dd className={cn("min-w-0 font-medium", correct ? "text-tick" : "text-pen")}>{response}</dd>
          </div>
          {(!correct || showCorrectAnswer) && <div className="flex flex-wrap gap-x-2">
            <dt className="text-ink-muted">{labels.correctAnswer}</dt>
            <dd className="min-w-0 font-medium text-ink">{answer}</dd>
          </div>}
        </dl>
        {explanation ? <p className="mt-2 text-[0.9375rem] leading-6 text-ink-soft">
          {explanation.split(/(\*[^*]+\*)/g).map((part, index) => part.length > 2 && part.startsWith("*") && part.endsWith("*")
            ? <em key={index} className="font-medium text-ink">{part.slice(1, -1)}</em> : <span key={index}>{part}</span>)}
        </p> : null}
      </div>
    </article>
  );
}
