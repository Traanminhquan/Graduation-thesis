"use client";

import { useActionState, useState, startTransition } from "react";
import Link from "next/link";
import { useMessages } from "@/i18n/client";
import { readingMessages } from "@/i18n/messages/reading";
import type { RetryState } from "@/app/[lang]/reading/[lessonId]/result/[attemptId]/retry/actions";
import { ReadingQuestion } from "./reading-form";
import type { ReadingQuestionView } from "@/lib/reading/data";
import { RetryReview } from "@/components/reading/retry-review";
import { buttonPrimary, linkInline } from "@/lib/ui";

type Props = { questions: ReadingQuestionView[]; resultHref: string;
  action: (previous: RetryState, formData: FormData) => Promise<RetryState> };

export function RetryForm(props: Props) {
  const [round, setRound] = useState(0);
  return <RetryRound key={round} {...props} restart={() => setRound(round + 1)} />;
}

function RetryRound({ questions, resultHref, action, restart }: Props & { restart: () => void }) {
  const t = useMessages(readingMessages);
  const [state, dispatch, pending] = useActionState(action, { review: null });
  
  const format = (type: string, value: string | null) => {
    if (!value) return t.noAnswer;
    if (type === "TRUE_FALSE") return value.trim().toLowerCase() === "true" ? t.trueLabel : t.falseLabel;
    return value;
  };
  return state.review ? (
    <div>
      <div className="divide-y divide-line" aria-live="polite">{state.review.map((question) => (
        <RetryReview key={question.id} number={question.order} prompt={question.prompt} correct={question.isCorrect}
          response={format(question.type, question.response)} answer={format(question.type, question.correctAnswer)}
          explanation={question.explanation} labels={t} showCorrectAnswer />
      ))}</div>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" onClick={restart} className={buttonPrimary}>{t.tryAgain}</button>
        <Link href={resultHref} className={linkInline}>{t.backResults}</Link>
      </div>
    </div>
  ) : (
    <form noValidate onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => dispatch(data));
    }}>
      <fieldset disabled={pending}>
        <ol className="divide-y divide-line">
          {questions.map((question) => <li key={question.id}>
            <ReadingQuestion question={question} number={question.order}  />
          </li>)}
        </ol>
        <button type="submit" className={`${buttonPrimary} mt-6`}>{t.checkAnswers}</button>
      </fieldset>
      {state.error ? <p role="alert" className="mt-3 text-sm text-pen">{state.error}</p> : null}
    </form>
  );
}
