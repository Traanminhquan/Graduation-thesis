import type { PrismaClient } from "@prisma/client";

import { checkSameOrigin } from "../speaking/stt/http";

import { conversationConfig } from "./config";
import type { TurnDeps, TurnEvent, TurnInput } from "./turn";

/**
 * HTTP shell around `runTurn`: checks, multipart parsing with a hard size cap,
 * and a response of newline-delimited JSON events that the browser reads as
 * they arrive. Dependencies are injected so the guards can be tested offline.
 */

const MAX_BODY_BYTES = 10 * 1024 * 1024 + 65_536;
const encoder = new TextEncoder();

export type TurnHandlerDeps = {
  session: () => Promise<{ id: string } | null>;
  run: (input: TurnInput, signal: AbortSignal) => AsyncGenerator<TurnEvent>;
  env?: NodeJS.ProcessEnv;
};

const fail = (reason: string, status: number) =>
  Response.json({ type: "error", reason }, { status, headers: { "Cache-Control": "no-store" } });

export async function handleTurnRequest(request: Request, deps: TurnHandlerDeps): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!checkSameOrigin(request, env)) return fail("origin", 403);
  if (!conversationConfig(env).enabled) return fail("disabled", 503);

  let input: TurnInput;
  try {
    const user = await deps.session();
    if (!user) return fail("unauthenticated", 401);

    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return fail("invalid_audio", 413);
    const reader = request.body?.getReader();
    if (!reader) return fail("invalid_audio", 400);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES || chunks.length >= 20_000) {
        await reader.cancel();
        return fail("invalid_audio", 413);
      }
      chunks.push(value);
    }
    const form = await new Response(new Blob(chunks as BlobPart[]), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();

    const sessionId = form.get("sessionId");
    if (typeof sessionId !== "string" || !sessionId || sessionId.length > 200) return fail("not_found", 404);
    const audio = form.get("audio");
    if (audio !== null && !(audio instanceof Blob)) return fail("invalid_audio", 400);
    input = {
      userId: user.id,
      sessionId,
      audio: audio ? new Uint8Array(await audio.arrayBuffer()) : null,
      durationHint: form.get("durationMs"),
    };
  } catch {
    return fail("invalid_audio", 400);
  }

  const events = deps.run(input, request.signal);
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", reason: "reply_unavailable" })}\n`));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      // Ask proxies not to buffer, so each event reaches the browser as it is written.
      "X-Accel-Buffering": "no",
    },
  });
}

/** The real dependencies, imported lazily so the module graph stays light for tests. */
export async function productionTurnDeps(signal: AbortSignal): Promise<TurnDeps> {
  const env = process.env;
  const { prisma } = await import("@/lib/db");
  const { inspectAudio } = await import("../speaking/stt/audio");
  const { transcribeGroq } = await import("../speaking/stt/groq");
  const { streamChat } = await import("../ai/chat-stream");
  const { dbConversationLedger } = await import("./ledger");
  return {
    env,
    db: prisma as unknown as TurnDeps["db"],
    ledger: dbConversationLedger(prisma as PrismaClient),
    inspect: inspectAudio,
    transcribe: (bytes, info) => transcribeGroq(bytes, info, env),
    chat: (input, chatSignal) => streamChat(input, { env, signal: chatSignal }),
    signal,
  };
}
