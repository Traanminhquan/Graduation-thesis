import { INTL_LOCALE } from "@/i18n/config";

import { profileMessages } from "@/i18n/messages/profile";
import { getLocale, getMessages } from "@/i18n/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { Container } from "@/components/container";
import { ChangePasswordForm } from "@/components/change-password-form";
import { EditNameForm } from "@/components/edit-name-form";
import { LogoutButton } from "@/components/logout-button";
import { SiteNavLinks } from "@/components/profile-nav-links";
import { requireUser } from "@/lib/auth/current-user";
import { sheet, skeleton } from "@/lib/ui";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getMessages(profileMessages);
  return { title: t.title };
}

export default async function ProfilePage() {
  const t = await getMessages(profileMessages);
  return (
    <Container narrow className="py-8 sm:py-12">
      <h1 className="text-4xl font-semibold tracking-tight text-ink">{t.title}</h1>

      {/* The session cookie is request-time data, so with Cache Components
          enabled it must sit inside a Suspense boundary. */}
      <Suspense fallback={<div className={`${skeleton} mt-6 h-32`} aria-hidden="true" />}>
        <ProfileDetails />
      </Suspense>
    </Container>
  );
}

async function ProfileDetails() {
  const t = await getMessages(profileMessages);
  // Request-time from here on: the session cookie and "member since" formatting
  // must never be part of the prerendered shell.
  await connection();
  const user = await requireUser();
  const displayName = user.name ?? t.unnamed;
  const memberSince = new Intl.DateTimeFormat(INTL_LOCALE[await getLocale()], {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(user.createdAt);

  return (
    <>
      <section
        aria-label={t.account}
        className={`${sheet} mt-6 flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8`}
      >
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold text-ink">{displayName}</p>
          <p className="mt-1 break-all text-base text-ink-soft">{user.email}</p>
          <p className="mt-1 text-sm text-ink-muted">{t.memberSince(memberSince)}</p>
        </div>
        <LogoutButton />
      </section>

      <section aria-label={t.details} className={`${sheet} mt-6 min-w-0 p-6 sm:p-8`}>
        <h2 id="name-heading" className="mb-4 font-display text-2xl font-semibold text-ink">{t.name}</h2>
        <EditNameForm name={user.name} />
        <div className="my-8 border-t border-line" />
        <h2 id="password-heading" className="mb-4 font-display text-2xl font-semibold text-ink">{t.password}</h2>
        <ChangePasswordForm />
      </section>
      <SiteNavLinks />
    </>
  );
}
