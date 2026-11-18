import { budgetedCall, isUniqueViolation } from "../ai/budgeted-call";
import type { PrismaClient } from "@prisma/client";
import { validateAssessment } from "../ai/schema";
import { providerConfig, providerFromEnv, MAX_TOKENS, type Provider } from "../ai/provider";
import { AssessmentFailure, classifyAssessmentFailure, formatAssessmentDiagnosis, sanitizeAssessmentDiagnosis, type AssessmentDiagnosis } from "../ai/diagnostics";
import { dbLedger, prices, type Ledger } from "../ai/cost";
import { buildMessages, MAX_CORRECTIONS } from "./prompt";
import { MAX_WRITING_CHARACTERS } from "./validation";
export const DAILY_ASSESSMENT_CAP = 5;
export type AssessmentDeps = { db: PrismaClient; provider: Provider; ledger: Ledger; env: NodeJS.ProcessEnv; now: () => Date };
export async function assessWritingForUser(submissionId: string, userId: string, injected?: AssessmentDeps): Promise<{ ok: boolean; message?: string; diagnosis?: AssessmentDiagnosis }> {
  const env = injected?.env ?? process.env;
  // Sanitized progress record: fixed enums, counts and validated ids only (never text, keys, payloads or raw output).
  const diag: AssessmentDiagnosis = { category: "unexpected_error", jsonParse: "skipped", schemaValidation: "skipped", persistence: "not_attempted" };
  if (env.AI_ASSESSMENT_ENABLED !== "true") return { ok: false, message: "AI assessment is disabled", diagnosis: { ...diag, category: "request_refused" } };
  try {
    const { model, freeTest } = providerConfig(env);
    const prisma = injected ? injected.db : (await import("../db")).prisma;
    const deps = injected ?? { db: prisma, provider: providerFromEnv(env), ledger: dbLedger(prisma), env, now: () => new Date() };
    const { db, provider, ledger, now } = deps;
    const submission = await db.writingSubmission.findFirst({ where: { id: submissionId, userId }, include: { prompt: true, assessment: true } });
    if (!submission) throw new Error("Submission unavailable");
    if (submission.assessment) return { ok: true };
    if (submission.status !== "SUBMITTED" || !submission.finalText || submission.finalText.length > MAX_WRITING_CHARACTERS) throw new Error("Invalid submitted text");
    const day = new Date(now()); day.setUTCHours(0, 0, 0, 0);
    const daily = await db.writingAssessment.count({ where: { submission: { userId }, assessedAt: { gte: day } } });
    if (daily >= DAILY_ASSESSMENT_CAP) throw new Error("Daily AI assessment limit reached");
    if (!env.AI_API_KEY) throw new Error("AI provider not configured");
    const price = prices(env);
    const budget = Number(env.AI_PILOT_BUDGET_USD ?? "2");
    if (!Number.isFinite(budget) || budget < 0) throw new Error("Invalid AI pilot budget");
    const messages = buildMessages({ finalText: submission.finalText, prompt: submission.prompt });
    // UTF-8 bytes plus generous framing overhead is a conservative token upper bound.
    const inputBound = Buffer.byteLength(JSON.stringify(messages), "utf8") + 1024;
    const estimate = (inputBound * price.input + MAX_TOKENS * price.output) / 1e6;
    const timeout = Number(env.AI_TIMEOUT_MS ?? "20000");
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120000) throw new Error("Invalid AI timeout");
    // Default 2 keeps the single retry on timeout/5xx; 1 allows exactly one provider attempt. Validated before any reservation.
    const maxAttempts = Number(env.AI_MAX_ATTEMPTS ?? "2");
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 2) throw new Error("Invalid AI max attempts");
    const output = await budgetedCall({ ledger, provider, env, now, submissionId, userId,
      model, freeTest, messages, inputBound, estimate, timeout, maxAttempts, budget, price,
      onOutput: output => Object.assign(diag, sanitizeAssessmentDiagnosis({ ...diag, servedModel: output.model, finishReason: output.finishReason, promptTokens: output.promptTokens, completionTokens: output.completionTokens, reasoningTokens: output.reasoningTokens, requestId: output.requestId })) });
    // A completion cut off by max_tokens is never parsed or saved.
    if (output.finishReason === "length") throw new AssessmentFailure("completion_truncated");
    if (!output.text.trim()) throw new AssessmentFailure("empty_model_output");
    let validated: ReturnType<typeof validateAssessment>;
    try { validated = validateAssessment(output.text, submission.finalText); diag.jsonParse = "ok"; diag.schemaValidation = "ok"; }
    catch (error) {
      if (error instanceof SyntaxError) { diag.jsonParse = "failed"; const capped = output.completionTokens >= MAX_TOKENS; throw new AssessmentFailure(capped ? "completion_truncated" : "invalid_json", capped ? "at_token_cap" : undefined); }
      diag.jsonParse = "ok"; diag.schemaValidation = "failed"; throw new AssessmentFailure("schema_validation_failed", error instanceof Error ? error.message : undefined);
    }
    // The prompt asks for at most MAX_CORRECTIONS; keep that bound even if the model sends more.
    const assessment = { ...validated, corrections: validated.corrections.slice(0, MAX_CORRECTIONS), summary: validated.summary.trim() };
    // Safe to run twice: the transaction changes nothing once the assessment exists.
    const persist = () => db.$transaction(async tx => {
      if (await tx.writingAssessment.findUnique({ where: { submissionId } })) return;
      await tx.writingAssessment.create({ data: { submissionId, ...assessment, model } });
      for (const correction of assessment.corrections) {
        await tx.weaknessRecord.upsert({ where: { userId_skill_category: { userId, skill: "WRITING", category: correction.errorType } }, create: { userId, skill: "WRITING", category: correction.errorType }, update: { occurrenceCount: { increment: 1 }, lastSeenAt: now() } });
      }
      await tx.writingSubmission.update({ where: { id: submissionId }, data: { status: "ASSESSED" } });
    });
    try {
      // P2002: a concurrent request saved this assessment, or two assessments of one learner
      // collided on a weakness row. One retry settles both; a third outcome is a real failure.
      try { await persist(); } catch (error) { if (!isUniqueViolation(error)) throw error; await persist(); }
      diag.persistence = "saved";
    } catch { diag.persistence = "failed"; throw new AssessmentFailure("persistence_failed"); }
    return { ok: true };
  } catch (error) {
    const diagnosis = sanitizeAssessmentDiagnosis(classifyAssessmentFailure(error, diag));
    // Opt-in, sanitized single line (category, counts, status, safe ids only).
    if (env.AI_DIAGNOSTICS_LOG === "true") console.warn(formatAssessmentDiagnosis(diagnosis));
    const safe = ["Unsupported AI provider", "AI free test requires openrouter, AI_FREE_TEST_MODE=true and an allowlisted model", "AI free test response violated free-only policy", "AI pricing unavailable: configure both per-million-token prices", "AI pilot budget exceeded", "Daily AI assessment limit reached", "Invalid AI pilot budget", "Invalid AI timeout", "Invalid AI max attempts", "Invalid AI budget period", "AI assessment already in progress"];
    return { ok: false, message: error instanceof Error && safe.includes(error.message) ? error.message : "AI feedback unavailable, try again", diagnosis };
  }
}
