import { providerConfig, FREE_MODEL_ALLOWLIST } from "./provider";

/** Thrown when local prerequisites are missing. `problems` holds fixed condition names only, never env values. */
export class IntegrationConfigError extends Error {
  constructor(public problems: string[]) { super("Free integration prerequisites missing"); }
}

// Pure guard, shared with mocked tests; no IO or application dependencies.
export function integrationProblems(env: NodeJS.ProcessEnv, args: readonly string[]): string[] {
  const problems: string[] = [];
  if (env.AI_PROVIDER !== "openrouter") problems.push("AI_PROVIDER must be exactly openrouter");
  if (env.AI_FREE_TEST_MODE !== "true") problems.push("AI_FREE_TEST_MODE must be exactly true");
  if (!env.AI_MODEL || !FREE_MODEL_ALLOWLIST.includes(env.AI_MODEL)) problems.push("AI_MODEL must be set to an allowlisted free model");
  if (!env.AI_API_KEY?.trim()) problems.push("AI_API_KEY is missing or empty");
  if (!args.includes("--confirm-free-request")) problems.push("--confirm-free-request flag is missing");
  return problems;
}

export function integrationConfig(env: NodeJS.ProcessEnv, args: readonly string[]) {
  const problems = integrationProblems(env, args);
  if (problems.length > 0) throw new IntegrationConfigError(problems);
  const config = providerConfig(env);
  const timeout = Number(env.AI_TIMEOUT_MS ?? "20000");
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 120000) throw new Error("Invalid AI timeout");
  return { model: config.model, timeout };
}
