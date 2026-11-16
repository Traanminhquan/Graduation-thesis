import { listeningMessages } from "@/i18n/messages/listening";
import { getMessages } from "@/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { submitListeningAttempt } from "@/app/[lang]/listening/actions";
import { Container } from "@/components/container";
import { LessonHeader } from "@/components/lesson-header";
import { ListeningForm } from "@/components/listening/listening-form";
import { ListeningPlayer } from "@/components/listening/listening-player";
import { requireUser } from "@/lib/auth/current-user";
import { recordedAudioPath } from "@/lib/listening/audio";
import { getListeningLesson } from "@/lib/listening/data";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(listeningMessages);
  const title = await catalogueTitle("listening", (await params).lessonId);
  return { title: title ?? t.lesson };
}

/**
 * Lesson ids are database rows, so this route cannot be prerendered per param.
 * Opting out of instant-navigation validation (the documented "blocking route"
 * escape hatch for Cache Components) lets it render per request.
 *
 * The page blocks on the session and the lesson instead of streaming the
 * runner through a `<Suspense>` boundary: the player is a client component and
 * the whole route must hydrate as one document for its controls to work.
 */
export const instant = false;

type LessonPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function ListeningLessonPage({ params }: LessonPageProps) {
  // Request-time data access: keeps the whole route dynamic (a blocking route
  // is allowed by `instant = false`) so it renders and hydrates in one pass.
  const t = await getMessages(listeningMessages);
  await connection();

  const { lessonId } = await params;
  await requireUser();

  const lesson = await getListeningLesson(lessonId);
  if (!lesson) notFound();

  const submitAction = submitListeningAttempt.bind(null, lesson.id);
  const audioPath = recordedAudioPath(lesson.audioUrl);

  return (
    <Container className="py-8 sm:py-10">
      <LessonHeader
        backHref="/listening"
        backLabel={t.back}
        title={lesson.title}
        facts={[
          t.difficulty[lesson.difficulty],
          lesson.topic,
          t.questions(lesson.questions.length),
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-10">
        <section aria-label={t.recording} className="self-start lg:sticky lg:top-20">
          {audioPath ? (
            <ListeningPlayer kind="file" src={audioPath} durationMs={lesson.audioDurationMs} />
          ) : (
            <ListeningPlayer kind="speech" transcript={lesson.transcript} />
          )}
        </section>

        <section aria-label={t.questionsLabel}>
          <ListeningForm action={submitAction} questions={lesson.questions} />
        </section>
      </div>
    </Container>
  );
}
