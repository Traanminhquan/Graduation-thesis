import { checkSameOrigin } from "../http/same-origin";
import { conversationConfig } from "./config";
import type { HintResult } from "./hint";

export type HintHandlerDeps = {
  session: () => Promise<{ id: string } | null>;
  run: (input: { userId: string; sessionId: string }, signal: AbortSignal) => Promise<HintResult>;
  env?: NodeJS.ProcessEnv;
};
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (reason: string, status: number) => json({ ok: false, reason }, status);

export async function handleHintRequest(request: Request, deps: HintHandlerDeps): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!checkSameOrigin(request, env)) return fail("origin", 403);
  if (!conversationConfig(env).enabled) return fail("disabled", 503);
  try {
    const user = await deps.session();
    if (!user) return fail("unauthenticated", 401);
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 2048)) return fail("not_found", 413);
    const reader = request.body?.getReader();
    if (!reader) return fail("not_found", 404);
    let total = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 2048 || chunks.length >= 2048) { await reader.cancel(); return fail("not_found", 413); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = await new Response(new Blob(chunks as BlobPart[])).json(); } catch { return fail("not_found", 404); }
    const sessionId = (body as { sessionId?: unknown } | null)?.sessionId;
    if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 200) return fail("not_found", 404);
    const result = await deps.run({ userId: user.id, sessionId }, request.signal);
    if (result.ok) return json(result, 200);
    const statuses: Record<string, number> = { origin: 403, disabled: 503, unauthenticated: 401, not_found: 404, busy: 409, finished: 409, turn_limit: 409, rate_limited: 429, budget: 429 };
    return json(result, statuses[result.reason] ?? 502);
  } catch { return fail("reply_unavailable", 502); }
}
