"use client";

import { useState } from "react";

import { useMessages } from "@/i18n/client";
import { commonMessages } from "@/i18n/messages/common";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const t = useMessages(commonMessages).auth;

  async function handleSignOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // A full navigation, so no route cached for this account outlives the session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className="min-h-9 shrink-0 whitespace-nowrap rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink disabled:opacity-60"
    >
      {pending ? t.loggingOut : t.logOut}
    </button>
  );
}
