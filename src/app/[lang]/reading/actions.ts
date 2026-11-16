"use server";

import { getRequestLocale } from "@/i18n/request";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/current-user";
import { submitReadingAttemptForUser } from "@/lib/reading/submit";

export type SubmitReadingState = { error: string | null };

/**
 * Server Action behind the Reading form.
 *
 * Bound to a lesson id by the page (`action.bind(null, lesson.id)`), so the
 * only client-controlled data is the answer sheet itself. The session is
 * re-read here rather than trusting the proxy, and the answers are graded
 * server-side from the database copy of the questions.
 */
export async function submitReadingAttempt(
  lessonId: string,
  _previous: SubmitReadingState,
  formData: FormData,
): Promise<SubmitReadingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const responses: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("q_") || typeof value !== "string") continue;
    responses[key.slice(2)] = value;
  }

  const result = await submitReadingAttemptForUser({
    locale: await getRequestLocale(),
    userId: user.id,
    lessonId,
    responses,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  redirect(`/reading/${lessonId}/result/${result.attemptId}`);
}
