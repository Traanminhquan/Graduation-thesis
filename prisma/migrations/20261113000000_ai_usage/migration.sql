-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('ASSESSMENT', 'STT');

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "kind" "AiUsageKind" NOT NULL,
    "status" TEXT NOT NULL,
    "userId" TEXT,
    "submissionId" TEXT,
    "model" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "audioSeconds" DOUBLE PRECISION,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_kind_createdAt_idx" ON "ai_usage"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_submissionId_createdAt_idx" ON "ai_usage"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_userId_kind_createdAt_idx" ON "ai_usage"("userId", "kind", "createdAt");

