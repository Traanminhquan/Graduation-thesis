import Link from "next/link";
import { AuthSlot } from "@/components/auth-slot";
import { Container } from "@/components/container";
import { LanguageSwitch } from "@/components/language-switch";
import { SiteNav } from "@/components/site-nav";
import { commonMessages } from "@/i18n/messages/common";
import { getMessages } from "@/i18n/server";
import { site } from "@/lib/site";

export async function SiteHeader() {
  const t = await getMessages(commonMessages);

  return (
    <header className="z-40 border-b border-line bg-surface lg:sticky lg:top-0">
      <Container className="flex h-16 min-w-0 items-center gap-2 sm:gap-4">
        <Link
          href="/"
          aria-label={t.site.homeLabel(site.name)}
          className="shrink-0 font-display text-2xl font-semibold tracking-tight text-ink"
        >
          {site.name}
        </Link>

        <SiteNav className="hidden lg:flex" />

        {/* Auth-aware nav lands here (see components/auth-slot.tsx). */}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-3">
          <LanguageSwitch />
          <AuthSlot />
        </div>
      </Container>

      {/* Below lg the navigation takes its own row (it does not fit beside the logo). */}
      <div className="border-t border-line/70 lg:hidden">
        <Container className="flex flex-wrap justify-center gap-1 py-2">
          <SiteNav className="flex flex-wrap justify-center" />
        </Container>
      </div>
    </header>
  );
}
