"use client";

import { readingMessages } from "@/i18n/messages/reading";
import { useMessages } from "@/i18n/client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import type { SubmitReadingState } from "@/app/[lang]/reading/actions";
import { QuestionShell, SubmitBar } from "@/components/question-shell";
import type { ReadingQuestionView } from "@/lib/reading/data";
import {
  isChoiceQuestion,
} from "@/lib/reading/scoring";
import { choiceInput, choiceRow, field } from "@/lib/ui";

type ReadingFormProps = {
  /** Bound server action: (prevState, formData) => state */
  action: (
    previous: SubmitReadingState,
    formData: FormData,
  ) => Promise<SubmitReadingState>;
  questions: ReadingQuestionView[];
};

export function ReadingForm({ action, questions }: ReadingFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [answered, setAnswered] = useState(0);

  function handleChange(event: FormEvent<HTMLFormElement>) {
    const answeredIds = new Set<string>();
    new FormData(event.currentTarget).forEach((value, key) => {
      if (key.startsWith("q_") && typeof value === "string" && value.trim()) {
        answeredIds.add(key);
      }
    });
    setAnswered(answeredIds.size);
  }

  return (
    <form
      // React resets uncontrolled fields after a `form action` submission,
      // including a rejected one. Dispatching from `onSubmit` keeps the
      // learner's answers in place when the server returns an error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
          formAction(formData);
        });
      }}
      onInput={handleChange}
    >
      <ol className="divide-y divide-line">
        {questions.map((question, index) => (
          <li key={question.id}>
            <ReadingQuestion question={question} number={index + 1} />
          </li>
        ))}
      </ol>

      <SubmitBar answered={answered} total={questions.length} pending={pending} error={state.error} />
    </form>
  );
}

export function ReadingQuestion({
  question,
  number,
}: {
  question: ReadingQuestionView;
  number: number;
}) {
  return (
    <QuestionShell number={number} prompt={question.prompt}>
      {isChoiceQuestion(question.type) ? (
        <ChoiceOptions question={question} />
      ) : question.type === "TRUE_FALSE" ? (
        <TrueFalseOptions questionId={question.id} />
      ) : (
        <FillBlankInput questionId={question.id} />
      )}
    </QuestionShell>
  );
}

function ChoiceOptions({ question }: { question: ReadingQuestionView }) {
  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label key={`${question.id}-${index}`} className={choiceRow}>
          <input
            type="radio"
            name={`q_${question.id}`}
            value={option}
            required
            className={choiceInput}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function TrueFalseOptions({ questionId }: { questionId: string }) {
  const t = useMessages(readingMessages);
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { value: "true", label: t.trueLabel },
        { value: "false", label: t.falseLabel },
      ].map((option) => (
        <label key={option.value} className={choiceRow}>
          <input
            type="radio"
            name={`q_${questionId}`}
            value={option.value}
            required
            className={choiceInput}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function FillBlankInput({ questionId }: { questionId: string }) {
  const t = useMessages(readingMessages);
  return (
    <>
      <label htmlFor={`q_${questionId}`} className="sr-only">
        {t.yourAnswer}
      </label>
      <input
        id={`q_${questionId}`}
        name={`q_${questionId}`}
        type="text"
        required
        autoComplete="off"
        spellCheck={false}
        placeholder={t.missingWord}
        className={field}
      />
    </>
  );
}
