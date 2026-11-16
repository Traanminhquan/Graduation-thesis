import type { Prisma, PrismaClient } from "@prisma/client";

import { budgetPeriodStart } from "../ai/cost";

import { ConversationError, type ConversationConfig } from "./config";

/**
 * Spend ledger for conversations, on the shared `ai_usage` table.
 *
 * Same rule as the assessment and speech ledgers: a call is reserved (checked
 * against the budget and written) under a short advisory lock BEFORE the
 * provider is called, and the provider is called outside the lock. The
 * reservation is the authoritative, conservative spend; the row written
 * afterwards records what happened and costs nothing.
 *
 * Conversation rows use their own kinds, so they neither use up nor are
 * limited by the Speaking practice allowance.
 */

export type ConversationUsageKind = "CONVERSATION" | "CONVERSATION_STT";

export type ConversationUsage = {
  kind: ConversationUsageKind;
  status: "reserved" | "completed" | "failed";
  userId: string;
  sessionId: string;
  costUsd: number;
  audioSeconds?: number;
  promptTokens?: number;
  completionTokens?: number;
  model?: string;
  at: Date;
};

export interface ConversationLedgerOps {
  /** Reserved spend of both conversation kinds since the start of the period. */
  spend(since?: Date): Promise<number>;
  /** True while a call reserved for this conversation since `since` has not been settled. */
  pending(sessionId: string, since: Date): Promise<boolean>;
  append(row: ConversationUsage): Promise<void>;
}

export interface ConversationLedger extends ConversationLedgerOps {
  exclusive<T>(work: (ops: ConversationLedgerOps) => Promise<T>): Promise<T>;
}

const KINDS: ConversationUsageKind[] = ["CONVERSATION", "CONVERSATION_STT"];
/** Distinct from the assessment (15015001) and speech (15015002) locks. */
const CONVERSATION_LOCK_KEY = 15015003;

export function dbConversationLedger(db: PrismaClient): ConversationLedger {
  const opsBoundTo = (client: Pick<Prisma.TransactionClient, "aiUsage">): ConversationLedgerOps => ({
    async spend(since) {
      const result = await client.aiUsage.aggregate({
        where: { kind: { in: KINDS }, ...(since ? { createdAt: { gte: since } } : {}) },
        _sum: { costUsd: true },
      });
      return result._sum.costUsd ?? 0;
    },
    async pending(sessionId, since) {
      const where = { kind: { in: KINDS }, submissionId: sessionId, createdAt: { gte: since } };
      const reserved = await client.aiUsage.count({ where: { ...where, status: "reserved" } });
      const settled = await client.aiUsage.count({ where: { ...where, status: { in: ["completed", "failed"] } } });
      return reserved > settled;
    },
    async append(row) {
      await client.aiUsage.create({
        data: {
          kind: row.kind,
          status: row.status,
          userId: row.userId,
          submissionId: row.sessionId,
          costUsd: row.costUsd,
          audioSeconds: row.audioSeconds ?? null,
          promptTokens: row.promptTokens ?? 0,
          completionTokens: row.completionTokens ?? 0,
          model: row.model ?? null,
          createdAt: row.at,
        },
      });
    },
  });

  return {
    ...opsBoundTo(db),
    exclusive: (work) =>
      db.$transaction(
        async (tx) => {
          // Every operation runs on this one connection: the production pool has a single one.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CONVERSATION_LOCK_KEY})`;
          return work(opsBoundTo(tx));
        },
        { maxWait: 10_000, timeout: 15_000 },
      ),
  };
}

type Reservation = Omit<ConversationUsage, "status" | "at">;

/**
 * Checks the budget and writes the reservation in one critical section.
 * Throws `ConversationError("budget")` when the estimate does not fit, and,
 * with `guard`, `ConversationError("busy")` while another call for the same
 * conversation is reserved and not yet settled (a stale reservation stops
 * blocking after `windowMs`).
 */
export async function reserveConversationSpend(
  ledger: ConversationLedger,
  reservation: Reservation,
  config: Pick<ConversationConfig, "budgetUsd">,
  env: NodeJS.ProcessEnv,
  now: Date = new Date(),
  guard?: { sessionId: string; windowMs: number },
): Promise<void> {
  if (!Number.isFinite(reservation.costUsd) || reservation.costUsd < 0) {
    throw new ConversationError("configuration");
  }
  const periodStart = budgetPeriodStart(env, now);
  await ledger.exclusive(async (ops) => {
    if (guard && (await ops.pending(guard.sessionId, new Date(now.getTime() - guard.windowMs)))) {
      throw new ConversationError("busy");
    }
    if ((await ops.spend(periodStart)) + reservation.costUsd > config.budgetUsd) {
      throw new ConversationError("budget");
    }
    await ops.append({ ...reservation, status: "reserved", at: now });
  });
}

/** Records the outcome of a reserved call. Costs nothing: the reservation already counted. */
export async function settleConversationSpend(
  ledger: ConversationLedger,
  outcome: Omit<ConversationUsage, "costUsd" | "at">,
  now: Date = new Date(),
): Promise<void> {
  await ledger.append({ ...outcome, costUsd: 0, at: now });
}
