import { budgetPeriodStart, type Ledger } from "./cost";
import {
  assertFreeResponse, MAX_TOKENS, ProviderError, timedCall,
  type Provider, type ProviderInput, type ProviderResult,
} from "./provider";

type Options = {
  ledger: Ledger;
  provider: Provider;
  env: NodeJS.ProcessEnv;
  now: () => Date;
  submissionId: string;
  userId: string;
  model: string;
  freeTest: boolean;
  messages: ProviderInput["messages"];
  inputBound: number;
  estimate: number;
  timeout: number;
  maxAttempts: number;
  budget: number;
  price: { input: number; output: number };
  onOutput: (output: ProviderResult) => void;
};

/** Prisma unique-constraint error, detected structurally so fakes and real clients both match. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function budgetedCall(options: Options): Promise<ProviderResult> {
  const { ledger, provider, env, now, submissionId, userId, model, freeTest,
    messages, inputBound, estimate, timeout, maxAttempts, budget, price, onOutput } = options;
  // Reject configuration before any reservation, including on an empty ledger.
  budgetPeriodStart(env, now());
  const pendingWindowMs = timeout + 30_000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const instant = now();
    const base = { ts: instant.toISOString(), submissionId, userId, model };
    await ledger.exclusive(async ops => {
      if (await ops.pending(submissionId, new Date(instant.getTime() - pendingWindowMs))) {
        throw new Error("AI assessment already in progress");
      }
      if (await ops.spend(budgetPeriodStart(env, instant)) + estimate > budget) {
        throw new Error("AI pilot budget exceeded");
      }
      await ops.append({ ...base, promptTokens: 0, completionTokens: 0,
        costUsd: estimate, status: "reserved" });
    });
    let settled = false;
    try {
      // Slow provider work must never occupy the budget transaction or its lock.
      const output = await timedCall(provider, { model, messages, max_tokens: MAX_TOKENS }, timeout);
      onOutput(output);
      if (!Number.isSafeInteger(output.promptTokens) || output.promptTokens < 0 ||
          output.promptTokens > inputBound || !Number.isSafeInteger(output.completionTokens) ||
          output.completionTokens < 0 || output.completionTokens > MAX_TOKENS) {
        throw new Error("Invalid AI usage");
      }
      const cost = freeTest ? (output.costUsd ?? 0) :
        (output.promptTokens * price.input + output.completionTokens * price.output) / 1e6;
      await ledger.append({ ...base, promptTokens: output.promptTokens,
        completionTokens: output.completionTokens, costUsd: cost - estimate, status: "reconciled" });
      settled = true;
      if (freeTest) assertFreeResponse(output, model);
      return output;
    } catch (error) {
      // Keep unknown usage charged, but release the submission for subsequent attempts.
      if (!settled) {
        await ledger.append({ ...base, promptTokens: 0, completionTokens: 0,
          costUsd: 0, status: "failed" });
      }
      if (attempt < maxAttempts - 1 && error instanceof ProviderError && error.retryable) continue;
      throw error;
    }
  }
  throw new Error("AI unavailable");
}
