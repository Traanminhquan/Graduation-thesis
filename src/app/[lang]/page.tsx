import { homeMessages } from "@/i18n/messages/home";
import { getMessages } from "@/i18n/server";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/container";
import { CheckIcon } from "@/components/icons";
import { buttonPrimary } from "@/lib/ui";

const del = "text-pen decoration-pen decoration-2";
const ins = "marked no-underline";

/**
 * The contents of the site. Each entry shows a piece of the feedback that
 * section gives, marked up the way the product marks it, instead of
 * describing it.
 */

export default async function HomePage() {
  const t = await getMessages(homeMessages);
  const contents: { name: string; href: string; work: ReactNode; mark: ReactNode }[] = [
    {
      name: t.reading,
      href: "/reading",
      work: <span className="font-sans font-semibold">Why was Lan late for class?</span>,
      mark: (
        <>
          <span className="font-medium text-tick">
            <CheckIcon className="mr-1 inline size-4 align-[-0.15em]" />
            Her bus broke down.
          </span>{" "}
          Paragraph 2 says the bus “stopped outside the market”.
        </>
      ),
    },
    {
      name: t.listening,
      href: "/listening",
      work: <span className="font-sans font-semibold">What time does the train leave?</span>,
      mark: (
        <>
          <del className={`${del} font-medium`}>9:45</del>{" "}
          <ins className={`${ins} font-medium text-ink`}>9:15</ins> The speaker says “a
          quarter past nine”.
        </>
      ),
    },
    {
      name: t.writing,
      href: "/writing",
      work: (
        <>
          I <del className={del}>am agree</del> <ins className={ins}>agree</ins> with this
          idea.
        </>
      ),
      mark: (
        <>
          <span className="font-semibold text-ink">{t.verbForm}</span> <em>Agree</em> is
          already a verb, so it does not take <em>am</em>.
        </>
      ),
    },
    {
      name: t.speaking,
      href: "/speaking",
      work: <>“I like my city because it is nice.”</>,
      mark: (
        <>
          <span className="font-semibold text-pen">{t.sayWhy}</span> Give one example of what
          makes it nice.
        </>
      ),
    },
    {
      name: t.conversation,
      href: "/conversation",
      work: <>“Hi, do you have a table for two?”</>,
      mark: (
        <>
          <span className="font-semibold text-ink">{t.waiter}</span> Of course. Inside or by the window?
        </>
      ),
    },
    {
      name: t.progress,
      href: "/progress",
      work: <>{t.verbTense}</>,
      mark: (
        <>
          {t.corrections(7, 3)}{" "}
          <span className="font-semibold text-ink">{t.practise} Describe your last weekend</span>
        </>
      ),
    },
  ];

  return (
    <>
      <section className="border-b border-line bg-surface">
        <Container className="pb-12 pt-12 sm:pb-16 sm:pt-20">
          <figure aria-label={t.sentenceLabel}>
            <p
              aria-hidden="true"
              className="font-display text-[clamp(2.5rem,7.4vw,5.75rem)] font-medium leading-[1.12] tracking-tight text-ink"
            >
              She <del className="proof-del">go</del>{" "}
              <ins className="proof-ins">goes</ins> to school every day.
            </p>
            <figcaption className="mt-5 text-base leading-7 text-ink-soft">
              <span className="font-semibold text-pen">{t.agreement}</span>{" "}
              {t.use} <em>goes</em> {t.with} <em>she</em>.
            </figcaption>
          </figure>

          <div className="mt-12 flex flex-col items-start gap-6 border-t border-line pt-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16">
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              {t.headline}
            </h1>
            <Link href="/reading" className={`${buttonPrimary} shrink-0`}>
              {t.start}
            </Link>
          </div>
        </Container>
      </section>

      <section aria-labelledby="contents-heading">
        <Container className="py-12 sm:py-16">
          <h2 id="contents-heading" className="sr-only">
            {t.skillsProgress}
          </h2>

          <ul className="border-t-2 border-ink">
            {contents.map((entry) => (
              <li key={entry.href} className="border-b border-line">
                <Link
                  href={entry.href}
                  className="group grid gap-x-10 gap-y-2 py-7 md:grid-cols-[11rem_minmax(0,1fr)] md:items-baseline"
                >
                  <span className="font-display text-3xl font-semibold text-ink">
                    <span className="underline decoration-marker decoration-[3px] underline-offset-[6px] transition-colors group-hover:bg-marker-soft group-hover:decoration-ink">
                      {entry.name}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl leading-8 text-ink">
                      {entry.work}
                    </span>
                    <span className="mt-1 block text-base leading-7 text-ink-soft">
                      {entry.mark}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </>
  );
}
