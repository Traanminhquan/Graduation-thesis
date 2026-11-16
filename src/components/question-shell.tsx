"use client";

import { sharedMessages } from "@/i18n/messages/shared";
import { useMessages } from "@/i18n/client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { alertError, buttonPrimary } from "@/lib/ui";

/** A numbered question with its answer controls. */
export function QuestionShell({
  number,
  prompt,
  children,
}: {
  number: number;
  prompt: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 py-6 first:pt-0">
      <legend className="sr-only">{prompt}</legend>
      <span aria-hidden="true" className="font-display text-xl font-semibold leading-7 text-ink-muted">
        {number}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-7 text-ink">{prompt}</p>
        <div className="mt-3">{children}</div>
      </div>
    </fieldset>
  );
}

/** Stays on screen while the learner works down the questions. */
export function SubmitBar({
  answered,
  total,
  pending,
  error,
}: {
  answered: number;
  total: number;
  pending: boolean;
  error: string | null;
}) {
  const t = useMessages(sharedMessages);
  return (
    <div className="sticky bottom-0 z-10 -mx-5 border-t border-line bg-canvas px-5 py-3 sm:mx-0 sm:px-0">
      {error ? (
        <p role="alert" className={cn(alertError, "mb-3")}>
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          <span className="font-semibold text-ink">
            {t.answeredCount(answered, total)}
          </span>{" "}
          {t.answered}
        </p>
        <button type="submit" disabled={pending} className={buttonPrimary}>
          {pending ? t.checking : t.submit}
        </button>
      </div>
    </div>
  );
}
