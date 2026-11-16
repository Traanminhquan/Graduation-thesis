"use client";

import { sharedMessages } from "@/i18n/messages/shared";
import { useMessages } from "@/i18n/client";

import { useEffect } from "react";

import { Container } from "@/components/container";
import { buttonPrimary } from "@/lib/ui";

/** Unexpected failures, most often the database being briefly unreachable. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useMessages(sharedMessages);
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-20 sm:py-28">
      <h1 className="text-4xl font-semibold text-ink sm:text-5xl">
        {t.loadTitle}
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-ink-soft">
        {t.loadBody}
      </p>
      <button type="button" onClick={() => retry()} className={`${buttonPrimary} mt-8`}>
        {t.retry}
      </button>
    </Container>
  );
}
