-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ENDED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ConversationRole" AS ENUM ('LEARNER', 'PARTNER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AiUsageKind" ADD VALUE 'CONVERSATION';
ALTER TYPE "AiUsageKind" ADD VALUE 'CONVERSATION_STT';

-- CreateTable
CREATE TABLE "conversation_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "conversation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_turns" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "role" "ConversationRole" NOT NULL,
    "text" TEXT NOT NULL,
    "audioDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_assessments" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "grammarScore" DOUBLE PRECISION NOT NULL,
    "vocabularyScore" DOUBLE PRECISION NOT NULL,
    "coherenceScore" DOUBLE PRECISION NOT NULL,
    "topicRelevanceScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "corrections" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "goalsReached" JSONB NOT NULL,
    "summary" TEXT,
    "model" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_sessions_userId_startedAt_idx" ON "conversation_sessions"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_turns_sessionId_index_key" ON "conversation_turns"("sessionId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_assessments_sessionId_key" ON "conversation_assessments"("sessionId");

-- AddForeignKey
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_assessments" ADD CONSTRAINT "conversation_assessments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "conversation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Conversations are a learner's own words. As for every other table: row level
-- security on, no policy, so only the role the application connects as can read them.
ALTER TABLE "conversation_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_turns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversation_assessments" ENABLE ROW LEVEL SECURITY;
