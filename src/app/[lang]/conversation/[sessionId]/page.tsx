import { getMessages, getLocale } from "@/i18n/server";
import { conversationMessages } from "@/i18n/messages/conversation";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ConversationRoom } from "@/components/conversation/conversation-room";
import { partnerName } from "@/components/conversation/conversation-script";
import { Container } from "@/components/container";
import { LessonHeader, ResultSkeleton } from "@/components/lesson-header";
import { requireUser } from "@/lib/auth/current-user";
import { conversationConfig } from "@/lib/conversation/config";
import { getConversation } from "@/lib/conversation/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(conversationMessages);
  return { title: t.title };
}

/** Conversation ids only exist at runtime, like attempt ids (see the lesson pages). */
export const instant = false;


type PageProps = { params: Promise<{ sessionId: string }> };

export default function ConversationPage({ params }: PageProps) {
  return (
    <Container narrow className="py-8 sm:py-10">
      <Suspense fallback={<ResultSkeleton />}>
        <ConversationRunner params={params} />
      </Suspense>
    </Container>
  );
}

async function ConversationRunner({ params }: PageProps) {
  const t = await getMessages(conversationMessages);
  const LEVEL = { BEGINNER: t.beginner, INTERMEDIATE: t.intermediate, ADVANCED: t.advanced } as const;
  await connection();
  const { sessionId } = await params;
  const user = await requireUser();

  // Owner-scoped: another learner's conversation id is a 404.
  const conversation = await getConversation(sessionId, user.id);
  if (!conversation || !conversation.scenario) notFound();
  if (conversation.status !== "ACTIVE") redirect(`/conversation/${encodeURIComponent(conversation.id)}/result`);

  const config = conversationConfig(process.env);
  const { scenario } = conversation;

  return (
    <>
      <LessonHeader
        backHref="/conversation"
        backLabel={t.allScenarios}
        title={scenario.title}
        facts={[LEVEL[scenario.difficulty], scenario.topic]}
      />
      <ConversationRoom
        sessionId={conversation.id}
        initialTurns={conversation.turns}
        partnerName={partnerName(scenario.partnerRole, await getLocale())}
        learnerTurns={conversation.turnCount}
        maxTurns={config.learnerTurns}
        turnSeconds={config.turnSeconds}
      />
    </>
  );
}
