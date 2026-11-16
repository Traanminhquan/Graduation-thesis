import { getMessages } from "@/i18n/server";
import { progressMessages } from "@/i18n/messages/progress";
import Link from "next/link";

import type { VocabularyWord } from "@/lib/progress/vocabulary";
import { linkInline, sheet } from "@/lib/ui";

/**
 * Words the learner got wrong in Reading, with the meaning the passage used.
 * Renders nothing when there are none, so the page has no empty box.
 */
export async function VocabularySection({ words }: { words: readonly VocabularyWord[] }) {
  const t = await getMessages(progressMessages);
  if (words.length === 0) return null;

  return (
    <section aria-labelledby="vocabulary-heading" className="min-w-0">
      <h2 id="vocabulary-heading" className="text-2xl font-semibold text-ink">
        {t.words}
      </h2>
      <dl className={`${sheet} mt-3 divide-y divide-line`}>
        {words.map((entry) => (
          <div key={entry.questionId} className="min-w-0 px-5 py-3.5 [overflow-wrap:anywhere]">
            <dt className="font-display text-lg font-semibold leading-snug text-ink">
              <span className="marked">{entry.word}</span>
            </dt>
            <dd className="mt-1 text-[0.9375rem] leading-6 text-ink-soft">{entry.meaning}</dd>
            <dd className="mt-1 text-sm">
              <Link href={`/reading/${entry.lessonId}`} className={linkInline}>
                {entry.lessonTitle}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
