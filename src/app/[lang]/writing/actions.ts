"use server";

import { getRequestLocale } from "@/i18n/request";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { submitWritingForUser } from "@/lib/writing/submit";

export type SubmitWritingState = { error: string | null };

/**
 * Server Action behind the Writing editor.
 *
 * Bound to a prompt id by the page (`action.bind(null, prompt.id)`), so the
 * only client-controlled data is the response text. The session is re-read
 * here rather than trusting the proxy; validation, the word count and the
 * stored text all come from `submitWritingForUser` / `validateWritingText`.
 *
 * No AI/LLM call is made and no WritingAssessment row is written — the
 * rule-based summary is recomputed on the result page.
 */
export async function submitWritingResponse(
  promptId: string,
  _previous: SubmitWritingState,
  formData: FormData,
): Promise<SubmitWritingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = formData.get("text");
  const result = await submitWritingForUser({
    locale: await getRequestLocale(),
    userId: user.id,
    promptId,
    text: typeof raw === "string" ? raw : "",
  });

  if (!result.ok) {
    return { error: result.message };
  }

  redirect(`/writing/${promptId}/result/${result.submissionId}`);
}

export async function saveWritingDraft(promptId: string, text: string, baseSavedAt: string | null, submissionBaseline: string | null): Promise<import("@/lib/writing/draft").SaveDraftResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, reason: "unauthenticated" };
    const { saveDraftForUser } = await import("@/lib/writing/draft");
    return await saveDraftForUser({ userId: user.id, promptId, text, baseSavedAt, submissionBaseline });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
