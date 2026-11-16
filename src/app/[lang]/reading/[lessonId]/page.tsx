import { readingMessages } from "@/i18n/messages/reading";
import { getMessages } from "@/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { submitReadingAttempt } from "@/app/[lang]/reading/actions";
import { Container } from "@/components/container";
import { LessonHeader, WorkspaceSkeleton } from "@/components/lesson-header";
import { ReadingForm } from "@/components/reading/reading-form";
import { requireUser } from "@/lib/auth/current-user";
import { getReadingLesson } from "@/lib/reading/data";
import { readingText, sheet } from "@/lib/ui";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(readingMessages);
  const title = await catalogueTitle("reading", (await params).lessonId);
  return { title: title ?? t.lesson };
}

/**
 * Lesson ids are database rows, so this route cannot be prerendered per param.
 * Opting out of instant validation (the documented "blocking route" escape
 * hatch for Cache Components) lets it render per request instead of trying to
 * build an empty static shell.
 */
export const instant = false;

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default function ReadingLessonPage({ params }: LessonPageProps) {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<WorkspaceSkeleton />}>
        <LessonRunner params={params} />
      </Suspense>
    </Container>
  );
}

async function LessonRunner({ params }: LessonPageProps) {
  // Route params, the session and the passage are all request-time data.
  const t = await getMessages(readingMessages);
  await connection();
  const { lessonId } = await params;
  await requireUser();

  const lesson = await getReadingLesson(lessonId);
  if (!lesson) notFound();

  const paragraphs = lesson.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const submitAction = submitReadingAttempt.bind(null, lesson.id);

  return (
    <>
      <LessonHeader
        backHref="/reading"
        backLabel={t.back}
        title={lesson.title}
        facts={[
          t.difficulty[lesson.difficulty],
          lesson.topic,
          t.questions(lesson.questions.length),
          lesson.estimatedMinutes ? t.minutes(lesson.estimatedMinutes) : null,
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10">
        {/* A long passage scrolls inside its own sheet, so it stays beside the questions. */}
        <section
          aria-label={t.passage}
          tabIndex={0}
          className={`${sheet} self-start p-6 sm:p-8 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`}
        >
          <div className={`${readingText} max-w-[62ch] space-y-5`}>
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section aria-label={t.questionsLabel}>
          <ReadingForm action={submitAction} questions={lesson.questions} />
        </section>
      </div>
    </>
  );
}
