
import { getMessages } from "@/i18n/server";
import { writingMessages } from "@/i18n/messages/writing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { submitWritingResponse } from "@/app/[lang]/writing/actions";
import { Container } from "@/components/container";
import { LessonHeader, WorkspaceSkeleton } from "@/components/lesson-header";
import { WritingEditor } from "@/components/writing/writing-editor";
import { requireUser } from "@/lib/auth/current-user";
import { getDraftForUser, getSubmissionBaseline } from "@/lib/writing/draft";
import { getWritingPrompt } from "@/lib/writing/data";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ promptId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(writingMessages);
  const title = await catalogueTitle("writing", (await params).promptId);
  return { title: title ?? t.writingTopic };
}

/**
 * Prompt ids are database rows, so this route cannot be prerendered per param.
 * `instant = false` is the documented blocking-route escape hatch used by the
 * reading and listening detail pages.
 */
export const instant = false;

type PromptPageProps = {
  params: Promise<{ promptId: string }>;
};

export default function WritingPromptPage({ params }: PromptPageProps) {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<WorkspaceSkeleton />}>
        <PromptRunner params={params} />
      </Suspense>
    </Container>
  );
}

async function PromptRunner({ params }: PromptPageProps) {
  const t = await getMessages(writingMessages);
  // Route params, the session and the prompt are all request-time data.
  await connection();
  const { promptId } = await params;
  const user = await requireUser();

  const prompt = await getWritingPrompt(promptId);
  if (!prompt) notFound();

  const submissionBaseline = await getSubmissionBaseline(user.id, promptId);
  const draft = await getDraftForUser(user.id, promptId);
  const submitAction = submitWritingResponse.bind(null, prompt.id);
  const paragraphs = prompt.promptText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  return (
    <>
      <LessonHeader
        backHref="/writing"
        backLabel={t.allWritingTopics}
        title={prompt.title}
        facts={[
          t.difficulty[prompt.difficulty],
          prompt.topic,
          t.wordTarget(prompt.minWords, prompt.maxWords),
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-10">
        <section aria-labelledby="prompt-heading" className="self-start lg:sticky lg:top-20">
          <h2 id="prompt-heading" className="text-xl font-semibold text-ink">
            {t.yourTopic}
      </h2>
          <div className="mt-3 space-y-3 text-base leading-7 text-ink-soft">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section aria-label={t.yourResponse}>
          <WritingEditor
            action={submitAction}
            promptId={prompt.id}
            initialText={draft?.text ?? ""}
            initialSavedAt={draft?.savedAt ?? null}
            submissionBaseline={submissionBaseline}
            backupKey={`writing-draft:${user.id}:${prompt.id}`}
            minWords={prompt.minWords}
            maxWords={prompt.maxWords}
          />
        </section>
      </div>
    </>
  );
}
