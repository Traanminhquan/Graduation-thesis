
import { getMessages, getLocale } from "@/i18n/server";
import { writingMessages } from "@/i18n/messages/writing";
import type { Metadata } from "next";
import Link from "next/link";
import { requestAssessment } from "./actions";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  AssessmentSummary,
  CorrectionList,
  FeedbackHeading,
  MarkedText,
  ScoreBreakdown,
  SuggestionList,
  TextSheet,
} from "@/components/assessment-feedback";
import { Container } from "@/components/container";
import { LessonHeader, ResultSkeleton } from "@/components/lesson-header";
import { BasicCheck } from "@/components/writing/basic-check";
import { requireUser } from "@/lib/auth/current-user";
import { getWritingSubmissionForUser } from "@/lib/writing/data";
import { analyseWriting } from "@/lib/writing/analysis";
import {
  formatSubmittedAt,
} from "@/lib/writing/format";
import { alertNotice, buttonPrimary, linkInline, readingText, sheet } from "@/lib/ui";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ promptId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(writingMessages);
  const title = await catalogueTitle("writing", (await params).promptId);
  return { title: title ? t.results(title) : t.writingResult };
}

/** Per-request page: submission ids only exist at runtime (see the prompt page). */
export const instant = false;

type ResultPageProps = {
  params: Promise<{ promptId: string; submissionId: string }>;
  searchParams: Promise<{ ai?: string }>;
};

export default function WritingResultPage({ params, searchParams }: ResultPageProps) {
  return (
    <Container narrow className="py-8 sm:py-10">
      <Suspense fallback={<ResultSkeleton />}>
        <ResultRunner params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function ResultRunner({ params, searchParams }: ResultPageProps) {
  const t = await getMessages(writingMessages);
  const locale = await getLocale();
  await connection();
  const { promptId, submissionId } = await params;
  const query = await searchParams;
  const failureMessage = query.ai === "limit"
    ? t.dailyLimit
    : query.ai === "busy"
      ? t.aiBusy
      : query.ai === "unavailable" ? t.assessmentFailed : null;
  const user = await requireUser();

  // Scoped to the signed-in user: another learner's submission id resolves to
  // a 404 rather than leaking the text.
  const submission = await getWritingSubmissionForUser(submissionId, user.id);
  if (!submission || submission.promptId !== promptId) notFound();

  const feedback = submission.assessment;
  const aiEnabled = process.env.AI_ASSESSMENT_ENABLED === "true";
  const text = submission.text ?? "";
  const analysis = analyseWriting(text, {
    minWords: submission.minWords,
    maxWords: submission.maxWords,
  });
  const submittedAt = formatSubmittedAt(submission.submittedAt, locale);

  return (
    <>
      <LessonHeader
        backHref="/writing"
        backLabel={t.allWritingTopics}
        title={submission.promptTitle}
        facts={[
          t.difficulty[submission.promptDifficulty],
          submission.promptTopic,
          t.wordTarget(submission.minWords, submission.maxWords),
          submittedAt ? t.saved(submittedAt) : null,
        ]}
      />

      <section aria-labelledby="feedback-heading" className="mt-8">
        <h2 id="feedback-heading" className="text-2xl font-semibold text-ink">
          {t.aIFeedback}
      </h2>
        {feedback ? (
          <div className={`${sheet} mt-3 p-6 sm:p-8`}>
            <ScoreBreakdown
              overall={feedback.overallScore}
              scores={[
                [t.grammar, feedback.grammarScore],
                [t.vocabulary, feedback.vocabularyScore],
                [t.coherence, feedback.coherenceScore],
                [t.taskResponse, feedback.taskAchievementScore],
              ]}
            />
            <AssessmentSummary summary={feedback.summary} />
            <FeedbackHeading>{t.corrections}</FeedbackHeading>
            <CorrectionList corrections={feedback.corrections} />
            <FeedbackHeading>{t.suggestions}</FeedbackHeading>
            <SuggestionList suggestions={feedback.suggestions} />
          </div>
        ) : aiEnabled ? (
          <div className="mt-2">
            {failureMessage ? (
              <p role="status" className={`${alertNotice} mb-3`}>
                {failureMessage}
              </p>
            ) : (
              <p className="text-base leading-7 text-ink-soft">
                {t.feedbackDescription}
      </p>
            )}
            <form action={requestAssessment.bind(null, promptId, submissionId)} className="mt-3">
              <button className={buttonPrimary}>
                {failureMessage ? t.tryAgain : t.requestAIFeedback}
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-base leading-7 text-ink-soft">
            {t.feedbackDisabled}
      </p>
        )}
      </section>

      <section aria-labelledby="text-heading" className="mt-10">
        <h2 id="text-heading" className="text-2xl font-semibold text-ink">
          {t.yourResponse}
      </h2>
        <TextSheet>
          {text ? (
            <p className={`${readingText} whitespace-pre-wrap break-words`}>
              {feedback ? <MarkedText text={text} corrections={feedback.corrections} /> : text}
            </p>
          ) : (
            <p className="text-base text-ink-muted">
              {t.noSubmissionText}
      </p>
          )}
        </TextSheet>
      </section>

      <BasicCheck
        analysis={analysis}
        minWords={submission.minWords}
        maxWords={submission.maxWords}
      />

      <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
        <Link href="/writing" className={buttonPrimary}>
          {t.chooseTheNextTopic}</Link>
        <Link href={`/writing/${submission.promptId}`} className={linkInline}>
          {t.writeThisOneAgain}</Link>
        <Link href="/progress" className={linkInline}>
          {t.seeYourProgress}</Link>
      </div>
    </>
  );
}
