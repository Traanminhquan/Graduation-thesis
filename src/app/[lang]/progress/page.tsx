import { getMessages } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container } from "@/components/container";
import { ProgressEmptyState } from "@/components/progress/empty-state";
import { ProgressDashboard } from "@/components/progress/progress-dashboard";
import { WeaknessSection, WeaknessSkeleton } from "@/components/progress/weakness-section";
import { requireUser } from "@/lib/auth/current-user";
import { conversationConfig } from "@/lib/conversation/config";
import { getConversationStats } from "@/lib/progress/conversation-stats";
import { getProgressOverview } from "@/lib/progress/stats";
import { getWordsToReview } from "@/lib/progress/vocabulary";
import { skeleton } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(progressMessages);
  return { title: t.pageTitle, description: t.description };
}

export default async function ProgressPage() {
  const t = await getMessages(progressMessages);
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
        {t.heading}
      </h1>

      {/* The session cookie and the attempt tables are request-time data, so the
          dashboard streams in behind the static shell (Cache Components). */}
      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </Container>
  );
}

async function ProgressContent() {
  await connection();
  const user = await requireUser();
  const overview = await getProgressOverview(user.id);

  if (overview.totalAttempts === 0) {
    return (
      <div className="mt-8 space-y-6">
        <ProgressEmptyState />
      </div>
    );
  }

  // After the overview, not alongside it: the pooled connection serves one query at a time.
  const words = await getWordsToReview(user.id);
  // Read even when disabled so previously ended conversations remain visible.
  const conversation = await getConversationStats(user.id);
  const showConversation = conversationConfig(process.env).enabled || conversation.attemptCount > 0;

  return (
    <ProgressDashboard
      overview={overview}
      words={words}
      {...(showConversation ? { conversation } : {})}
      weakness={
        <Suspense fallback={<WeaknessSkeleton />}>
          <WeaknessSection userId={user.id} />
        </Suspense>
      }
    />
  );
}

function ProgressSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-hidden="true">
      <div className={`${skeleton} h-24`} />
      <div className={`${skeleton} h-72`} />
    </div>
  );
}
