"use client";

import { profileMessages } from "@/i18n/messages/profile";
import { useMessages } from "@/i18n/client";

import { useState, type FormEvent } from "react";

import { alertError, buttonPrimary, field } from "@/lib/ui";

type SubmitState =
  | { status: "idle" | "submitting" | "success" }
  | { status: "error"; message?: string; errors: Record<string, string> };

export function ChangePasswordForm() {
  const t = useMessages(profileMessages);
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState({ status: "submitting" });
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }),
      });
      const body: unknown = await response.json();
      const result = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      if (!response.ok) {
        const errors = typeof result.errors === "object" && result.errors !== null
          ? Object.fromEntries(Object.entries(result.errors).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
          : {};
        setState({ status: "error", errors, message: typeof result.error === "string" ? result.error : Object.keys(errors).length ? undefined : t.passwordFailed });
        return;
      }
      form.reset();
      setState({ status: "success" });
    } catch {
      setState({ status: "error", errors: {}, message: t.passwordRetry });
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="min-w-0 space-y-4" noValidate>
      {(["currentPassword", "newPassword"] as const).map((name) => (
        <div key={name} className="min-w-0">
          <label htmlFor={name} className="text-sm font-semibold text-ink">
            {name === "currentPassword" ? t.currentPassword : t.newPassword}
          </label>
          <input id={name} name={name} type="password" required
            autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
            className={`mt-1.5 min-w-0 ${field}`} disabled={state.status === "submitting"}
            aria-invalid={state.status === "error" && !!state.errors[name]}
            aria-describedby={state.status === "error" && state.errors[name] ? `${name}-error` : undefined} />
          {state.status === "error" && state.errors[name] ? (
            <p id={`${name}-error`} className="mt-1.5 break-words text-sm text-pen">{state.errors[name]}</p>
          ) : null}
        </div>
      ))}
      {state.status === "error" && state.message ? <p role="alert" className={alertError}>{state.message}</p> : null}
      {state.status === "success" ? <p role="status" className="text-sm text-ink">{t.passwordSaved}</p> : null}
      <button type="submit" disabled={state.status === "submitting"} className={`${buttonPrimary} w-full sm:w-auto`}>
        {t.changePassword}
      </button>
    </form>
  );
}
