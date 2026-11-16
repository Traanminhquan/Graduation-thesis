import { conversationConfig } from "./config";
import { getScenario, type Scenario } from "./scenarios";

type Status = "ACTIVE" | "ENDED" | "ABANDONED";
type SessionRow = {
  id: string;
  scenarioId: string;
  status: Status;
  turnCount: number;
  startedAt: Date;
  endedAt: Date | null;
};
type Turn = { index: number; role: "LEARNER" | "PARTNER"; text: string };

/** Small injectable interface, also satisfied by Prisma. */
export type SessionTx = {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  conversationSession: {
    count(args: unknown): Promise<number>;
    updateMany(args: unknown): Promise<{ count: number }>;
    create(args: unknown): Promise<{ id: string }>;
  };
};
export type SessionDb = {
  $transaction<T>(work: (tx: SessionTx) => Promise<T>): Promise<T>;
  conversationSession: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findMany(args: unknown): Promise<SessionRow[]>;
    findFirst(args: {
      where: { id: string; userId: string };
      select: typeof summarySelect & {
        turns: { orderBy: { index: "asc" }; select: { index: true; role: true; text: true } };
      };
    }): Promise<(SessionRow & { turns: Turn[] }) | null>;
  };
};
type SessionDeps = { db?: SessionDb; env?: NodeJS.ProcessEnv; now?: () => Date };
const database = async (deps: SessionDeps): Promise<SessionDb> =>
  deps.db ?? (await import("@/lib/db")).prisma;
const summarySelect = {
  id: true, scenarioId: true, status: true, turnCount: true, startedAt: true, endedAt: true,
} as const;

export type StartResult =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "disabled" | "not_found" | "daily_limit" | "unauthenticated" };

export async function startConversation(
  userId: string, scenarioId: unknown, deps: SessionDeps = {},
): Promise<StartResult> {
  const config = conversationConfig(deps.env ?? process.env);
  if (!config.enabled) return { ok: false, reason: "disabled" };
  if (!userId) return { ok: false, reason: "unauthenticated" };
  const scenario = typeof scenarioId === "string" ? getScenario(scenarioId) : null;
  if (!scenario) return { ok: false, reason: "not_found" };
  const db = await database(deps);
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(15015004)`;
    // Read the clock after acquiring the lock, including when waiting across midnight.
    const now = (deps.now ?? (() => new Date()))();
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    const count = await tx.conversationSession.count({ where: { userId, startedAt: { gte: day } } });
    if (count >= config.dailySessions) return { ok: false, reason: "daily_limit" };
    await tx.conversationSession.updateMany({
      where: { userId, status: "ACTIVE" }, data: { status: "ABANDONED", endedAt: now },
    });
    const session = await tx.conversationSession.create({
      data: {
        userId, scenarioId: scenario.id, status: "ACTIVE", turnCount: 0, startedAt: now,
        turns: { create: { index: 0, role: "PARTNER", text: scenario.opening } },
      },
      select: { id: true },
    });
    return { ok: true, sessionId: session.id };
  });
}

export async function endConversation(
  userId: string, sessionId: unknown, deps: SessionDeps = {},
): Promise<boolean> {
  if (typeof sessionId !== "string" || !sessionId || !userId) return false;
  const db = await database(deps);
  const result = await db.conversationSession.updateMany({
    where: { id: sessionId, userId, status: "ACTIVE" },
    data: { status: "ENDED", endedAt: (deps.now ?? (() => new Date()))() },
  });
  return result.count > 0;
}

export type ConversationSummary = SessionRow & { scenarioTitle: string | null };
export async function listConversations(userId: string, deps: SessionDeps = {}): Promise<ConversationSummary[]> {
  if (!userId) return [];
  const db = await database(deps);
  const rows = await db.conversationSession.findMany({
    where: { userId }, select: summarySelect, orderBy: { startedAt: "desc" }, take: 20,
  });
  return rows.map((row) => ({ ...row, scenarioTitle: getScenario(row.scenarioId)?.title ?? null }));
}

export type ConversationView = Omit<SessionRow, "scenarioId"> & { scenario: Scenario | null; turns: Turn[] };
export async function getConversation(
  sessionId: unknown, userId: string, deps: SessionDeps = {},
): Promise<ConversationView | null> {
  if (typeof sessionId !== "string" || !sessionId || !userId) return null;
  const db = await database(deps);
  const row = await db.conversationSession.findFirst({
    where: { id: sessionId, userId },
    select: {
      ...summarySelect,
      turns: { orderBy: { index: "asc" }, select: { index: true, role: true, text: true } },
    },
  });
  if (!row) return null;
  const { scenarioId, ...view } = row;
  return { ...view, scenario: getScenario(scenarioId) };
}
