import { readingMessages } from "@/i18n/messages/reading";
import { getMessages, getLocale } from "@/i18n/server";
import { INTL_LOCALE } from "@/i18n/config";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { RetryReview as AnswerReview } from "@/components/reading/retry-review";
import { Container } from "@/components/container";
import { LessonHeader, ResultSkeleton } from "@/components/lesson-header";
import { bandMessage, ResultSummary } from "@/components/result-summary";
import { requireUser } from "@/lib/auth/current-user";
import {
  getReadingAttemptForUser,
  getReadingRetryForUser,
  type ReadingReviewQuestion,
} from "@/lib/reading/data";
import { buttonPrimary, linkInline } from "@/lib/ui";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(readingMessages);
  const title = await catalogueTitle("reading", (await params).lessonId);
  return { title: title ? t.resultTitle(title) : t.results };
}

/** Per-request page: attempt ids only exist at runtime (see the lesson page). */
export const instant = false;

type ResultPageProps = {
  params: Promise<{ lessonId: string; attemptId: string }>;
};

export default function ReadingResultPage({ params }: ResultPageProps) {
  return (
    <Container narrow className="py-8 sm:py-10">
      <Suspense fallback={<ResultSkeleton />}>
        <ResultRunner params={params} />
      </Suspense>
    </Container>
  );
}

async function ResultRunner({ params }: ResultPageProps) {
  const t = await getMessages(readingMessages);
  await connection();
  const { lessonId, attemptId } = await params;
  const user = await requireUser();

  // Scoped to the signed-in user: another learner's attempt id resolves to a
  // 404 rather than leaking its answers.
  const attempt = await getReadingAttemptForUser(attemptId, user.id);
  if (!attempt || attempt.lessonId !== lessonId) notFound();

  const retry = await getReadingRetryForUser(attemptId, user.id, lessonId);

  const percentage =
    attempt.maxScore > 0
      ? Math.round((attempt.score / attempt.maxScore) * 100)
      : 0;
  const correctCount = attempt.questions.filter(
    (question) => question.isCorrect,
  ).length;
  const completedAt = attempt.completedAt
    ? new Intl.DateTimeFormat(INTL_LOCALE[await getLocale()], {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(attempt.completedAt)
    : null;

  return (
    <>
      <LessonHeader
        backHref="/reading"
        backLabel={t.back}
        title={attempt.lessonTitle}
        facts={[attempt.lessonTopic]}
      />

      <ResultSummary
        score={attempt.score}
        maxScore={attempt.maxScore}
        correctCount={correctCount}
        questionCount={attempt.questions.length}
        completedAt={completedAt}
        message={bandMessage(percentage, {
          excellent: t.excellent,
          good: t.good,
          fair: t.fair,
          low: t.low,
        })}
        actions={
          <>
            <Link href="/reading" className={buttonPrimary}>
              {t.next}
            </Link>
            <Link href={`/reading/${attempt.lessonId}`} className={linkInline}>
              {t.retry}
            </Link>
            {Boolean(retry?.wrongIds.length) && (
              <Link href={`/reading/${lessonId}/result/${attemptId}/retry`} className={linkInline}>{t.retryMissed}</Link>
            )}
            <Link href="/progress" className={linkInline}>
              {t.progress}
            </Link>
          </>
        }
      />

      <section aria-labelledby="review-heading" className="mt-10">
        <h2 id="review-heading" className="text-2xl font-semibold text-ink">
          {t.review}
        </h2>
        <ol className="mt-2 divide-y divide-line">
          {attempt.questions.map((question, index) => (
            <li key={question.id}>
              <AnswerReview
                labels={{ correct: t.correct, incorrect: t.incorrect, yourAnswer: t.yourAnswer, correctAnswer: t.correctAnswer }}
                number={index + 1}
                prompt={question.prompt}
                correct={question.isCorrect}
                response={formatAnswer(question, question.response, t) ?? t.noAnswer}
                answer={formatAnswer(question, question.correctAnswer, t)}
                explanation={question.explanation}
              />
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

function formatAnswer(
  question: ReadingReviewQuestion,
  value: string | null,
  t: { trueLabel: string; falseLabel: string },
): string | null {
  if (!value) return null;
  if (question.type === "TRUE_FALSE") {
    return value.trim().toLowerCase() === "true" ? t.trueLabel : t.falseLabel;
  }
  return value;
}
