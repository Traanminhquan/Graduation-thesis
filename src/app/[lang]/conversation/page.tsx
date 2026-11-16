import { getMessages, getLocale } from "@/i18n/server";
import { conversationMessages } from "@/i18n/messages/conversation";
import { INTL_LOCALE } from "@/i18n/config";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container } from "@/components/container";
import { groupByLevel, PracticeList, PracticeListSkeleton } from "@/components/practice-list";
import { requireUser } from "@/lib/auth/current-user";
import { conversationConfig } from "@/lib/conversation/config";
import { getScenario, SCENARIOS } from "@/lib/conversation/scenarios";
import { listConversations } from "@/lib/conversation/session";
import { alertNotice, sheet } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(conversationMessages);
  return { title: t.title };
}

type Props = { searchParams: Promise<{ error?: string | string[] }> };

export default async function ConversationPage({ searchParams }: Props) {
  const t = await getMessages(conversationMessages);
  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container className="py-8 sm:py-10">
          <h1 className="text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{t.title}</h1>
        </Container>
      </div>
      <Container className="py-10 sm:py-14">
        <Suspense fallback={<PracticeListSkeleton />}>
          <ConversationList searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}

async function ConversationList({ searchParams }: Props) {
  const t = await getMessages(conversationMessages);
  const statusLabels = { ACTIVE: t.inProgress, ENDED: t.finished, ABANDONED: t.unfinished };
  const errors: Record<string, string> = {
    daily_limit: t.dailyLimit,
    disabled: t.disabled,
    not_found: t.scenarioNotFound,
    unavailable: t.unavailable,
  };
  const labels = { BEGINNER: t.beginner, INTERMEDIATE: t.intermediate, ADVANCED: t.advanced };
  await connection();
  const user = await requireUser();
  const { error } = await searchParams;
  const notice = typeof error === "string" && Object.hasOwn(errors, error) ? errors[error] : null;
  const enabled = conversationConfig(process.env).enabled;
  const conversations = await listConversations(user.id);
  const locale = await getLocale();

  return (
    <>
      {notice ? <p role="alert" className={`${alertNotice} mb-6`}>{notice}</p> : null}
      {enabled ? (
        <PracticeList groups={groupByLevel(SCENARIOS, labels, (scenario) => ({
          id: scenario.id,
          href: `/conversation/start/${scenario.id}`,
          title: scenario.title,
          summary: `You are ${scenario.learnerRole}. You talk to ${scenario.partnerRole}.`,
          facts: [scenario.topic, t.goalCount(scenario.goals.length)],
          actionLabel: t.start,
        }))} />
      ) : notice === errors.disabled ? null : <p className="text-base leading-7 text-ink-soft">{errors.disabled}</p>}
      {conversations.length > 0 ? (
        <section aria-labelledby="conversations-heading" className="mt-10">
          <h2 id="conversations-heading" className="mb-4 text-2xl font-semibold text-ink">{t.yourConversations}</h2>
          <ul className={`${sheet} divide-y divide-line`}>
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/conversation/${conversation.id}${conversation.status === "ACTIVE" ? "" : "/result"}`}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors first:rounded-t-[3px] hover:bg-canvas"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{getScenario(conversation.scenarioId)?.title ?? t.removedScenario}</span>
                    <span className="block text-sm text-ink-muted">{conversation.startedAt.toLocaleDateString(INTL_LOCALE[locale], { dateStyle: "medium", timeZone: "UTC" })}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink-soft">{statusLabels[conversation.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
