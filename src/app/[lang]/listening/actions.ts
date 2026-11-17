"use server";

import { getRequestLocale } from "@/i18n/request";

import { redirect } from "next/navigation";

import { authRateLimiter, ATTEMPT_RULE, limitMessage } from "@/lib/auth/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { submitListeningAttemptForUser } from "@/lib/listening/submit";

export type SubmitListeningState = { error: string | null };

/**
 * Server Action behind the Listening form.
 *
 * Bound to a lesson id by the page (`action.bind(null, lesson.id)`), so the
 * only client-controlled data is the answer sheet itself. The session is
 * re-read here rather than trusting the proxy, and the answers are graded
 * server-side from the database copy of the questions.
 *
 * Field names:
 *   q_<questionId>              one value for multiple choice / true-false /
 *                               fill-in-the-blank
 *   m_<questionId>_<pairIndex>  one value per matching row; the selections are
 *                               collected in pair order into a JSON array and
 *                               mapped to `{ left: right }` by the submit
 *                               service (which knows the pairs).
 */
export async function submitListeningAttempt(
  lessonId: string,
  _previous: SubmitListeningState,
  formData: FormData,
): Promise<SubmitListeningState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const locale = await getRequestLocale();
  const decision = authRateLimiter.consume(`attempt:listening:${user.id}`, ATTEMPT_RULE);
  if (!decision.ok) return { error: limitMessage(decision, locale) };

  const responses: Record<string, string> = {};
  const matching = new Map<string, string[]>();

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;

    if (key.startsWith("q_")) {
      responses[key.slice(2)] = value;
      continue;
    }

    if (key.startsWith("m_")) {
      const rest = key.slice(2);
      const separator = rest.lastIndexOf("_");
      if (separator < 1) continue;

      const questionId = rest.slice(0, separator);
      const index = Number(rest.slice(separator + 1));
      if (!Number.isInteger(index) || index < 0) continue;

      const selections = matching.get(questionId) ?? [];
      selections[index] = value;
      matching.set(questionId, selections);
    }
  }

  for (const [questionId, selections] of matching) {
    responses[questionId] = JSON.stringify(selections);
  }

  const result = await submitListeningAttemptForUser({
    locale,
    userId: user.id,
    lessonId,
    responses,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  redirect(`/listening/${lessonId}/result/${result.attemptId}`);
}
