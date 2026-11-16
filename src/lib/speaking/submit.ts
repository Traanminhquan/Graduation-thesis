import type { Locale } from "@/i18n/config";
import { speakingMessages } from "@/i18n/messages/speaking";
import { audioStorageConfig, recordingUrl } from "./recording";
import { draftWhere, type SpeakingDb } from "./draft";
import { resolveMaxDurationMs, validateSpeakingAttempt, validateTranscript } from "./validation";
export type SubmitSpeakingInput = { userId: string; promptId: string; durationMs: unknown; transcript: unknown; locale?: Locale };
export type SubmitSpeakingResult = { ok: true; submissionId: string; durationMs: number } | { ok: false; message: string };
const failure = (locale: Locale = "en"): SubmitSpeakingResult => ({ ok: false, message: speakingMessages[locale].submitFailed });
export async function submitSpeakingForUser(input: SubmitSpeakingInput, db?: SpeakingDb): Promise<SubmitSpeakingResult> {
  const locale = input.locale ?? "en";
  if (!input.userId) return failure(locale);
  try {
    const client = db ?? (await import("@/lib/db")).prisma;
    const prompt = await client.speakingPrompt.findUnique({ where: { id: input.promptId }, select: { speakingSeconds: true } });
    if (!prompt) return failure(locale);
    const checked = validateSpeakingAttempt({ ...input, maxMs: resolveMaxDurationMs(prompt.speakingSeconds) }, locale);
    if (!checked.ok) return { ok: false, message: checked.error };
    if (!checked.transcript) return failure(locale);
    const row = await client.$transaction(async tx => {
      await tx.speakingSubmission.deleteMany({ where: draftWhere(input.userId, input.promptId) });
      return tx.speakingSubmission.create({ data: { userId: input.userId, promptId: input.promptId, audioUrl: null, audioDurationMs: checked.durationMs, rawTranscript: null, confirmedTranscript: checked.transcript, status: "SUBMITTED", submittedAt: new Date() }, select: { id: true } });
    });
    return { ok: true, submissionId: row.id, durationMs: checked.durationMs };
  } catch { return failure(locale); }
}
export async function confirmSpeakingForUser(userId: string, promptId: string, text: unknown, db?: SpeakingDb, env: NodeJS.ProcessEnv = process.env, locale: Locale = "en"): Promise<SubmitSpeakingResult> {
  if (!userId) return failure(locale);
  const checked = validateTranscript(text, locale);
  if (!checked.ok || !checked.transcript) return failure(locale);
  try {
    const client = db ?? (await import("@/lib/db")).prisma;
    return await client.$transaction(async tx => {
      const where = draftWhere(userId, promptId);
      const draft = await tx.speakingSubmission.findFirst({ where });
      if (!draft?.rawTranscript || !draft.audioDurationMs) return failure(locale);
      const recording = audioStorageConfig(env).enabled
        ? await tx.speakingRecording.findFirst({ where: { submissionId: draft.id, userId }, select: { mime: true, sizeBytes: true, durationMs: true, data: true, createdAt: true } })
        : null;
      const claimed = await tx.speakingSubmission.deleteMany({ where: { ...where, updatedAt: draft.updatedAt } });
      if (claimed.count !== 1) return failure(locale);
      const row = await tx.speakingSubmission.create({ data: { userId, promptId, rawTranscript: draft.rawTranscript, confirmedTranscript: checked.transcript, audioDurationMs: draft.audioDurationMs, audioUrl: null, status: "SUBMITTED", submittedAt: new Date() }, select: { id: true } });
      if (recording) {
        await tx.speakingRecording.create({ data: { ...recording, userId, submissionId: row.id }, select: { id: true } });
        await tx.speakingSubmission.updateMany({ where: { id: row.id, userId }, data: { audioUrl: recordingUrl(row.id) } });
      }
      return { ok: true, submissionId: row.id, durationMs: draft.audioDurationMs };
    });
  } catch { return failure(locale); }
}
