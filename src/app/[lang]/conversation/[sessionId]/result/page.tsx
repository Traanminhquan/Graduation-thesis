import { getMessages, getLocale } from "@/i18n/server";
import { conversationMessages } from "@/i18n/messages/conversation";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AssessmentSummary, CorrectionList, FeedbackHeading, MarkedText, ScoreBreakdown, SuggestionList } from "@/components/assessment-feedback";
import { Container } from "@/components/container";
import { ConversationScript, partnerName } from "@/components/conversation/conversation-script";
import { CheckIcon } from "@/components/icons";
import { LessonHeader, ResultSkeleton } from "@/components/lesson-header";
import { requireUser } from "@/lib/auth/current-user";
import { conversationAssessmentEnabled, getConversationAssessment } from "@/lib/conversation/assess";
import { getConversation } from "@/lib/conversation/session";
import { alertNotice, buttonPrimary, linkInline, sheet } from "@/lib/ui";
import { requestConversationAssessment } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(conversationMessages);
  return { title: t.resultTitle };
}
export const instant = false;
type Props = { params: Promise<{ sessionId: string }>; searchParams: Promise<{ ai?: string | string[] }> };

export default function ConversationResultPage(props: Props) {
  return <Container narrow className="py-8 sm:py-10"><Suspense fallback={<ResultSkeleton />}><ResultRunner {...props} /></Suspense></Container>;
}

async function ResultRunner({ params, searchParams }: Props) {
  const t = await getMessages(conversationMessages);
  await connection();
  const { sessionId } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const conversation = await getConversation(sessionId, user.id);
  if (!conversation?.scenario) notFound();
  if (conversation.status === "ACTIVE") redirect(`/conversation/${encodeURIComponent(sessionId)}`);
  const { scenario } = conversation;
  const assessment = await getConversationAssessment(sessionId, user.id);
  const enabled = conversationAssessmentEnabled(process.env);
  const failureMessage = query.ai === "limit"
    ? t.feedbackLimit
    : query.ai === "busy"
      ? t.feedbackBusy
      : query.ai === "unavailable" ? t.feedbackUnavailable : null;
  return <>
    <LessonHeader backHref="/conversation" backLabel={t.allScenarios} title={scenario.title} facts={[({ BEGINNER: t.beginner, INTERMEDIATE: t.intermediate, ADVANCED: t.advanced })[scenario.difficulty], scenario.topic, t.turnCount(conversation.turnCount), conversation.status === "ABANDONED" ? t.unfinished : null]} />
    <section aria-labelledby="feedback-heading" className="mt-8">
      <h2 id="feedback-heading" className="text-2xl font-semibold text-ink">{t.aiFeedback}</h2>
      {assessment ? <div className={`${sheet} mt-3 p-6 sm:p-8`}>
        <ScoreBreakdown overall={assessment.overallScore} scores={[[t.grammar, assessment.grammarScore], [t.vocabulary, assessment.vocabularyScore], [t.coherence, assessment.coherenceScore], [t.situation, assessment.topicRelevanceScore]]} />
        <AssessmentSummary summary={assessment.summary} />
        <FeedbackHeading>{t.goals}</FeedbackHeading>
        <ul className="mt-2 space-y-2 text-base leading-7 text-ink-soft">{scenario.goals.map((goal, index) => <li key={index} className="flex items-baseline gap-2">{assessment.goalsReached.includes(index) ? <><CheckIcon className="h-4 w-4 shrink-0 self-center text-tick" /><span className="sr-only">{t.reached}</span></> : null}<span>{goal}</span></li>)}</ul>
        <FeedbackHeading>{t.corrections}</FeedbackHeading><CorrectionList corrections={assessment.corrections} />
        <FeedbackHeading>{t.suggestions}</FeedbackHeading><SuggestionList suggestions={assessment.suggestions} />
      </div> : !enabled ? <p className="mt-2 text-base leading-7 text-ink-soft">{t.feedbackDisabled}</p> : conversation.status === "ENDED" ? <>
        {failureMessage ? <p role="status" className={`${alertNotice} mt-3`}>{failureMessage}</p> : null}
        <form action={requestConversationAssessment.bind(null, sessionId)} className="mt-4"><button className={buttonPrimary} type="submit">{t.requestFeedback}</button></form>
      </> : null}
    </section>
    <section aria-labelledby="conversation-heading" className="mt-10">
      <h2 id="conversation-heading" className="text-2xl font-semibold text-ink">{t.theConversation}</h2>
      <ConversationScript learnerLabel={t.you} partnerName={partnerName(scenario.partnerRole, await getLocale())} lines={conversation.turns.map(turn => ({ key: String(turn.index), role: turn.role, text: assessment && turn.role === "LEARNER" ? <MarkedText text={turn.text} corrections={assessment.corrections.filter(c => turn.text.includes(c.original))} /> : turn.text }))} />
    </section>
    <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4">
      <Link href="/conversation" className={buttonPrimary}>{t.chooseAnother}</Link>
      <Link href={`/conversation/start/${scenario.id}`} className={linkInline}>{t.tryAgain}</Link>
      <Link href="/progress" className={linkInline}>{t.progress}</Link>
    </div>
  </>;
}
