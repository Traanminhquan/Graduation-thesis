"use server";

import { redirect } from "next/navigation";
import { getRequestLocale, getRequestMessages } from "@/i18n/request";
import { listeningMessages } from "@/i18n/messages/listening";
import { authRateLimiter, RETRY_RULE, limitMessage } from "@/lib/auth/rate-limit";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getListeningRetryForUser } from "@/lib/listening/data";
import { gradeRetry } from "@/lib/listening/retry";
import { parseMatchingPairs } from "@/lib/listening/scoring";

export type RetryState = { review: ReturnType<typeof gradeRetry> | null; error?: string };

export async function checkRetry(lessonId: string, attemptId: string, _previous: RetryState, formData: FormData): Promise<RetryState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const locale = await getRequestLocale();
  const decision = authRateLimiter.consume(`retry:listening:${user.id}`, RETRY_RULE);
  if (!decision.ok) return { review: null, error: limitMessage(decision, locale) };
  const t = await getRequestMessages(listeningMessages);
  const context = await getListeningRetryForUser(attemptId, user.id, lessonId);
  if (!context) return { review: null, error: t.missingLesson };
  if (!context.wrongIds.length) redirect(`/listening/${lessonId}/result/${attemptId}`);
  const responses: Record<string, string | null> = Object.create(null);
  for (const question of context.questions) {
    if (!context.wrongIds.includes(question.id)) continue;
    const value = formData.get(`q_${question.id}`);
    responses[question.id] = typeof value === "string" ? value : null;
    if (question.type === "MATCHING") {
      responses[question.id] = JSON.stringify(parseMatchingPairs(question.matchingPairs).map((_, index) => {
        const value = formData.get(`m_${question.id}_${index}`);
        return typeof value === "string" ? value : "";
      }));
    }
  }
  return { review: gradeRetry(context.questions, context.wrongIds, responses) };
}
