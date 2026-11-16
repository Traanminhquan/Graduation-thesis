
import { getMessages, getLocale } from "@/i18n/server";
import { speakingMessages } from "@/i18n/messages/speaking";
import { isRecordingUrl } from "@/lib/speaking/recording";
import { RecordingPlayer } from "@/components/speaking/recording-player";
import { speakingAiEnabled } from "@/lib/speaking/assess";
import { requestSpeakingAssessment } from "./actions";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  AssessmentSummary,
  CorrectionList,
  FeedbackHeading,
  ScoreBreakdown,
  SuggestionList,
  TextSheet,
} from "@/components/assessment-feedback";
import { Container } from "@/components/container";
import { LessonHeader, ResultSkeleton } from "@/components/lesson-header";
import { requireUser } from "@/lib/auth/current-user";
import { getSpeakingSubmissionForUser } from "@/lib/speaking/data";
import { transcriptSource } from "@/lib/speaking/draft";
import {
  formatDurationMs,
  formatSubmittedAt,
} from "@/lib/speaking/format";
import { alertNotice, buttonPrimary, linkInline, readingText, sheet } from "@/lib/ui";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ promptId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(speakingMessages);
  const title = await catalogueTitle("speaking", (await params).promptId);
  return { title: title ? t.results(title) : t.speakingResult };
}

/** Per-request page: submission ids only exist at runtime (see the prompt page). */
export const instant = false;

type ResultPageProps = {
  params: Promise<{ promptId: string; submissionId: string }>;
  searchParams: Promise<{ ai?: string }>;
};

export default function SpeakingResultPage({ params, searchParams }: ResultPageProps) {
  return (
    <Container narrow className="py-8 sm:py-10">
      <Suspense fallback={<ResultSkeleton />}>
        <ResultRunner params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function ResultRunner({ params, searchParams }: ResultPageProps) {
  const t = await getMessages(speakingMessages);
  const locale = await getLocale();
  await connection();
  const { promptId, submissionId } = await params;
  const query = await searchParams;
  const failureMessage = query.ai === "limit"
    ? t.youHaveReachedTodaySAIFeedbackLimitYourWorkIsSavedSoYouCanTryAgainTomorrow
    : query.ai === "busy"
      ? t.theAIServiceIsBusyOrTookTooLongYourWorkIsSavedSoYouCanTryAgainInAMoment
      : query.ai === "unavailable" ? t.aIContentFeedbackIsUnavailableYourTranscriptIsSavedSoYouCanTryAgainLater : null;
  const user = await requireUser();

  // Scoped to the signed-in user: another learner's submission id resolves to
  // a 404 rather than leaking the notes.
  const submission = await getSpeakingSubmissionForUser(submissionId, user.id);
  if (!submission || submission.promptId !== promptId) notFound();

  // Where the saved text came from. Manual text has no raw transcript and must never be treated as machine-verified speech.
  const source = transcriptSource(submission);
  const sourceLabel =
    source === "manual"
      ? t.typedManuallyNotMachineVerified
      : submission.transcript !== submission.rawTranscript
        ? t.speechToTextEditedByYou
        : t.speechToText;
  const submittedAt = formatSubmittedAt(submission.submittedAt, locale);
  const assessment = submission.assessment;

  return (
    <>
      <LessonHeader
        backHref="/speaking"
        backLabel={t.allSpeakingTopics}
        title={submission.promptTitle}
        facts={[
          t.difficulty[submission.promptDifficulty],
          submission.promptTopic,
          submission.durationMs !== null ? t.recorded(formatDurationMs(submission.durationMs)) : null,
          submittedAt ? t.saved(submittedAt) : null,
        ]}
      />

      <section aria-labelledby="feedback-heading" className="mt-8">
        <h2 id="feedback-heading" className="text-2xl font-semibold text-ink">
          {t.aIContentFeedback}
      </h2>
        {failureMessage ? (
          <p role="status" className={`${alertNotice} mt-3`}>
            {failureMessage}
          </p>
        ) : null}

        {assessment ? (
          <div className={`${sheet} mt-3 p-6 sm:p-8`}>
            <ScoreBreakdown
              overall={assessment.overallScore}
              scores={[
                [t.topicRelevance, assessment.topicRelevanceScore],
                [t.grammar, assessment.grammarScore],
                [t.vocabulary, assessment.vocabularyScore],
                [t.coherence, assessment.coherenceScore],
              ]}
            />
            <AssessmentSummary summary={assessment.summary} />
            <FeedbackHeading>{t.corrections}</FeedbackHeading>
            <CorrectionList corrections={assessment.corrections} />
            <FeedbackHeading>{t.suggestions}</FeedbackHeading>
            <SuggestionList suggestions={assessment.suggestions} />
            <p className="mt-6 text-sm text-ink-muted">{t.model} {assessment.model}
      </p>
          </div>
        ) : speakingAiEnabled(process.env) ? (
          <div className="mt-2">
            <form className="mt-3" action={requestSpeakingAssessment.bind(null, promptId, submissionId)}>
              <button className={buttonPrimary} type="submit">{t.requestAIFeedback}</button>
            </form>
          </div>
        ) : (
          <p className="mt-2 text-base leading-7 text-ink-soft">
            {t.aIFeedbackIsTurnedOffForThisSiteYourTranscriptIsSavedBelow}
      </p>
        )}
      </section>

      {isRecordingUrl(submission.audioUrl) ? <section aria-labelledby="recording-heading" className="mt-10">
        <h2 id="recording-heading" className="text-2xl font-semibold text-ink">{t.yourRecording}
      </h2>
        <RecordingPlayer src={submission.audioUrl} />
      </section> : null}

      <section aria-labelledby="notes-heading" className="mt-10">
        <h2 id="notes-heading" className="text-2xl font-semibold text-ink">
          {t.yourTranscript}
      </h2>
        <p className="mt-1 text-sm text-ink-muted">{sourceLabel}</p>
        <TextSheet>
          {submission.transcript ? (
            <p className={`${readingText} whitespace-pre-wrap break-words`}>
              {submission.transcript}
            </p>
          ) : (
            <p className="text-base text-ink-muted">
              {t.noTranscriptWasSavedForThisAttempt}
      </p>
          )}
        </TextSheet>
      </section>

      {submission.rawTranscript !== null && submission.rawTranscript !== submission.transcript ? (
        <section aria-labelledby="raw-heading" className="mt-10">
          <h2 id="raw-heading" className="text-2xl font-semibold text-ink">
            {t.originalSpeechToTextOutput}
      </h2>
          <TextSheet>
            <p className={`${readingText} whitespace-pre-wrap break-words`}>
              {submission.rawTranscript}
            </p>
          </TextSheet>
        </section>
      ) : null}

      <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
        <Link href="/speaking" className={buttonPrimary}>
          {t.chooseTheNextTopic}</Link>
        <Link href={`/speaking/${submission.promptId}`} className={linkInline}>
          {t.practiseThisTopicAgain}</Link>
        <Link href="/progress" className={linkInline}>
          {t.seeYourProgress}</Link>
      </div>

      <p className="mt-6 text-sm leading-6 text-ink-muted">
        {isRecordingUrl(submission.audioUrl)
          ? t.yourRecordingIsStoredWithThisAttemptAndOnlyYouCanPlayOrDeleteItLinguaAlsoKeepsThePromptTheDurationAndYourTranscript
          : t.audioIsNotStoredLinguaKeepsThePromptTheDurationAndYourTranscript}
      </p>
    </>
  );
}
