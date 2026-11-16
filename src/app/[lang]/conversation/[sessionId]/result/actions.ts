"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { aiFailureCode } from "@/lib/ai/failure";
import { assessConversationForUser } from "@/lib/conversation/assess";

export async function requestConversationAssessment(sessionId: string): Promise<void> {
  const user = await requireUser();
  const result = await assessConversationForUser(sessionId, user.id);
  redirect(`/conversation/${encodeURIComponent(sessionId)}/result${result.ok ? "" : `?ai=${aiFailureCode(result)}`}`);
}
