import type { ChatStreamEvent, ChatStreamInput } from "../ai/chat-stream";
import { ProviderError } from "../ai/provider";
import type { AudioInfo } from "../speaking/stt/audio";
import { STT_DURATION_TOLERANCE_SECONDS, SttError, sttConfig } from "../speaking/stt/config";

import {
  chatCostUsd,
  ConversationError,
  conversationConfig,
  REPLY_MAX_TOKENS,
  type ConversationReason,
} from "./config";
import {
  reserveConversationSpend,
  settleConversationSpend,
  type ConversationLedger,
} from "./ledger";
import { buildMessages, cleanReply, type PromptTurn } from "./prompt";
import { getScenario } from "./scenarios";

/**
 * One learner turn of a conversation, from recording to the partner's reply.
 *
 * Order matters, because the pooled database connection serves one query at a
 * time and two requests for the same conversation can arrive together:
 * 1. load the conversation (owner-scoped) and decide what this request may do;
 * 2. reserve the speech cost under the ledger lock, which also refuses a second
 *    request while one is in flight for this conversation;
 * 3. transcribe, store the learner turn (the unique index on (session, index)
 *    is the last guard), then settle;
 * 4. reserve the chat cost the same way, stream the reply, store it, settle.
 * A failure after step 3 keeps the learner turn; calling again without audio
 * produces the missing reply (the retry path).
 */

export type TurnEvent =
  | { type: "transcript"; index: number; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; index: number; text: string; learnerTurns: number; finished: boolean }
  | { type: "error"; reason: ConversationReason };

export type TurnInput = {
  userId: string;
  sessionId: string;
  /** The learner's recording, or null to retry a missing reply. */
  audio: Uint8Array | null;
  /** Duration the browser measured, checked against the audio itself. */
  durationHint?: unknown;
};

type SessionRow = {
  id: string;
  status: "ACTIVE" | "ENDED" | "ABANDONED";
  scenarioId: string;
  turnCount: number;
  turns: PromptTurn[];
};

/** The database operations this module needs; Prisma satisfies it. */
export type TurnDb = {
  conversationSession: {
    findFirst(args: unknown): Promise<SessionRow | null>;
  };
  $transaction<T>(work: (tx: TurnTx) => Promise<T>): Promise<T>;
};
export type TurnTx = {
  conversationTurn: { create(args: unknown): Promise<unknown> };
  conversationSession: { updateMany(args: unknown): Promise<{ count: number }> };
};

export type TurnDeps = {
  env: NodeJS.ProcessEnv;
  db: TurnDb;
  ledger: ConversationLedger;
  inspect: (bytes: Uint8Array) => AudioInfo;
  transcribe: (bytes: Uint8Array, info: AudioInfo) => Promise<string>;
  chat: (input: ChatStreamInput, signal?: AbortSignal) => AsyncIterable<ChatStreamEvent>;
  signal?: AbortSignal;
  now?: () => Date;
};

/** How long an unsettled reservation blocks the next turn of the same conversation. */
export const IN_FLIGHT_WINDOW_MS = 90_000;
const ESTIMATED_CHARS_PER_TOKEN = 3;

const sttReason = (error: unknown): ConversationReason => {
  if (!(error instanceof SttError)) return "speech_unavailable";
  if (error.reason === "no_speech") return "no_speech";
  if (error.reason === "rate_limited") return "rate_limited";
  if (error.reason === "timeout") return "timeout";
  if (error.reason === "invalid_audio" || error.reason === "too_large") return "invalid_audio";
  if (error.reason === "invalid_duration" || error.reason === "duration_unverifiable") return "invalid_duration";
  return "speech_unavailable";
};

const chatReason = (error: unknown): ConversationReason => {
  if (error instanceof ProviderError) {
    if (error.details.category === "rate_limited") return "rate_limited";
    if (error.details.category === "network_timeout") return "timeout";
  }
  return "reply_unavailable";
};

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

