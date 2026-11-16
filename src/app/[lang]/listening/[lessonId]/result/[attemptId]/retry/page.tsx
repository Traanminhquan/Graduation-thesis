import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getMessages } from "@/i18n/server";
import { listeningMessages } from "@/i18n/messages/listening";
import { Container } from "@/components/container";
import { LessonHeader } from "@/components/lesson-header";
import { RetryForm } from "@/components/listening/retry-form";
import { requireUser } from "@/lib/auth/current-user";
import { getListeningLesson, getListeningRetryForUser } from "@/lib/listening/data";
import { checkRetry } from "./actions";
import { ListeningPlayer } from "@/components/listening/listening-player";
import { recordedAudioPath } from "@/lib/listening/audio";

export const instant = false;

export default async function RetryPage({ params }: { params: Promise<{ lessonId: string; attemptId: string }> }) {
  const t = await getMessages(listeningMessages);
  await connection();
  const { lessonId, attemptId } = await params;
  const user = await requireUser();
  const context = await getListeningRetryForUser(attemptId, user.id, lessonId);
  if (!context) notFound();
  const resultHref = `/listening/${lessonId}/result/${attemptId}`;
  if (!context.wrongIds.length) redirect(resultHref);
  const lesson = await getListeningLesson(lessonId);
  if (!lesson) notFound();
  const questions = lesson.questions.filter((question) => context.wrongIds.includes(question.id));
  const audioPath = recordedAudioPath(lesson.audioUrl);
  return (
    <Container className="py-8 sm:py-10">
      <LessonHeader backHref={resultHref} backLabel={t.backResults} title={lesson.title} facts={[lesson.topic]} />
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section aria-label={t.recording} className="self-start lg:sticky lg:top-20">
          {audioPath ? <ListeningPlayer kind="file" src={audioPath} durationMs={lesson.audioDurationMs} /> : <ListeningPlayer kind="speech" transcript={lesson.transcript} />}
        </section>
        <section aria-label={t.questionsLabel}>
          <RetryForm action={checkRetry.bind(null, lessonId, attemptId)} questions={questions} resultHref={resultHref} />
        </section>
      </div>
    </Container>
  );
}
