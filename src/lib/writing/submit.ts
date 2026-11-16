import type { Locale } from "@/i18n/config";
import { writingMessages } from "@/i18n/messages/writing";
import type { assessWritingForUser } from "./assess";

import { SubmissionStatus } from "@prisma/client";

import { draftId, lockWritingDraft, type DraftDb } from "./draft";
import { validateWritingText } from "@/lib/writing/validation";

export type SubmitWritingInput = {
  userId: string;
  promptId: string;
  text: string;
  locale?: Locale;
};

export type SubmitWritingResult =
  | { ok: true; submissionId: string; wordCount: number; assessment?: Awaited<ReturnType<typeof assessWritingForUser>> }
  | { ok: false; message: string };

export async function submitWritingForUser({
  userId,
  promptId,
  text,
  locale = "en",
}: SubmitWritingInput, dependencies?: { db: DraftDb; assess: typeof assessWritingForUser }): Promise<SubmitWritingResult> {
  const prisma = dependencies?.db ?? (await import("@/lib/db")).prisma;
  const prompt = await prisma.writingPrompt.findUnique({
    where: { id: promptId },
    select: { id: true },
  });

  if (!prompt) {
    return { ok: false, message: writingMessages[locale].missingPrompt };
  }

  const validated = validateWritingText(text, locale);
  if (!validated.ok) {
    return { ok: false, message: validated.error };
  }

  let submission: { id: string };
  try {
    const results = await prisma.$transaction([
      lockWritingDraft(prisma, userId, promptId),
      prisma.writingSubmission.deleteMany({
        where: { id: draftId(userId, promptId), userId, promptId, status: "DRAFT" },
      }),
      prisma.writingSubmission.create({
        data: {
          userId,
          promptId: prompt.id,
          draftText: null,
          finalText: validated.text,
          wordCount: validated.wordCount,
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
        },
        select: { id: true },
      }),
    ]);
    submission = results[2];
  } catch {
    return { ok: false, message: writingMessages[locale].submitFailed };
  }

  const assessment = await (dependencies?.assess ?? (await import("./assess")).assessWritingForUser)(submission.id, userId);

  return {
    ok: true,
    submissionId: submission.id,
    wordCount: validated.wordCount,
    assessment,
  };
}