export async function* runTurn(input: TurnInput, deps: TurnDeps): AsyncGenerator<TurnEvent> {
  const now = deps.now ?? (() => new Date());
  try {
    const config = conversationConfig(deps.env);
    if (!config.enabled) throw new ConversationError("disabled");
    if (!input.userId) throw new ConversationError("unauthenticated");

    const session = await deps.db.conversationSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
      select: {
        id: true,
        status: true,
        scenarioId: true,
        turnCount: true,
        turns: { orderBy: { index: "asc" }, select: { index: true, role: true, text: true } },
      },
    });
    if (!session) throw new ConversationError("not_found");
    const scenario = getScenario(session.scenarioId);
    if (!scenario) throw new ConversationError("not_found");
    if (session.status !== "ACTIVE") throw new ConversationError("finished");

    const turns = [...session.turns];
    const last = turns.at(-1);
    let learnerTurns = session.turnCount;

    if (!last || last.role === "PARTNER") {
      // A new learner turn: audio is required and must fit the limits.
      if (!input.audio) throw new ConversationError("invalid_audio");
      if (learnerTurns >= config.learnerTurns) throw new ConversationError("turn_limit");

      const stt = sttConfig(deps.env);
      if (input.audio.length > stt.maxBytes) throw new ConversationError("invalid_audio");
      let info: AudioInfo;
      try {
        info = deps.inspect(input.audio);
      } catch (error) {
        throw new ConversationError(sttReason(error));
      }
      const hint = input.durationHint;
      const limitMs = (config.turnSeconds + STT_DURATION_TOLERANCE_SECONDS) * 1000;
      if (
        info.durationMs < 1000 ||
        info.durationMs > limitMs ||
        (hint !== null && hint !== undefined && hint !== "" && (!Number.isFinite(Number(hint)) || Math.abs(Number(hint) - info.durationMs) > 2000))
      ) {
        throw new ConversationError("invalid_duration");
      }

      const seconds = info.durationMs / 1000;
      const sttCost = (Math.max(seconds, stt.minBilled) * stt.price) / 3600;
      await reserveConversationSpend(
        deps.ledger,
        { kind: "CONVERSATION_STT", userId: input.userId, sessionId: session.id, costUsd: sttCost, audioSeconds: seconds },
        config,
        deps.env,
        now(),
        { sessionId: session.id, windowMs: IN_FLIGHT_WINDOW_MS },
      );

      const settleStt = (status: "completed" | "failed") =>
        settleConversationSpend(
          deps.ledger,
          { kind: "CONVERSATION_STT", status, userId: input.userId, sessionId: session.id, audioSeconds: seconds },
          now(),
        );

      let transcript: string;
      try {
        transcript = (await deps.transcribe(input.audio, info)).replace(/\s+/g, " ").trim();
        if (transcript.length < 2) throw new SttError("no_speech");
      } catch (error) {
        await settleStt("failed");
        throw new ConversationError(sttReason(error));
      }

      const index = (last?.index ?? -1) + 1;
      try {
        await deps.db.$transaction(async (tx) => {
          await tx.conversationTurn.create({
            data: { sessionId: session.id, index, role: "LEARNER", text: transcript, audioDurationMs: info.durationMs },
            select: { id: true },
          });
          const claimed = await tx.conversationSession.updateMany({
            where: { id: session.id, userId: input.userId, status: "ACTIVE", turnCount: learnerTurns },
            data: { turnCount: learnerTurns + 1 },
          });
          if (claimed.count !== 1) throw new ConversationError("busy");
        });
      } catch (error) {
        await settleStt("failed");
        if (error instanceof ConversationError || isUniqueViolation(error)) throw new ConversationError("busy");
        throw error;
      }
      await settleStt("completed");

      learnerTurns += 1;
      turns.push({ index, role: "LEARNER", text: transcript });
      yield { type: "transcript", index, text: transcript };
    } else if (input.audio) {
      // The previous learner turn still has no reply: that has to come first.
      throw new ConversationError("busy");
    }

    // The partner's reply to the latest learner turn.
    const learnerTurn = turns.at(-1)!;
    const finalReply = learnerTurns >= config.learnerTurns;
    const messages = buildMessages(scenario, turns, finalReply);
    const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    const estimate = chatCostUsd(config, {
      promptTokens: Math.ceil(promptChars / ESTIMATED_CHARS_PER_TOKEN),
      completionTokens: REPLY_MAX_TOKENS,
    });
    await reserveConversationSpend(
      deps.ledger,
      { kind: "CONVERSATION", userId: input.userId, sessionId: session.id, costUsd: estimate },
      config,
      deps.env,
      now(),
      { sessionId: session.id, windowMs: IN_FLIGHT_WINDOW_MS },
    );

    let raw = "";
    let usage = { promptTokens: 0, completionTokens: 0 };
    let model: string | undefined;
    try {
      for await (const event of deps.chat({ messages, maxTokens: REPLY_MAX_TOKENS, temperature: 0.7 }, deps.signal)) {
        if (event.type === "delta") {
          raw += event.text;
          yield { type: "delta", text: event.text };
        } else {
          usage = event.usage;
          model = event.model;
        }
      }
    } catch (error) {
      await settleConversationSpend(deps.ledger, { kind: "CONVERSATION", status: "failed", userId: input.userId, sessionId: session.id }, now());
      throw new ConversationError(chatReason(error));
    }

    const reply = cleanReply(raw);
    const index = learnerTurn.index + 1;
    try {
      if (!reply) throw new ConversationError("reply_unavailable");
      await deps.db.$transaction(async (tx) => {
        await tx.conversationTurn.create({
          data: { sessionId: session.id, index, role: "PARTNER", text: reply },
          select: { id: true },
        });
        if (finalReply) {
          await tx.conversationSession.updateMany({
            where: { id: session.id, userId: input.userId, status: "ACTIVE" },
            data: { status: "ENDED", endedAt: now() },
          });
        }
      });
    } catch (error) {
      await settleConversationSpend(deps.ledger, { kind: "CONVERSATION", status: "failed", userId: input.userId, sessionId: session.id }, now());
      if (error instanceof ConversationError) throw error;
      throw new ConversationError(isUniqueViolation(error) ? "busy" : "reply_unavailable");
    }
    await settleConversationSpend(
      deps.ledger,
      {
        kind: "CONVERSATION",
        status: "completed",
        userId: input.userId,
        sessionId: session.id,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        model,
      },
      now(),
    );

    yield { type: "done", index, text: reply, learnerTurns, finished: finalReply };
  } catch (error) {
    yield { type: "error", reason: error instanceof ConversationError ? error.reason : "reply_unavailable" };
  }
}
