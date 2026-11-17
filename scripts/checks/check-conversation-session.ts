import assert from "node:assert/strict";
import { startConversation, endConversation, listConversations, getConversation, type SessionDb, type SessionTx, type ConversationView } from "../../src/lib/conversation/session";
import { SCENARIOS } from "../../src/lib/conversation/scenarios";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  CONVERSATION_ENABLED: "true", SPEAKING_STT_ENABLED: "true",
  CONVERSATION_PRICE_INPUT_PER_MTOK_USD: "1", CONVERSATION_PRICE_OUTPUT_PER_MTOK_USD: "1",
};
const scenario = SCENARIOS[0];
type Row = Omit<ConversationView, "scenario"> & { userId: string; scenarioId: string };
type Query = {
  where: { id?: string; userId: string; status?: string; startedAt?: { gte: Date } };
  data: Partial<Row> & { turns?: { create: Row["turns"][number] } };
  select: Record<string, unknown>;
  orderBy?: { startedAt: string };
  take?: number;
};

function fake() {
  const rows: Row[] = [];
  const events: string[] = [];
  let inside = false;
  let locked = false;
  let queue = Promise.resolve();
  let queries = 0;
  const matches = (row: Row, q: Query) => row.userId === q.where.userId &&
    (!q.where.id || row.id === q.where.id) && (!q.where.status || row.status === q.where.status) &&
    (!q.where.startedAt || row.startedAt >= q.where.startedAt.gte);
  const model = {
    async count(args: unknown) {
      queries++;
      assert(inside && locked, "count must follow the lock inside the transaction");
      events.push("count");
      return rows.filter((r) => matches(r, args as Query)).length;
    },
    async updateMany(args: unknown) {
      queries++;
      const q = args as Query;
      const selected = rows.filter((r) => matches(r, q));
      for (const row of selected) Object.assign(row, q.data);
      return { count: selected.length };
    },
    async create(args: unknown) {
      queries++;
      const q = args as Query;
      assert.deepEqual(q.select, { id: true });
      const data = q.data as unknown as Omit<Row, "id" | "endedAt"> & { turns: { create: Row["turns"][number] } };
      const row: Row = { ...data, id: `s${rows.length}`, endedAt: null, turns: [data.turns.create] };
      rows.push(row);
      return { id: row.id };
    },
    async findMany(args: unknown) {
      queries++;
      const q = args as Query;
      assert.deepEqual(Object.keys(q.select).sort(), ["id", "scenarioId", "status", "turnCount", "startedAt", "endedAt"].sort());
      assert.deepEqual(q.orderBy, { startedAt: "desc" });
      assert.equal(q.take, 20);
      return rows.filter((r) => matches(r, q)).sort((a, b) => +b.startedAt - +a.startedAt).slice(0, q.take).map(({ id, scenarioId, status, turnCount, startedAt, endedAt }) => ({ id, scenarioId, status, turnCount, startedAt, endedAt }));
    },
    async findFirst(args: unknown) {
      queries++;
      const q = args as Query;
      assert.deepEqual(q.select.turns, { orderBy: { index: "asc" }, select: { index: true, role: true, text: true } });
      const row = rows.find((r) => matches(r, q));
      if (!row) return null;
      const { userId: _owner, ...view } = row;
      void _owner;
      return { ...view, turns: [...row.turns].sort((a, b) => a.index - b.index) };
    },
  };
  const db: SessionDb = {
    conversationSession: model,
    async $transaction<T>(work: (tx: SessionTx) => Promise<T>): Promise<T> {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      inside = true;
      locked = false;
      const snapshot = structuredClone(rows);
      try {
        return await work({
          conversationSession: model,
          async $executeRaw(query, ...values) {
            assert(inside);
            assert.equal(query.join(""), "SELECT pg_advisory_xact_lock(15015004)");
            assert.deepEqual(values, []);
            locked = true;
            events.push("lock");
            return 1;
          },
        });
      } catch (error) {
        rows.splice(0, rows.length, ...snapshot);
        throw error;
      } finally { inside = false; release(); }
    },
  };
  return { db, rows, events, queries: () => queries };
}

