"use client";

import { listeningMessages } from "@/i18n/messages/listening";
import { useMessages } from "@/i18n/client";

import { startTransition, useActionState, useState } from "react";

import type { SubmitListeningState } from "@/app/[lang]/listening/actions";
import { QuestionShell, SubmitBar } from "@/components/question-shell";
import type { ListeningQuestionView } from "@/lib/listening/data";
import {
  isChoiceQuestion,
  type MatchingPair,
} from "@/lib/listening/scoring";
import { choiceInput, choiceRow, field } from "@/lib/ui";

type ListeningFormProps = {
  /** Bound server action: (prevState, formData) => state */
  action: (
    previous: SubmitListeningState,
    formData: FormData,
  ) => Promise<SubmitListeningState>;
  questions: ListeningQuestionView[];
};

type AnswerMap = Record<string, string>;

export function ListeningForm({ action, questions }: ListeningFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  // Controlled answers keep the learner's work when a submission is rejected
  // (React resets uncontrolled fields after a form action completes).
  const [answers, setAnswers] = useState<AnswerMap>({});

  function setAnswer(name: string, value: string) {
    setAnswers((previous) => ({ ...previous, [name]: value }));
  }

  const answered = questions.filter((question) => {
    if (question.type === "MATCHING") {
      return question.matchingPairs.every((_, index) =>
        Boolean(answers[`m_${question.id}_${index}`]),
      );
    }
    return Boolean(answers[`q_${question.id}`]);
  }).length;

  return (
    <form
      // React resets uncontrolled fields after a `form action` submission —
      // including a rejected one. Dispatching from `onSubmit` keeps the
      // learner's answers in place when the server returns an error.
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
          formAction(formData);
        });
      }}
    >
      <ol className="divide-y divide-line">
        {questions.map((question, index) => (
          <li key={question.id}>
            <ListeningQuestion
              question={question}
              number={index + 1}
              answers={answers}
              onAnswer={setAnswer}
            />
          </li>
        ))}
      </ol>

      <SubmitBar answered={answered} total={questions.length} pending={pending} error={state.error} />
    </form>
  );
}

type QuestionProps = {
  question: ListeningQuestionView;
  answers: AnswerMap;
  onAnswer: (name: string, value: string) => void;
};

export function ListeningQuestion({
  question,
  number,
  answers,
  onAnswer,
}: QuestionProps & { number: number }) {
  return (
    <QuestionShell number={number} prompt={question.prompt}>
      {isChoiceQuestion(question.type) ? (
        <ChoiceOptions question={question} answers={answers} onAnswer={onAnswer} />
      ) : question.type === "TRUE_FALSE" ? (
        <TrueFalseOptions question={question} answers={answers} onAnswer={onAnswer} />
      ) : question.type === "MATCHING" ? (
        <MatchingRows question={question} answers={answers} onAnswer={onAnswer} />
      ) : (
        <FillBlankInput question={question} answers={answers} onAnswer={onAnswer} />
      )}
    </QuestionShell>
  );
}

function ChoiceOptions({ question, answers, onAnswer }: QuestionProps) {
  const name = `q_${question.id}`;

  return (
    <div className="space-y-2">
      {question.options.map((option, index) => (
        <label
          key={`${question.id}-${index}`}
          className={choiceRow}
        >
          <input
            type="radio"
            name={name}
            value={option}
            checked={answers[name] === option}
            onChange={() => onAnswer(name, option)}
            required
            className={choiceInput}
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  );
}

function TrueFalseOptions({ question, answers, onAnswer }: QuestionProps) {
  const name = `q_${question.id}`;
  const t = useMessages(listeningMessages);

  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { value: "true", label: t.trueLabel },
        { value: "false", label: t.falseLabel },
      ].map((option) => (
        <label
          key={option.value}
          className={choiceRow}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={answers[name] === option.value}
            onChange={() => onAnswer(name, option.value)}
            required
            className={choiceInput}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function FillBlankInput({ question, answers, onAnswer }: QuestionProps) {
  const t = useMessages(listeningMessages);
  const name = `q_${question.id}`;

  return (
    <>
      <label htmlFor={name} className="sr-only">
        {t.yourAnswer}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        value={answers[name] ?? ""}
        onChange={(event) => onAnswer(name, event.target.value)}
        required
        autoComplete="off"
        spellCheck={false}
        placeholder={t.missingWord}
        className={field}
      />
    </>
  );
}

function MatchingRows({ question, answers, onAnswer }: QuestionProps) {
  const t = useMessages(listeningMessages);
  // Every right-hand option, in a stable order, so it is usable both as a
  // server render and as a hydrated client render.
  const rights = matchingOptions(question.matchingPairs);

  return (
    <div className="space-y-2">
      {question.matchingPairs.map((pair, index) => {
        const name = `m_${question.id}_${index}`;
        return (
          <div
            key={pair.left}
            className="grid gap-2 rounded-lg border border-line bg-surface px-4 py-3 sm:grid-cols-[1fr_1.2fr] sm:items-center"
          >
            <span className="text-sm font-medium text-ink">{pair.left}</span>
            <label htmlFor={name} className="sr-only">
              {t.match(pair.left)}
            </label>
            <select
              id={name}
              name={name}
              required
              value={answers[name] ?? ""}
              onChange={(event) => onAnswer(name, event.target.value)}
              className={field}
            >
              <option value="" disabled>
                {t.choose}
              </option>
              {rights.map((right) => (
                <option key={right} value={right}>
                  {right}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}

/** Unique right-hand values for the selects, in a deterministic order. */
function matchingOptions(pairs: MatchingPair[]): string[] {
  return [...new Set(pairs.map((pair) => pair.right))].sort();
}
