import type { PrismaClient } from "@prisma/client";
import { cleanWritingText, MAX_WRITING_CHARACTERS } from "./validation";
import { countWords } from "./analysis";

export type DraftDb = Pick<PrismaClient, "writingPrompt" | "writingSubmission" | "$transaction" | "$executeRaw">;
export function lockWritingDraft(client: Pick<PrismaClient, "$executeRaw">, userId: string, promptId: string) {
  const key = `writing-draft:${userId}:${promptId}`;
  return client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
export async function getSubmissionBaseline(userId: string, promptId: string, db?: Pick<DraftDb, "writingSubmission">): Promise<string | null> {
  const client = db ?? (await import("@/lib/db")).prisma;
  const row = await client.writingSubmission.findFirst({
    where: { userId, promptId, status: { not: "DRAFT" } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true },
  });
  return row?.id ?? null;
}
export type Draft = { text: string; savedAt: string | null };
export type SaveDraftResult = { ok: true; savedAt: string | null } | {
  ok: false; reason: "conflict" | "invalid" | "unauthenticated" | "unavailable";
  serverText?: string; serverSavedAt?: string | null;
};
export function draftId(userId: string, promptId: string) {
  return `draft_${encodeURIComponent(userId).replace(/_/g, "%5F")}_${encodeURIComponent(promptId).replace(/_/g, "%5F")}`;
}
async function database(db?: DraftDb) {
  return db ?? (await import("@/lib/db")).prisma;
}
export async function getDraftForUser(userId: string, promptId: string, db?: DraftDb): Promise<Draft | null> {
  const client = await database(db);
  const row = await client.writingSubmission.findFirst({
    where: { userId, promptId, status: "DRAFT" }, orderBy: { updatedAt: "desc" },
    select: { draftText: true, updatedAt: true },
  });
  return row ? { text: row.draftText ?? "", savedAt: row.updatedAt.toISOString() } : null;
}
export async function saveDraftForUser(
  input: { userId: string; promptId: string; text: string; baseSavedAt: string | null; submissionBaseline: string | null },
  db?: DraftDb,
): Promise<SaveDraftResult> {
  const { userId, promptId, baseSavedAt } = input;
  if (!userId) return { ok: false, reason: "unauthenticated" };
  if (typeof input.text !== "string" || !promptId ||
    (baseSavedAt !== null && (typeof baseSavedAt !== "string" || !Number.isFinite(Date.parse(baseSavedAt))))) {
    return { ok: false, reason: "invalid" };
  }
  const text = cleanWritingText(input.text);
  if (text.length > MAX_WRITING_CHARACTERS) return { ok: false, reason: "invalid" };
  try {
    const client = await database(db);
    if (!await client.writingPrompt.findUnique({ where: { id: promptId }, select: { id: true } })) return { ok: false, reason: "invalid" };
    const where = { id: draftId(userId, promptId), userId, promptId, status: "DRAFT" as const };
    const row = await client.writingSubmission.findFirst({ where });
    const conflict = async (): Promise<SaveDraftResult> => {
      const current = await getDraftForUser(userId, promptId, client);
      return { ok: false, reason: "conflict", serverText: current?.text, serverSavedAt: current?.savedAt ?? null };
    };
    if (row) {
      if (!baseSavedAt || row.updatedAt.toISOString() !== baseSavedAt) return conflict();
      // Explicitly advance the version even when two saves occur in one millisecond.
      const updatedAt = new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1));
      const updated = await client.writingSubmission.updateMany({
        where: { ...where, updatedAt: new Date(baseSavedAt) },
        data: { draftText: text, finalText: null, wordCount: countWords(text), updatedAt },
      });
      if (!updated.count) return conflict();
      return { ok: true, savedAt: updatedAt.toISOString() };
    }
    if (baseSavedAt) return conflict();
    if (input.submissionBaseline !== null && typeof input.submissionBaseline !== "string") return { ok: false, reason: "invalid" };
    // A reserved id in another state must never be changed, even for empty input.
    const occupied = await client.writingSubmission.findFirst({ where: { id: where.id }, select: { id: true } });
    if (occupied) return conflict();
    if (!text) return { ok: true, savedAt: null };
    return await client.$transaction(async (tx): Promise<SaveDraftResult> => {
      await lockWritingDraft(tx, userId, promptId);
      if (await getSubmissionBaseline(userId, promptId, tx) !== input.submissionBaseline) {
        return { ok: false, reason: "conflict" };
      }
      const created = await tx.writingSubmission.create({ data: {
        ...where, draftText: text, finalText: null, wordCount: countWords(text),
      }, select: { updatedAt: true } });
      return { ok: true, savedAt: created.updatedAt.toISOString() };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      try {
        const current = await getDraftForUser(userId, promptId, db);
        return { ok: false, reason: "conflict", serverText: current?.text, serverSavedAt: current?.savedAt ?? null };
      } catch { return { ok: false, reason: "unavailable" }; }
    }
    return { ok: false, reason: "unavailable" };
  }
}

