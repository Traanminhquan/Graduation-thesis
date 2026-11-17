"use server";

import { getRequestLocale } from "@/i18n/request";

import { getRequestMessages } from "@/i18n/request";
import { speakingMessages } from "@/i18n/messages/speaking";

import { redirect } from "next/navigation";

import { authRateLimiter, SUBMISSION_RULE, limitMessage } from "@/lib/auth/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { confirmSpeakingForUser, submitSpeakingForUser } from "@/lib/speaking/submit";

export type SubmitSpeakingState = { error: string | null };

export async function confirmSpeakingTranscript(promptId: string, text: string): Promise<SubmitSpeakingState> {
  const t = await getRequestMessages(speakingMessages);
  const user = await getCurrentUser();
  if (!user) return { error: t.pleaseSignInAgain };

  const locale = await getRequestLocale();
  const decision = authRateLimiter.consume(`submission:speaking:${user.id}`, SUBMISSION_RULE);
  if (!decision.ok) return { error: limitMessage(decision, locale) };
  const result = await confirmSpeakingForUser(user.id, promptId, text, undefined, process.env, locale);
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

  const locale = await getRequestLocale();
  const decision = authRateLimiter.consume(`submission:speaking:${user.id}`, SUBMISSION_RULE);
  if (!decision.ok) return { error: limitMessage(decision, locale) };

  const result = await submitSpeakingForUser({
    locale,
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
