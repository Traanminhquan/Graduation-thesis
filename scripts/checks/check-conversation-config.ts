/**
 * Offline checks for the conversation settings and spend ledger.
 * No database: the ledger runs against an in-memory fake with a real mutex.
 *
 *   npx tsx scripts/checks/check-conversation-config.ts
 */
import assert from "node:assert/strict";

import {
  chatCostUsd,
  CONVERSATION_CEILINGS,
  ConversationError,
  conversationConfig,
  MEMORY_TURNS,
  REPLY_MAX_TOKENS,
} from "../../src/lib/conversation/config";
import {
  reserveConversationSpend,
  settleConversationSpend,
  type ConversationLedger,
  type ConversationUsage,
} from "../../src/lib/conversation/ledger";

const on = {
  CONVERSATION_ENABLED: "true",
  SPEAKING_STT_ENABLED: "true",
  CONVERSATION_PRICE_INPUT_PER_MTOK_USD: "0.05",
  CONVERSATION_PRICE_OUTPUT_PER_MTOK_USD: "0.08",
} as unknown as NodeJS.ProcessEnv;
const withEnv = (extra: Record<string, string | undefined>) => ({ ...on, ...extra }) as NodeJS.ProcessEnv;

// Off unless the switch is exactly "true", and it needs speech to text.
assert.equal(conversationConfig({} as NodeJS.ProcessEnv).enabled, false);
assert.equal(conversationConfig({} as NodeJS.ProcessEnv).problem, undefined);
for (const value of ["TRUE", "1", "yes", " true"]) {
  assert.equal(conversationConfig(withEnv({ CONVERSATION_ENABLED: value })).enabled, false);
}
assert.deepEqual(
  [conversationConfig(withEnv({ SPEAKING_STT_ENABLED: "false" })).enabled, conversationConfig(withEnv({ SPEAKING_STT_ENABLED: "false" })).problem],
  [false, "SPEAKING_STT_ENABLED"],
);

// Defaults are the ceilings; blank settings mean the default.
{
  const config = conversationConfig(
    withEnv({ CONVERSATION_MAX_TURNS: "", CONVERSATION_MAX_TURN_SECONDS: "  ", CONVERSATION_DAILY_SESSIONS: undefined, CONVERSATION_BUDGET_USD: "" }),
  );
  assert.deepEqual(config, {
    enabled: true,
    turnSeconds: CONVERSATION_CEILINGS.turnSeconds,
    learnerTurns: CONVERSATION_CEILINGS.learnerTurns,
    dailySessions: CONVERSATION_CEILINGS.dailySessions,
    budgetUsd: CONVERSATION_CEILINGS.budgetUsd,
    priceInputPerMTok: 0.05,
    priceOutputPerMTok: 0.08,
  });
}
assert.deepEqual(CONVERSATION_CEILINGS, { turnSeconds: 30, learnerTurns: 12, dailySessions: 3, budgetUsd: 1 });
assert.equal(REPLY_MAX_TOKENS, 120);
assert.equal(MEMORY_TURNS, 8);

// A setting may lower a ceiling.
{
  const config = conversationConfig(
    withEnv({ CONVERSATION_MAX_TURNS: "6", CONVERSATION_MAX_TURN_SECONDS: "20", CONVERSATION_DAILY_SESSIONS: "1", CONVERSATION_BUDGET_USD: "0.25" }),
  );
  assert.deepEqual(
    [config.enabled, config.learnerTurns, config.turnSeconds, config.dailySessions, config.budgetUsd],
    [true, 6, 20, 1, 0.25],
  );
}

// It may never raise one, and a wrong value switches the feature off and names the setting.
for (const [name, value] of [
  ["CONVERSATION_MAX_TURNS", "13"],
  ["CONVERSATION_MAX_TURNS", "1"],
  ["CONVERSATION_MAX_TURNS", "6.5"],
  ["CONVERSATION_MAX_TURNS", "many"],
  ["CONVERSATION_MAX_TURN_SECONDS", "31"],
  ["CONVERSATION_MAX_TURN_SECONDS", "4"],
  ["CONVERSATION_DAILY_SESSIONS", "4"],
  ["CONVERSATION_DAILY_SESSIONS", "0"],
  ["CONVERSATION_BUDGET_USD", "1.01"],
  ["CONVERSATION_BUDGET_USD", "0"],
  ["CONVERSATION_BUDGET_USD", "-1"],
  ["CONVERSATION_PRICE_INPUT_PER_MTOK_USD", ""],
  ["CONVERSATION_PRICE_INPUT_PER_MTOK_USD", "0"],
  ["CONVERSATION_PRICE_OUTPUT_PER_MTOK_USD", "free"],
] as const) {
  const config = conversationConfig(withEnv({ [name]: value }));
  assert.deepEqual([config.enabled, config.problem], [false, name], `${name}=${value}`);
  // The problem is the setting's name, never its value.
  assert.ok(!String(config.problem).includes(value) || value === "");
}

// Chat cost at list prices.
assert.equal(chatCostUsd({ priceInputPerMTok: 0.05, priceOutputPerMTok: 0.08 }, { promptTokens: 1_000_000, completionTokens: 0 }), 0.05);
assert.ok(
  Math.abs(chatCostUsd({ priceInputPerMTok: 0.05, priceOutputPerMTok: 0.08 }, { promptTokens: 800, completionTokens: 120 }) - 0.0000496) < 1e-12,
);

