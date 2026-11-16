
import { getMessages, getLocale } from "@/i18n/server";
import { speakingMessages } from "@/i18n/messages/speaking";
import { audioStorageConfig } from "@/lib/speaking/recording";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { submitSpeakingResponse } from "@/app/[lang]/speaking/actions";
import { Container } from "@/components/container";
import { LessonHeader, WorkspaceSkeleton } from "@/components/lesson-header";
import { SpeakingRecorder } from "@/components/speaking/speaking-recorder";
import { requireUser } from "@/lib/auth/current-user";
import { getSpeakingPrompt } from "@/lib/speaking/data";
import { getSpeakingDraft } from "@/lib/speaking/draft";
import {
  durationLimitLabel,
} from "@/lib/speaking/format";
import { resolveMaxDurationMs } from "@/lib/speaking/validation";
import { catalogueTitle } from "@/lib/progress/catalogue";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ promptId: string }>;
}): Promise<Metadata> {
  const t = await getMessages(speakingMessages);
  const title = await catalogueTitle("speaking", (await params).promptId);
  return { title: title ?? t.speakingTopic };
}

/**
 * Prompt ids are database rows, so this route cannot be prerendered per param.
 * `instant = false` is the documented blocking-route escape hatch used by the
 * reading, listening and writing detail pages.
 */
export const instant = false;

type PromptPageProps = {
  params: Promise<{ promptId: string }>;
};

export default function SpeakingPromptPage({ params }: PromptPageProps) {
  return (
    <Container className="py-8 sm:py-10">
      <Suspense fallback={<WorkspaceSkeleton />}>
        <PromptRunner params={params} />
      </Suspense>
    </Container>
  );
}

async function PromptRunner({ params }: PromptPageProps) {
  const t = await getMessages(speakingMessages);
  const locale = await getLocale();
  // Route params, the session and the prompt are all request-time data.
  await connection();
  const { promptId } = await params;
  const user = await requireUser();

  const prompt = await getSpeakingPrompt(promptId);
  if (!prompt) notFound();
  const draft = await getSpeakingDraft(user.id, prompt.id);

  const submitAction = submitSpeakingResponse.bind(null, prompt.id);
  const maxDurationMs = resolveMaxDurationMs(prompt.speakingSeconds);
  const paragraphs = prompt.promptText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  return (
    <>
      <LessonHeader
        backHref="/speaking"
        backLabel={t.allSpeakingTopics}
        title={prompt.title}
        facts={[
          t.difficulty[prompt.difficulty],
          prompt.topic,
          t.upTo(durationLimitLabel(maxDurationMs / 1000, locale)),
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

        <section aria-label={t.yourAnswer}>
          <SpeakingRecorder
            promptId={prompt.id}
            audioStorageEnabled={audioStorageConfig(process.env).enabled}
            sttEnabled={process.env.SPEAKING_STT_ENABLED === "true"}
            initialTranscript={draft?.rawTranscript ?? null}
            action={submitAction}
            maxDurationMs={maxDurationMs}
          />
        </section>
      </div>
    </>
  );
}
