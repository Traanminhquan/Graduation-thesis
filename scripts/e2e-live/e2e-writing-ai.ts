/**
 * LIVE Writing AI E2E runner (one real OpenRouter Free request). Real wiring only; never import this in offline checks.
 *   AI_ASSESSMENT_ENABLED=true AI_PROVIDER=openrouter AI_MODEL=google/gemma-4-26b-a4b-it:free AI_FREE_TEST_MODE=true \
 *   AI_MAX_ATTEMPTS=1 AI_TIMEOUT_MS=60000 node --env-file=.env --import tsx scripts/e2e-live/e2e-writing-ai.ts --confirm-e2e
 * The deterministic no-network variant is scripts/e2e-writing-ai-mock.ts.
 */
import { runE2E } from "./e2e-writing-ai-core";
import { createRealDeps, prisma } from "./e2e-writing-ai-real";

runE2E(createRealDeps({ args: process.argv.slice(2) }))
  .then(result => { process.exitCode = result.exitCode; })
  .catch(() => { console.error("FAIL e2e crashed: unexpected error"); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