/** In-memory ledger whose `exclusive` really excludes, like the advisory lock. */
function memoryLedger() {
  const rows: ConversationUsage[] = [];
  let tail: Promise<unknown> = Promise.resolve();
  let inside = 0;
  let overlapped = false;
  const ops = {
    async spend(since?: Date) {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return rows.filter((row) => !since || row.at >= since).reduce((sum, row) => sum + row.costUsd, 0);
    },
    async pending(sessionId: string, since: Date) {
      const mine = rows.filter((row) => row.sessionId === sessionId && row.at >= since);
      return mine.filter((row) => row.status === "reserved").length > mine.filter((row) => row.status !== "reserved").length;
    },
    async append(row: ConversationUsage) {
      rows.push(row);
    },
  };
  const ledger: ConversationLedger = {
    ...ops,
    exclusive(work) {
      const run = tail.then(async () => {
        inside += 1;
        if (inside > 1) overlapped = true;
        try {
          return await work(ops);
        } finally {
          inside -= 1;
        }
      });
      tail = run.catch(() => undefined);
      return run;
    },
  };
  return { ledger, rows, overlapped: () => overlapped };
}

const env = { AI_BUDGET_PERIOD: "month" } as unknown as NodeJS.ProcessEnv;
const now = new Date("2026-11-14T10:00:00Z");
const reservation = (costUsd: number, kind: "CONVERSATION" | "CONVERSATION_STT" = "CONVERSATION") => ({
  kind,
  userId: "user-1",
  sessionId: "session-1",
  costUsd,
});

async function main() {
  // A reservation that fits is written; one that does not is refused and writes nothing.
  {
    const { ledger, rows } = memoryLedger();
    await reserveConversationSpend(ledger, reservation(0.4), { budgetUsd: 1 }, env, now);
    await reserveConversationSpend(ledger, reservation(0.6, "CONVERSATION_STT"), { budgetUsd: 1 }, env, now);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => [row.kind, row.status, row.costUsd]), [
      ["CONVERSATION", "reserved", 0.4],
      ["CONVERSATION_STT", "reserved", 0.6],
    ]);
    await assert.rejects(
      reserveConversationSpend(ledger, reservation(0.0001), { budgetUsd: 1 }, env, now),
      (error: unknown) => error instanceof ConversationError && error.reason === "budget",
    );
    assert.equal(rows.length, 2);

    // Settling records the outcome and costs nothing.
    await settleConversationSpend(ledger, { ...reservation(0), status: "completed", promptTokens: 700, completionTokens: 40, model: "m" }, now);
    assert.deepEqual([rows[2].status, rows[2].costUsd, rows[2].promptTokens, rows[2].completionTokens], ["completed", 0, 700, 40]);
  }

  // A new budget month starts from zero; "lifetime" never does.
  {
    const { ledger } = memoryLedger();
    await reserveConversationSpend(ledger, reservation(1), { budgetUsd: 1 }, env, new Date("2026-10-31T23:59:59Z"));
    await reserveConversationSpend(ledger, reservation(1), { budgetUsd: 1 }, env, new Date("2026-11-01T00:00:00Z"));
    await assert.rejects(
      reserveConversationSpend(ledger, reservation(0.5), { budgetUsd: 1 }, { AI_BUDGET_PERIOD: "lifetime" } as unknown as NodeJS.ProcessEnv, now),
    );
  }

  // A nonsense estimate is a configuration error, not a free call.
  {
    const { ledger, rows } = memoryLedger();
    for (const bad of [Number.NaN, -0.01, Number.POSITIVE_INFINITY]) {
      await assert.rejects(
        reserveConversationSpend(ledger, reservation(bad), { budgetUsd: 1 }, env, now),
        (error: unknown) => error instanceof ConversationError && error.reason === "configuration",
      );
    }
    assert.equal(rows.length, 0);
  }

  // Twenty simultaneous reservations against a budget for five: exactly five get through.
  {
    const { ledger, rows, overlapped } = memoryLedger();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => reserveConversationSpend(ledger, reservation(0.2), { budgetUsd: 1 }, env, now)),
    );
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 5);
    assert.equal(rows.length, 5);
    assert.equal(overlapped(), false);
  }

  // The in-flight guard: a second call for the same conversation waits for the first to settle.
  {
    const { ledger, rows } = memoryLedger();
    const guard = { sessionId: "session-1", windowMs: 90_000 };
    await reserveConversationSpend(ledger, reservation(0.01), { budgetUsd: 1 }, env, now, guard);
    await assert.rejects(
      reserveConversationSpend(ledger, reservation(0.01), { budgetUsd: 1 }, env, now, guard),
      (error: unknown) => error instanceof ConversationError && error.reason === "busy",
    );
    // Another conversation is not blocked.
    await reserveConversationSpend(ledger, { ...reservation(0.01), sessionId: "session-2" }, { budgetUsd: 1 }, env, now, { ...guard, sessionId: "session-2" });
    // Settling releases it.
    await settleConversationSpend(ledger, { ...reservation(0), status: "failed" }, now);
    await reserveConversationSpend(ledger, reservation(0.01), { budgetUsd: 1 }, env, now, guard);
    // A reservation older than the window no longer blocks.
    await reserveConversationSpend(ledger, reservation(0.01), { budgetUsd: 1 }, env, new Date(now.getTime() + 90_001), guard);
    assert.equal(rows.filter((row) => row.status === "reserved").length, 4);
  }

  console.log("PASS conversation settings and ledger: switch, ceilings, prices, reservation, budget period, concurrency (offline)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
