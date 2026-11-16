"use server";
import { aiFailureCode } from "@/lib/ai/failure";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import { assessWritingForUser } from "@/lib/writing/assess";
export async function requestAssessment(promptId: string, submissionId: string) {
  const user = await requireUser();
  const submission = await prisma.writingSubmission.findFirst({ where: { id: submissionId, userId: user.id, promptId, status: { not: "DRAFT" } }, select: { id: true } });
  if (!submission) redirect("/writing");
  const result = await assessWritingForUser(submission.id, user.id);
  redirect(`/writing/${encodeURIComponent(promptId)}/result/${encodeURIComponent(submissionId)}${result.ok ? "" : `?ai=${aiFailureCode(result)}`}`);
}
