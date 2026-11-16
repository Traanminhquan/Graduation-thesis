
import { getMessages } from "@/i18n/server";
import { writingMessages } from "@/i18n/messages/writing";
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
import { listWritingPrompts } from "@/lib/writing/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(writingMessages);
  return {
  title: t.writing,
  description:
    t.writingPracticeWithGuidedTopicsALiveWordCounterAndAnAutomaticBasicCheckOfLengthSentencesAndRepeatedWords,
  };
}

export default function WritingPage() {
  return (
    <>
      <SkillHeader skill="writing" />
      <Container className="py-10 sm:py-14">
        <Suspense fallback={<PracticeListSkeleton />}>
          <PromptList />
        </Suspense>
      </Container>
    </>
  );
}

async function PromptList() {
  const t = await getMessages(writingMessages);
  // Session + database reads are request-time data, so this section streams in
  // behind the Suspense boundary (Cache Components is enabled).
  await connection();
  const user = await requireUser();
  const prompts = await listWritingPrompts(user.id);

  if (prompts.length === 0) {
    return (
      <PracticeListEmpty
        title={t.noWritingTopicsYet}
        body={t.writingTopicsHaveNotBeenPublishedForThisBuild}
      />
    );
  }

  return (
    <PracticeList
      groups={groupByLevel(prompts, t.difficulty, (prompt) => ({
        id: prompt.id,
        href: `/writing/${prompt.id}`,
        title: prompt.title,
        summary: prompt.excerpt,
        facts: [
          ...(prompt.topic ? [prompt.topic] : []),
          t.wordTarget(prompt.minWords, prompt.maxWords),
        ],
        status: prompt.hasDraft ? t.draftInProgress : null,
        actionLabel: prompt.submissionCount > 0 ? t.writeAgain : t.startWriting,
        secondary: prompt.latestSubmission
          ? {
              href: `/writing/${prompt.id}/result/${prompt.latestSubmission.id}`,
              label: t.lastResult,
            }
          : null,
      }))}
    />
  );
}
