import type { PrismaClient } from "@prisma/client";

export const RECORDINGS_PER_USER = 20;
const MAX_BYTES = 3 * 1024 * 1024;
const PREFIX = "/api/speaking/recordings/";
type RecordingDb = Pick<PrismaClient, "speakingRecording" | "speakingSubmission">;
export function audioStorageConfig(env: NodeJS.ProcessEnv) {
  const raw = env.SPEAKING_AUDIO_MAX_BYTES;
  const maxBytes = raw === undefined || raw.trim() === "" ? MAX_BYTES : Number(raw);
  const valid = Number.isFinite(maxBytes) && maxBytes > 0 && maxBytes <= MAX_BYTES;
  return { enabled: env.SPEAKING_AUDIO_STORAGE_ENABLED === "true" && valid, maxBytes: valid ? maxBytes : MAX_BYTES };
}
export function recordingUrl(submissionId: string) { return `${PREFIX}${encodeURIComponent(submissionId)}`; }
export function isRecordingUrl(value: unknown): value is string { return typeof value === "string" && value.startsWith(PREFIX); }
export async function saveRecording(tx: RecordingDb, input: { userId: string; submissionId: string; bytes: Uint8Array; mime: string; durationMs: number }) {
  const { bytes, ...rest } = input;
  const data = { ...rest, data: Buffer.from(bytes), sizeBytes: bytes.length };
  // A new take counts as new for the per-learner limit.
  await tx.speakingRecording.upsert({ where: { submissionId: input.submissionId }, create: data, update: { ...data, createdAt: new Date() }, select: { id: true } });
}
export async function pruneRecordings(tx: RecordingDb, userId: string) {
  const older = await tx.speakingRecording.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: RECORDINGS_PER_USER, select: { id: true, submissionId: true } });
  if (!older.length) return;
  await tx.speakingRecording.deleteMany({ where: { userId, id: { in: older.map(r => r.id) } } });
  await tx.speakingSubmission.updateMany({ where: { userId, id: { in: older.map(r => r.submissionId) } }, data: { audioUrl: null } });
}
export async function getRecordingForUser(db: RecordingDb, submissionId: string, userId: string) {
  return db.speakingRecording.findFirst({ where: { submissionId, userId }, select: { mime: true, data: true, sizeBytes: true } });
}
export async function deleteRecordingForUser(db: Pick<PrismaClient, "$transaction">, submissionId: string, userId: string) {
  return db.$transaction(async tx => {
    const deleted = await tx.speakingRecording.deleteMany({ where: { submissionId, userId } });
    await tx.speakingSubmission.updateMany({ where: { id: submissionId, userId }, data: { audioUrl: null } });
    return deleted.count > 0;
  });
}

// Injectable session/database boundaries keep the HTTP guards testable offline.
export function recordingHandlers(
  session: () => Promise<{ id: string } | null>,
  database: () => Promise<RecordingDb & Pick<PrismaClient, "$transaction">>,
  env: NodeJS.ProcessEnv = process.env,
) {
  type Context = { params: Promise<{ submissionId: string }> };
  async function GET(_request: Request, context: Context) {
    try {
      const user = await session();
      if (!user) return new Response(null, { status: 404 });
      const { submissionId } = await context.params;
      const prisma = await database();
      const recording = await getRecordingForUser(prisma, submissionId, user.id);
      if (!recording || !["audio/webm", "audio/ogg", "audio/mp4"].includes(recording.mime)) return new Response(null, { status: 404 });
      const body = new Uint8Array(recording.data);
      return new Response(body, { headers: {
        "Content-Type": recording.mime,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      } });
    } catch { return new Response(null, { status: 404 }); }
  }
  async function DELETE(request: Request, context: Context) {
    const { checkSameOrigin } = await import("../http/same-origin");
    if (!checkSameOrigin(request, env)) return Response.json({ ok: false }, { status: 403 });
    try {
      const user = await session();
      if (!user) return Response.json({ ok: false }, { status: 401 });
      const { submissionId } = await context.params;
      const prisma = await database();
      const deleted = await deleteRecordingForUser(prisma, submissionId, user.id);
      return Response.json({ ok: deleted }, { status: deleted ? 200 : 404 });
    } catch { return Response.json({ ok: false }, { status: 404 }); }
  }

  return { GET, DELETE };
}
