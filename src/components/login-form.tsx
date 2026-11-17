"use client";

import { authMessages } from "@/i18n/messages/auth";
import { useMessages } from "@/i18n/client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { alertError, buttonPrimary, field, linkInline } from "@/lib/ui";

type FieldErrors = Record<string, string>;

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string; errors?: FieldErrors };

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return {};
}

function readErrors(value: unknown): FieldErrors | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

const inputClass = `mt-1.5 ${field}`;

export function LoginForm() {
  const t = useMessages(authMessages);
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setState({ status: "submitting" });

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    const data = await readJson(response);
    if (!response.ok) {
      setState({
        status: "error",
        message: typeof data.error === "string" ? data.error : t.loginFailed,
        errors: readErrors(data.errors),
      });
      return;
    }

    // A full navigation: refreshing the router here would re-request this auth
    // page with the new cookie, and the proxy would send it to /profile. It also
    // drops any client-side route cache from before the session changed.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  const submitting = state.status === "submitting";

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          {t.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
          placeholder={t.emailPlaceholder}
        />
        {state.status === "error" && state.errors?.email ? (
          <p className="mt-1.5 text-sm text-pen">{state.errors.email}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          {t.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
          placeholder={t.yourPassword}
        />
        {state.status === "error" && state.errors?.password ? (
          <p className="mt-1.5 text-sm text-pen">{state.errors.password}</p>
        ) : null}
      </div>

      {state.status === "error" ? (
        <p
          role="alert"
          className={alertError}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className={`${buttonPrimary} w-full`}
      >
        {submitting ? t.signingIn : t.signIn}
      </button>

      <p className="text-center text-sm text-ink-soft">
        {t.noAccount}{" "}
        <Link href="/register" className={linkInline}>
          {t.createOne}
        </Link>
      </p>
    </form>
  );
}