async function main() {
  const f = fake();
  let time = new Date("2026-01-01T23:59:59Z");
  const deps = { db: f.db, env, now: () => time };
  assert.deepEqual(await startConversation("u", scenario.id, { ...deps, env: { NODE_ENV: "test" } }), { ok: false, reason: "disabled" });
  assert.deepEqual(await startConversation("", scenario.id, deps), { ok: false, reason: "unauthenticated" });
  for (const id of ["missing", "__proto__", null, 1, {}]) {
    assert.deepEqual(await startConversation("u", id, deps), { ok: false, reason: "not_found" });
  }
  assert.equal(f.queries(), 0);
  const first = await startConversation("u", scenario.id, deps);
  assert(first.ok);
  assert.equal(f.rows.length, 1);
  assert.deepEqual(f.rows[0].turns, [{ index: 0, role: "PARTNER", text: scenario.opening }]);
  assert.equal(f.rows[0].turnCount, 0);
  assert.equal(f.rows[0].status, "ACTIVE");
  assert.deepEqual(f.events, ["lock", "count"]);
  assert((await startConversation("other", scenario.id, deps)).ok);
  assert((await startConversation("u", scenario.id, deps)).ok);
  assert.equal(f.rows[0].status, "ABANDONED");
  assert.deepEqual(f.rows[0].endedAt, time);
  assert.equal(f.rows[1].status, "ACTIVE");
  assert((await startConversation("u", scenario.id, deps)).ok, "limit-th start passes");
  assert.deepEqual(await startConversation("u", scenario.id, deps), { ok: false, reason: "daily_limit" });
  assert.equal(f.rows.length, 4);
  time = new Date("2026-01-02T00:00:00Z");
  assert((await startConversation("u", scenario.id, deps)).ok, "UTC midnight resets quota");
  const low = { ...deps, env: { ...env, CONVERSATION_DAILY_SESSIONS: "1" } };
  assert.deepEqual(await startConversation("u", scenario.id, low), { ok: false, reason: "daily_limit" });
  const concurrent = fake();
  const results = await Promise.all([1, 2].map(() => startConversation("u", scenario.id, { ...low, db: concurrent.db })));
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.filter((r) => !r.ok && r.reason === "daily_limit").length, 1);
  assert.equal(concurrent.rows.length, 1);
  const active = f.rows.at(-1)!;
  assert.equal(await endConversation("other", active.id, deps), false);
  assert.equal(await endConversation("u", active.id, deps), true);
  assert.equal(active.status, "ENDED");
  assert.deepEqual(active.endedAt, time);
  assert.equal(await endConversation("u", active.id, deps), false);
  let before = f.queries();
  for (const id of [null, {}, 1, ""]) assert.equal(await endConversation("u", id, deps), false);
  assert.equal(f.queries(), before);
  active.turns.push({ index: 2, role: "PARTNER", text: "reply" }, { index: 1, role: "LEARNER", text: "hello" });
  const view = await getConversation(active.id, "u", deps);
  assert(view);
  assert.equal(view.scenario?.id, scenario.id);
  assert.deepEqual(view.turns.map((t) => t.index), [0, 1, 2]);
  assert.equal(await getConversation(active.id, "other", deps), null);
  assert.equal(await getConversation("missing", "u", deps), null);
  before = f.queries();
  for (const id of [null, {}, 1, ""]) assert.equal(await getConversation(id, "u", deps), null);
  assert.equal(f.queries(), before);
  for (let i = 0; i < 25; i++) f.rows.push({ ...active, id: `history${i}`, scenarioId: "removed", startedAt: new Date(+time + i + 1) });
  const summaries = await listConversations("u", deps);
  assert.equal(summaries.length, 20);
  assert.equal(summaries[0].id, "history24");
  assert.equal(summaries.at(-1)?.id, "history5");
  assert(summaries.every((r) => r.scenarioTitle === null && !("turns" in r)));
  const other = await listConversations("other", deps);
  assert.equal(other.length, 1);
  assert.equal(other[0].scenarioTitle, scenario.title);
  active.scenarioId = "removed";
  assert.equal((await getConversation(active.id, "u", deps))?.scenario, null);
  console.log("PASS conversation session: validation, locked quotas, UTC reset, ownership, lifecycle and reads");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
