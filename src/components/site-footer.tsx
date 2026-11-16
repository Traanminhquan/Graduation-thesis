import Link from "next/link";
import { Container } from "@/components/container";
import { commonMessages } from "@/i18n/messages/common";
import { getMessages } from "@/i18n/server";
import { navigation, site } from "@/lib/site";
import type { NavItem } from "@/lib/types";

export async function SiteFooter() {
  const t = await getMessages(commonMessages);
  const links: NavItem[] = [...navigation, { key: "profile", href: "/profile" }];

  return (
    <footer className="border-t border-line bg-surface">
      <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-base font-semibold text-ink">{site.name}</p>
        <nav aria-label={t.nav.footer}>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-ink-muted transition-colors hover:text-ink"
                >
                  {t.nav[item.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
