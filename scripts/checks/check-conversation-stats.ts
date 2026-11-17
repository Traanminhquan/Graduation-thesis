import assert from "node:assert/strict";

import { getConversationStats, summariseConversations } from "../../src/lib/progress/conversation-stats";
import { RECENT_ATTEMPT_LIMIT } from "../../src/lib/progress/stats";

const row = (day: number, overallScore: number | null) => ({
  id: `session-${day}`,
  scenarioId: "cafe",
  startedAt: new Date(Date.UTC(2026, 10, day, 10)),
  endedAt: new Date(Date.UTC(2026, 10, day, 11)),
  overallScore,
});

async function main() {
  const empty = {
    attemptCount: 0,
    scoredAttemptCount: 0,
    averagePercentage: null,
    bestPercentage: null,
    trend: [],
  };
  assert.deepEqual(summariseConversations([]), empty);
  assert.deepEqual(summariseConversations([row(1, null)]), { ...empty, attemptCount: 1 });

  const stats = summariseConversations([row(3, 50), row(1, 72.4), row(2, 88.6)]);
  assert.equal(stats.attemptCount, 3);
  assert.equal(stats.scoredAttemptCount, 3);
  assert.equal(stats.averagePercentage, 70); // round((72 + 89 + 50) / 3)
  assert.equal(stats.bestPercentage, 89);
  assert.deepEqual(stats.trend.map((point) => point.id), ["session-1", "session-2", "session-3"]);
  // Distinguish averaging rounded scores from rounding the raw mean.
  assert.equal(summariseConversations([row(1, 72.4), row(2, 72.4), row(3, 73.4)]).averagePercentage, 72);

  const many = Array.from({ length: RECENT_ATTEMPT_LIMIT + 4 }, (_, index) => row(index + 1, 80));
  const capped = summariseConversations([...many, row(20, null)]);
  assert.equal(capped.attemptCount, many.length + 1);
  assert.equal(capped.trend.length, RECENT_ATTEMPT_LIMIT);
  assert.deepEqual(capped.trend.map((point) => point.id), many.slice(-RECENT_ATTEMPT_LIMIT).map((item) => item.id));
  assert.deepEqual(capped.trend.map((point) => point.completedAt), many.slice(-RECENT_ATTEMPT_LIMIT).map((item) => item.endedAt));

  for (const invalid of [NaN, Infinity, -Infinity]) {
    assert.deepEqual(summariseConversations([row(1, invalid)]), { ...empty, attemptCount: 1 });
  }
  assert.equal(summariseConversations([row(1, -20)]).bestPercentage, 0);
  assert.equal(summariseConversations([row(1, 120)]).bestPercentage, 100);
  const missingEnd = { ...row(1, 80), endedAt: null };
  assert.deepEqual(summariseConversations([missingEnd]).trend[0].completedAt, missingEnd.startedAt);

  const calls: unknown[] = [];
  const fake = {
    conversationSession: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return [
          { ...row(1, null), assessment: null },
          { ...row(2, 88.6), assessment: { overallScore: 88.6 } },
        ];
      },
    },
  };
  const queried = await getConversationStats("learner-1", fake as never);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    relationLoadStrategy: "join",
    where: { userId: "learner-1", status: "ENDED" },
    select: {
      id: true,
      scenarioId: true,
      startedAt: true,
      endedAt: true,
      assessment: { select: { overallScore: true } },
    },
    orderBy: { endedAt: "desc" },
    take: 50,
  });
  assert.equal(queried.attemptCount, 2);
  assert.equal(queried.scoredAttemptCount, 1);
  assert.equal(queried.averagePercentage, 89);
  console.log("PASS conversation stats: empty, unscored, rounding, trend, finite scores, single scoped query (offline)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
