import { sharedMessages } from "@/i18n/messages/shared";
import { getMessages } from "@/i18n/server";
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/container";
import { buttonPrimary, buttonSecondary } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(sharedMessages);
  return { title: t.missingTitle };
}

export default async function NotFound() {
  const t = await getMessages(sharedMessages);
  return (
    <Container className="py-20 sm:py-28">
      <h1 className="text-4xl font-semibold text-ink sm:text-5xl">
        {t.missingHeading}
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-ink-soft">
        {t.missingBody}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/" className={buttonPrimary}>
          {t.home}
        </Link>
        <Link href="/progress" className={buttonSecondary}>
          {t.progress}
        </Link>
      </div>
    </Container>
  );
}
