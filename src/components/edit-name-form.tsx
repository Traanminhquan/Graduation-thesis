"use client";

import { profileMessages } from "@/i18n/messages/profile";
import { useMessages } from "@/i18n/client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { alertError, buttonPrimary, field } from "@/lib/ui";

type SubmitState =
  | { status: "idle" | "submitting" | "success" }
  | { status: "error"; message?: string; errors: Record<string, string> };

export function EditNameForm({ name }: { name: string | null }) {
  const t = useMessages(profileMessages);
  const router = useRouter();
  const [value, setValue] = useState(name ?? "");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });
    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      const body: unknown = await response.json();
      const result = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      if (!response.ok) {
        const errors = typeof result.errors === "object" && result.errors !== null
          ? Object.fromEntries(Object.entries(result.errors).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
          : {};
        setState({ status: "error", errors, message: typeof result.error === "string" ? result.error : Object.keys(errors).length ? undefined : t.nameFailed });
        return;
      }
      if (typeof result.name === "string") setValue(result.name);
      setState({ status: "success" });
      window.dispatchEvent(new Event("auth-profile-updated"));
      router.refresh();
    } catch {
      setState({ status: "error", errors: {}, message: t.nameRetry });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-4" noValidate>
      <div className="min-w-0">
        {/* The section heading already says t.name; the label is for assistive technology. */}
        <label htmlFor="profile-name" className="sr-only">{t.name}</label>
        <input id="profile-name" name="name" type="text" required autoComplete="name"
          value={value} onChange={(event) => { setValue(event.target.value); setState({ status: "idle" }); }}
          className={`min-w-0 ${field}`} disabled={state.status === "submitting"}
          aria-invalid={state.status === "error" && !!state.errors.name}
          aria-describedby={state.status === "error" && state.errors.name ? "profile-name-error" : undefined} />
        {state.status === "error" && state.errors.name ? (
          <p id="profile-name-error" className="mt-1.5 break-words text-sm text-pen">{state.errors.name}</p>
        ) : null}
      </div>
      {state.status === "error" && state.message ? <p role="alert" className={alertError}>{state.message}</p> : null}
      {state.status === "success" ? <p role="status" className="text-sm text-ink">{t.nameSaved}</p> : null}
      <button type="submit" disabled={state.status === "submitting"} className={`${buttonPrimary} w-full sm:w-auto`}>
        {t.saveName}
      </button>
    </form>
  );
}
