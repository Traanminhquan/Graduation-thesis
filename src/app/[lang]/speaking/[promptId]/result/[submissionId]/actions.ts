"use server";
import { aiFailureCode } from "@/lib/ai/failure";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { assessSpeakingForUser } from "@/lib/speaking/assess";
export async function requestSpeakingAssessment(promptId: string, submissionId: string) {
  const user = await requireUser();
  const submission = await prisma.speakingSubmission.findFirst({ where: { id: submissionId, userId: user.id, promptId, status: { not: "DRAFT" } }, select: { id: true } });
  if (!submission) redirect("/speaking");
  const result = await assessSpeakingForUser(submission.id, user.id);
  redirect(`/speaking/${encodeURIComponent(promptId)}/result/${encodeURIComponent(submissionId)}${result.ok ? "" : `?ai=${aiFailureCode(result)}`}`);
}
