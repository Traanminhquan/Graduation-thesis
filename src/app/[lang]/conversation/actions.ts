"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { endConversation, startConversation } from "@/lib/conversation/session";

export async function startConversationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  let destination = "/conversation?error=unavailable";
  try {
    const result = await startConversation(user.id, formData.get("scenarioId"));
    if (result.ok) destination = `/conversation/${encodeURIComponent(result.sessionId)}`;
    else if (result.reason !== "unauthenticated") destination = `/conversation?error=${result.reason}`;
  } catch {
    // Database failures use the same public message without exposing details.
  }
  redirect(destination);
}

export async function endConversationAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = formData.get("sessionId");
  if (typeof id !== "string" || !id || id.length > 200) redirect("/conversation");
  await endConversation(user.id, id);
  redirect(`/conversation/${encodeURIComponent(id)}/result`);
}
