/**
 * Conversation with AI: the switch, the limits and the prices in one place.
 *
 * The ceilings are part of the design.
 * A setting may only lower a ceiling; a blank setting means the default; an
 * invalid setting switches the feature off instead of guessing.
 */

export const CONVERSATION_CEILINGS = {
  /** Longest learner turn, in seconds. */
  turnSeconds: 30,
  /** Learner turns in one conversation. */
  learnerTurns: 12,
  /** Conversations a learner may start per UTC day. */
  dailySessions: 3,
  /** Spend cap in USD per budget period, for chat and speech together. */
  budgetUsd: 1,
} as const;

/** Not configurable: they shape the prompt, so they are fixed with it. */
export const REPLY_MAX_TOKENS = 120;
export const MEMORY_TURNS = 8;

export type ConversationReason =
  | "disabled"
  | "configuration"
  | "unauthenticated"
  | "origin"
  | "not_found"
  | "finished"
  | "turn_limit"
  | "daily_limit"
  | "busy"
  | "budget"
  | "invalid_audio"
  | "invalid_duration"
  | "no_speech"
  | "speech_unavailable"
  | "rate_limited"
  | "reply_unavailable"
  | "timeout";

export class ConversationError extends Error {
  constructor(public readonly reason: ConversationReason) {
    super(reason);
  }
}

export type ConversationConfig = {
  enabled: boolean;
  /** Name of the first setting that is wrong, for the server log. Never a value. */
  problem?: string;
  turnSeconds: number;
  learnerTurns: number;
  dailySessions: number;
  budgetUsd: number;
  /** List prices in USD per million tokens, used by the spend ledger. */
  priceInputPerMTok: number;
  priceOutputPerMTok: number;
};

const blank = (value: string | undefined) => value === undefined || value.trim() === "";

/** Never throws: a broken configuration reads as "off", with the reason named. */
export function conversationConfig(env: NodeJS.ProcessEnv): ConversationConfig {
  const off = (problem?: string): ConversationConfig => ({
    enabled: false,
    problem,
    turnSeconds: CONVERSATION_CEILINGS.turnSeconds,
    learnerTurns: CONVERSATION_CEILINGS.learnerTurns,
    dailySessions: CONVERSATION_CEILINGS.dailySessions,
    budgetUsd: CONVERSATION_CEILINGS.budgetUsd,
    priceInputPerMTok: 0,
    priceOutputPerMTok: 0,
  });

  if (env.CONVERSATION_ENABLED !== "true") return off();
  // A conversation turn is a recording that is transcribed first.
  if (env.SPEAKING_STT_ENABLED !== "true") return off("SPEAKING_STT_ENABLED");

  let problem: string | undefined;
  const lower = (name: string, ceiling: number, floor: number, integer: boolean) => {
    if (blank(env[name])) return ceiling;
    const value = Number(env[name]);
    if (!Number.isFinite(value) || value < floor || value > ceiling || (integer && !Number.isInteger(value))) {
      problem ??= name;
      return ceiling;
    }
    return value;
  };
  const price = (name: string) => {
    const value = Number(env[name]);
    if (blank(env[name]) || !Number.isFinite(value) || value <= 0) {
      problem ??= name;
      return 0;
    }
    return value;
  };

  const config: ConversationConfig = {
    enabled: true,
    turnSeconds: lower("CONVERSATION_MAX_TURN_SECONDS", CONVERSATION_CEILINGS.turnSeconds, 5, true),
    learnerTurns: lower("CONVERSATION_MAX_TURNS", CONVERSATION_CEILINGS.learnerTurns, 2, true),
    dailySessions: lower("CONVERSATION_DAILY_SESSIONS", CONVERSATION_CEILINGS.dailySessions, 1, true),
    budgetUsd: lower("CONVERSATION_BUDGET_USD", CONVERSATION_CEILINGS.budgetUsd, 0.01, false),
    priceInputPerMTok: price("CONVERSATION_PRICE_INPUT_PER_MTOK_USD"),
    priceOutputPerMTok: price("CONVERSATION_PRICE_OUTPUT_PER_MTOK_USD"),
  };
  return problem ? off(problem) : config;
}

/** Cost of one chat call at the configured list prices. */
export function chatCostUsd(
  config: Pick<ConversationConfig, "priceInputPerMTok" | "priceOutputPerMTok">,
  usage: { promptTokens: number; completionTokens: number },
): number {
  return (
    (usage.promptTokens * config.priceInputPerMTok + usage.completionTokens * config.priceOutputPerMTok) /
    1_000_000
  );
}
