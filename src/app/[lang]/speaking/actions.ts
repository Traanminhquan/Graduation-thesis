"use server";

import { getRequestLocale } from "@/i18n/request";

import { getRequestMessages } from "@/i18n/request";
import { speakingMessages } from "@/i18n/messages/speaking";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { confirmSpeakingForUser, submitSpeakingForUser } from "@/lib/speaking/submit";

export type SubmitSpeakingState = { error: string | null };

export async function confirmSpeakingTranscript(promptId: string, text: string): Promise<SubmitSpeakingState> {
  const t = await getRequestMessages(speakingMessages);
  const user = await getCurrentUser();
  if (!user) return { error: t.pleaseSignInAgain };
  const result = await confirmSpeakingForUser(user.id, promptId, text, undefined, process.env, await getRequestLocale());
  if (!result.ok) return { error: result.message };
  redirect(`/speaking/${promptId}/result/${result.submissionId}`);
}

/** Manual fallback: accepts only duration and typed text; raw output is server-only. */
export async function submitSpeakingResponse(
  promptId: string,
  _previous: SubmitSpeakingState,
  formData: FormData,
): Promise<SubmitSpeakingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await submitSpeakingForUser({
    locale: await getRequestLocale(),
    userId: user.id,
    promptId,
    durationMs: formData.get("durationMs"),
    transcript: formData.get("transcript"),
  });

  if (!result.ok) {
    return { error: result.message };
  }

  redirect(`/speaking/${promptId}/result/${result.submissionId}`);
}
