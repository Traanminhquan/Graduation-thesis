import { diagnose, formatDiagnosis } from "../../src/lib/ai/diagnostics";
import { integrationConfig } from "../../src/lib/ai/integration-guard";
import { assertFreeResponse, MAX_TOKENS, openRouterProvider, timedCall } from "../../src/lib/ai/provider";
import { validateAssessment } from "../../src/lib/ai/schema";
import { buildMessages } from "../../src/lib/writing/prompt";

async function run() {
  const { model, timeout } = integrationConfig(process.env, process.argv.slice(2));
  const finalText = "Last Saturday I visited an imaginary village with my friend Mira. We walked beside a quiet river and watched small boats carry baskets of apples. At noon, a baker invited us to taste warm bread in her garden. I asked how she learned to bake, and she told us about her grandmother. Before leaving, we helped water the flowers near the gate. The visit reminded me that simple conversations can make an ordinary day memorable. I hope to return next spring.";
  const messages = buildMessages({ finalText, prompt: { promptText: "Describe a memorable visit.", minWords: 70, maxWords: 100 } });
  const result = await timedCall(openRouterProvider(process.env), { model, messages, max_tokens: MAX_TOKENS }, timeout);
  console.log(JSON.stringify({ modelRequested: model, modelServed: result.model ?? null, promptTokens: result.promptTokens, completionTokens: result.completionTokens, providerCostUsd: result.costUsd ?? null, requestId: result.requestId ?? null }));
  assertFreeResponse(result);
  const value = validateAssessment(result.text, finalText);
  console.log(JSON.stringify({ grammarScore: value.grammarScore, vocabularyScore: value.vocabularyScore, coherenceScore: value.coherenceScore, taskAchievementScore: value.taskAchievementScore, overallScore: value.overallScore, corrections: value.corrections.length, suggestions: value.suggestions.length }));
  // Defense in depth: never echo the configured credential, even if a provider echoes it.
  console.log(result.text.split(process.env.AI_API_KEY!).join("[REDACTED]"));
  console.log("PASS");
}
// Sanitized diagnosis only: category, HTTP status, safe request id and fixed detail strings; never keys, headers, bodies, learner text or raw provider messages.
run().catch(error => { console.error(formatDiagnosis(diagnose(error))); process.exitCode = 1; });
