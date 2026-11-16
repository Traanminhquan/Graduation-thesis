import { audioStorageConfig, saveRecording, pruneRecordings } from "./recording";
import { draftWhere, type SpeakingDb } from "./draft";
import { inspectAudio } from "./stt/audio";
import { dbSttLedger, withSttBudget, type SttLedger } from "./stt/budget";
import { STT_DURATION_TOLERANCE_SECONDS, SttError, sttConfig, type SttReason } from "./stt/config";
import { transcribeGroq } from "./stt/groq";
export type TranscribeDependencies = { env?: NodeJS.ProcessEnv; db?: SpeakingDb; ledger?: SttLedger; fetch?: typeof fetch };
export type TranscribeResult = { ok: true; transcript: string; durationMs: number } | { ok: false; reason: SttReason };
export async function transcribeSpeaking(userId: string, promptId: string, audio: Blob, hint: unknown, deps: TranscribeDependencies = {}): Promise<TranscribeResult> {
  try {
    const env = deps.env ?? process.env;
    if (env.SPEAKING_STT_ENABLED !== "true") throw new SttError("disabled");
    if (!userId) throw new SttError("unauthenticated");
    const db = deps.db ?? (await import("@/lib/db")).prisma;
    const prompt = await db.speakingPrompt.findUnique({ where: { id: promptId }, select: { speakingSeconds: true } });
    if (!prompt) throw new SttError("invalid_audio");
    const config = sttConfig(env);
    if (audio.size > config.maxBytes) throw new SttError("too_large");
    const bytes = new Uint8Array(await audio.arrayBuffer()), info = inspectAudio(bytes);
    const limit = (Math.min(config.maxSeconds, prompt.speakingSeconds ?? 120) + STT_DURATION_TOLERANCE_SECONDS) * 1000;
    if (info.durationMs < 1000 || info.durationMs > limit || (hint !== null && hint !== undefined && hint !== "" && (!Number.isFinite(Number(hint)) || Math.abs(Number(hint) - info.durationMs) > 2000))) throw new SttError("invalid_duration");
    return await withSttBudget(userId, info.durationMs / 1000, env, deps.ledger ?? dbSttLedger((await import("@/lib/db")).prisma), async () => {
      const transcript = await transcribeGroq(bytes, info, env, deps.fetch);
      const where = draftWhere(userId, promptId);
      const draftVersion = await db.$transaction(async tx => {
        const existing = await tx.speakingSubmission.findFirst({ where: { id: where.id } });
        const data = { rawTranscript: transcript, confirmedTranscript: null, audioDurationMs: info.durationMs, audioUrl: null };
        if (existing) {
          const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
          const updated = await tx.speakingSubmission.updateMany({ where: { ...where, updatedAt: existing.updatedAt }, data: { ...data, updatedAt } });
          if (updated.count !== 1) throw new SttError("unavailable");
          return updatedAt;
        } else {
          const created = await tx.speakingSubmission.create({ data: { ...where, ...data } });
          return created.updatedAt;
        }
      });
      if (audioStorageConfig(env).enabled) {
        // Commit removal first: a failed replacement must never resurrect an older take.
        try {
          const removed = await db.$transaction(async tx => {
            const claimed = await tx.speakingSubmission.updateMany({ where: { ...where, updatedAt: draftVersion }, data: { updatedAt: draftVersion } });
            if (claimed.count !== 1) return false;
            await tx.speakingRecording.deleteMany({ where: { submissionId: where.id, userId } });
            return true;
          });
          if (removed && bytes.length <= audioStorageConfig(env).maxBytes) {
            await db.$transaction(async tx => {
              // Do not attach audio if a concurrent confirmation consumed this draft.
              const claimed = await tx.speakingSubmission.updateMany({ where: { ...where, updatedAt: draftVersion }, data: { updatedAt: draftVersion } });
              if (claimed.count !== 1) return;
              await saveRecording(tx, { userId, submissionId: where.id, bytes, mime: info.mime, durationMs: info.durationMs });
              await pruneRecordings(tx, userId);
            });
          }
        } catch { /* The transcript has already committed; audio storage is optional. */ }
      }
      return { ok: true as const, transcript, durationMs: info.durationMs };
    });
  } catch (error) { return { ok: false, reason: error instanceof SttError ? error.reason : "unavailable" }; }
}
