"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { navigation } from "@/lib/site";
import { useMessages, useVisiblePath } from "@/i18n/client";
import { commonMessages } from "@/i18n/messages/common";

/** Primary navigation with a pathname-aware active state. */
export function SiteNav({ className }: { className?: string }) {
  // The visible path: prerendered pages know `/vi/reading`, the browser shows `/reading`.
  const pathname = useVisiblePath();
  const t = useMessages(commonMessages).nav;

  return (
    <nav aria-label={t.primary} className={cn("items-center sm:gap-1", className)}>
      {navigation.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-sm px-0.5 py-1.5 text-[0.8125rem] font-medium transition-colors sm:px-2.5 sm:text-sm",
              isActive ? "text-ink" : "text-ink-muted hover:text-ink",
            )}
          >
            <span className={isActive ? "marked" : undefined}>{t[item.key]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
