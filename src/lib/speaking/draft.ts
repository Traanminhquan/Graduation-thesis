import type { PrismaClient } from "@prisma/client";
export type SpeakingDb = Pick<PrismaClient, "speakingPrompt" | "speakingSubmission" | "$transaction">;
export function speakingDraftId(userId: string, promptId: string) {
  const encode = (s: string) => encodeURIComponent(s).replace(/_/g, "%5F");
  return `speaking_draft_${encode(userId)}_${encode(promptId)}`;
}
export function draftWhere(userId: string, promptId: string) {
  return { id: speakingDraftId(userId, promptId), userId, promptId, status: "DRAFT" as const };
}
export async function getSpeakingDraft(userId: string, promptId: string, db?: SpeakingDb) {
  if (!userId) return null;
  const client = db ?? (await import("@/lib/db")).prisma;
  return client.speakingSubmission.findFirst({ where: draftWhere(userId, promptId), select: { rawTranscript: true, audioDurationMs: true } });
}
export function transcriptSource(row: { rawTranscript: string | null }): "speech-to-text" | "manual" {
  return row.rawTranscript !== null ? "speech-to-text" : "manual";
}
