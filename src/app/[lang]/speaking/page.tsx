
import { getMessages, getLocale } from "@/i18n/server";
import { speakingMessages } from "@/i18n/messages/speaking";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container } from "@/components/container";
import {
  groupByLevel,
  PracticeList,
  PracticeListEmpty,
  PracticeListSkeleton,
} from "@/components/practice-list";
import { SkillHeader } from "@/components/skill-header";
import { requireUser } from "@/lib/auth/current-user";
import { listSpeakingPrompts } from "@/lib/speaking/data";
import { durationLimitLabel } from "@/lib/speaking/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(speakingMessages);
  return {
  title: t.speaking,
  description:
    t.speakingPracticeWithShortTopicsInBrowserRecordingAndAConfirmedTranscriptFeedbackCoversWhatYouSaidNotPronunciation,
  };
}

export default function SpeakingPage() {
  return (
    <>
      <SkillHeader skill="speaking" />
      <Container className="py-10 sm:py-14">
        <Suspense fallback={<PracticeListSkeleton />}>
          <PromptList />
        </Suspense>
      </Container>
    </>
  );
}

async function PromptList() {
  const t = await getMessages(speakingMessages);
  const locale = await getLocale();
  // Session + database reads are request-time data, so this section streams in
  // behind the Suspense boundary (Cache Components is enabled).
  await connection();
  const user = await requireUser();
  const prompts = await listSpeakingPrompts(user.id);

  if (prompts.length === 0) {
    return (
      <PracticeListEmpty
        title={t.noSpeakingTopicsYet}
        body={t.speakingTopicsHaveNotBeenPublishedForThisBuild}
      />
    );
  }

  return (
    <PracticeList
      groups={groupByLevel(prompts, t.difficulty, (prompt) => ({
        id: prompt.id,
        href: `/speaking/${prompt.id}`,
        title: prompt.title,
        summary: prompt.excerpt,
        facts: [
          ...(prompt.topic ? [prompt.topic] : []),
          t.upTo(durationLimitLabel(prompt.speakingSeconds, locale)),
        ],
        actionLabel: prompt.submissionCount > 0 ? t.practiseAgain : t.startSpeaking,
        secondary: prompt.latestSubmission
          ? {
              href: `/speaking/${prompt.id}/result/${prompt.latestSubmission.id}`,
              label: t.lastResult,
            }
          : null,
      }))}
    />
  );
}
