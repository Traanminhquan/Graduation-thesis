import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getMessages } from "@/i18n/server";
import { readingMessages } from "@/i18n/messages/reading";
import { Container } from "@/components/container";
import { LessonHeader } from "@/components/lesson-header";
import { RetryForm } from "@/components/reading/retry-form";
import { requireUser } from "@/lib/auth/current-user";
import { getReadingLesson, getReadingRetryForUser } from "@/lib/reading/data";
import { checkRetry } from "./actions";
import { readingText, sheet } from "@/lib/ui";

export const instant = false;

export default async function RetryPage({ params }: { params: Promise<{ lessonId: string; attemptId: string }> }) {
  const t = await getMessages(readingMessages);
  await connection();
  const { lessonId, attemptId } = await params;
  const user = await requireUser();
  const context = await getReadingRetryForUser(attemptId, user.id, lessonId);
  if (!context) notFound();
  const resultHref = `/reading/${lessonId}/result/${attemptId}`;
  if (!context.wrongIds.length) redirect(resultHref);
  const lesson = await getReadingLesson(lessonId);
  if (!lesson) notFound();
  const questions = lesson.questions.filter((question) => context.wrongIds.includes(question.id));

  return (
    <Container className="py-8 sm:py-10">
      <LessonHeader backHref={resultHref} backLabel={t.backResults} title={lesson.title} facts={[lesson.topic]} />
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-10">
        <section aria-label={t.passage} className={`${sheet} self-start p-6 sm:p-8 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto`} tabIndex={0}>
          <div className={`${readingText} space-y-5`}>{lesson.content.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph.replace(/\s*\n\s*/g, " ").trim()}</p>)}</div>
        </section>
        <section aria-label={t.questionsLabel}>
          <RetryForm action={checkRetry.bind(null, lessonId, attemptId)} questions={questions} resultHref={resultHref} />
        </section>
      </div>
    </Container>
  );
}
