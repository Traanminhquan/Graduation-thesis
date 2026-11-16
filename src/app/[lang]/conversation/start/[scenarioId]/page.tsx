import { getMessages } from "@/i18n/server";
import { conversationMessages } from "@/i18n/messages/conversation";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { startConversationAction } from "@/app/[lang]/conversation/actions";
import { Container } from "@/components/container";
import { LessonHeader, WorkspaceSkeleton } from "@/components/lesson-header";
import { requireUser } from "@/lib/auth/current-user";
import { conversationConfig } from "@/lib/conversation/config";
import { getScenario } from "@/lib/conversation/scenarios";
import { buttonPrimary, readingText } from "@/lib/ui";

type Props = { params: Promise<{ scenarioId: string }> };

/** Render per request, like the lesson pages: no empty static shell for unknown ids. */
export const instant = false;


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const scenario = getScenario((await params).scenarioId);
  if (!scenario) notFound();
  return { title: scenario.title };
}

export default function StartConversationPage({ params }: Props) {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<WorkspaceSkeleton />}>
        <ScenarioBrief params={params} />
      </Suspense>
    </Container>
  );
}

async function ScenarioBrief({ params }: Props) {
  const t = await getMessages(conversationMessages);
  const labels = { BEGINNER: t.beginner, INTERMEDIATE: t.intermediate, ADVANCED: t.advanced };
  await connection();
  await requireUser();
  const scenario = getScenario((await params).scenarioId);
  if (!scenario) notFound();

  return (
    <>
      <LessonHeader backHref="/conversation" backLabel={t.allScenarios} title={scenario.title} facts={[labels[scenario.difficulty], scenario.topic]} />
      <p className={`${readingText} mt-8`}>You are {scenario.learnerRole}. You are talking to {scenario.partnerRole}.</p>
      <h2 className="mt-8 text-2xl font-semibold text-ink">{t.tryTo}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-base leading-7 text-ink-soft">
        {scenario.goals.map((goal) => <li key={goal}>{goal}</li>)}
      </ul>
      <h2 className="mt-8 text-2xl font-semibold text-ink">{t.usefulPhrases}</h2>
      <ul className={`${readingText} mt-3 space-y-2`}>
        {scenario.usefulPhrases.map((phrase) => <li key={phrase}><span className="marked">{phrase}</span></li>)}
      </ul>
      <p className="mt-6 text-sm leading-6 text-ink-muted">{t.privacy}</p>
      {conversationConfig(process.env).enabled ? (
        <form action={startConversationAction} className="mt-6">
          <input type="hidden" name="scenarioId" value={scenario.id} />
          <button type="submit" className={buttonPrimary}>{t.startConversation}</button>
        </form>
      ) : <p className="mt-6 text-base leading-7 text-ink-soft">{t.disabled}</p>}
    </>
  );
}
