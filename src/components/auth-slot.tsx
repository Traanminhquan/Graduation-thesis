"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useMessages, useVisiblePath } from "@/i18n/client";
import { commonMessages } from "@/i18n/messages/common";

import { buttonPrimary } from "@/lib/ui";

import { LogoutButton } from "./logout-button";

type SlotUser = { id: string; name: string | null; email: string };

type SlotState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: SlotUser };

function isSlotUser(value: unknown): value is SlotUser {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.email === "string" &&
    (typeof record.name === "string" || record.name === null)
  );
}

/**
 * Session-aware part of the header.
 *
 * Kept client-side on purpose: reading the session cookie while the layout
 * renders would make every route dynamic under `cacheComponents`, and the
 * header shell is otherwise static. Enforcement lives on the server (proxy +
 * pages); this component only decides what the navigation shows.
 *
 * The header stays mounted across client navigations, so the session is read
 * again whenever the learner enters or leaves an auth page. That is exactly
 * when it can have changed (log in, register, log out, expired session), and
 * ordinary navigation costs no extra request. Profile saves also request a
 * session refresh through the auth-profile-updated event.
 */
export function AuthSlot() {
  const [state, setState] = useState<SlotState>({ status: "loading" });
  const pathname = useVisiblePath();
  const t = useMessages(commonMessages).auth;
  const authArea = pathname === "/login" || pathname === "/register" ? pathname : "app";

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const data: unknown = await response.json();
        const user =
          typeof data === "object" && data !== null
            ? (data as Record<string, unknown>).user
            : null;

        if (cancelled) return;
        setState(isSlotUser(user) ? { status: "authenticated", user } : { status: "anonymous" });
      } catch {
        if (!cancelled) setState({ status: "anonymous" });
      }
    }

    const refreshSession = () => { void loadSession(); };
    window.addEventListener("auth-profile-updated", refreshSession);
    void loadSession();
    return () => {
      cancelled = true;
      window.removeEventListener("auth-profile-updated", refreshSession);
    };
  }, [authArea]);

  if (state.status === "loading") {
    return <span className="h-9 w-24 animate-pulse rounded-lg bg-line/70" aria-hidden="true" />;
  }

  if (state.status === "anonymous") {
    return (
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap sm:gap-2">
        <Link
          href="/login"
          className="rounded-lg px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          {t.logIn}
        </Link>
        <Link href="/register" className={`${buttonPrimary} min-h-9 px-4 py-1.5`}>
          {t.signUp}
        </Link>
      </div>
    );
  }

  const label = state.user.name ?? state.user.email;

  return (
    <div className="flex min-w-0 items-center gap-1 sm:gap-2">
      <Link
        href="/profile"
        title={state.user.email}
        className="min-w-[3rem] max-w-[10rem] truncate rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:text-ink-soft"
      >
        {label}
      </Link>
      <LogoutButton />
    </div>
  );
}
