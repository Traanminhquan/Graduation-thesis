import { listeningMessages } from "@/i18n/messages/listening";
import { getMessages } from "@/i18n/server";
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
import { listListeningLessons } from "@/lib/listening/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(listeningMessages);
  return {
    title: t.title,
    description: t.description,
  };
}

export default function ListeningPage() {
  return (
    <>
      <SkillHeader skill="listening" />
      <Container className="py-10 sm:py-14">
        <Suspense fallback={<PracticeListSkeleton />}>
          <LessonList />
        </Suspense>
      </Container>
    </>
  );
}

async function LessonList() {
  const t = await getMessages(listeningMessages);
  // Session + database reads are request-time data, so this section streams in
  // behind the Suspense boundary above (Cache Components is enabled).
  await connection();
  const user = await requireUser();
  const lessons = await listListeningLessons(user.id);

  if (lessons.length === 0) {
    return (
      <PracticeListEmpty
        title={t.noLessons}
        body={t.empty}
      />
    );
  }

  return (
    <PracticeList
      groups={groupByLevel(lessons, t.difficulty, (lesson) => ({
        id: lesson.id,
        href: `/listening/${lesson.id}`,
        title: lesson.title,
        facts: [
          lesson.topic,
          t.questions(lesson.questionCount),
          ...(lesson.audioDurationMs ? [`~${t.duration(lesson.audioDurationMs)}`] : []),
        ],
        status: lesson.bestPercentage !== null ? t.best(lesson.bestPercentage) : null,
        actionLabel: lesson.attemptCount > 0 ? t.again : t.start,
      }))}
    />
  );
}
