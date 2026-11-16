-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "Skill" AS ENUM ('READING', 'LISTENING', 'WRITING', 'SPEAKING');

-- CreateEnum
CREATE TYPE "ReadingQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'MAIN_IDEA', 'VOCAB_IN_CONTEXT');

-- CreateEnum
CREATE TYPE "ListeningQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'MATCHING');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ASSESSED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_lessons" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_questions" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ReadingQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "correctAnswer" TEXT NOT NULL,
    "correctOptionIndex" INTEGER,
    "acceptedAnswers" JSONB,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "reading_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reading_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_lessons" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "audioUrl" TEXT NOT NULL,
    "audioDurationMs" INTEGER,
    "transcript" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listening_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_questions" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ListeningQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "matchingPairs" JSONB,
    "correctAnswer" TEXT NOT NULL,
    "correctOptionIndex" INTEGER,
    "acceptedAnswers" JSONB,
    "explanation" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "listening_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "listening_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "response" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listening_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_prompts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "topic" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "minWords" INTEGER,
    "maxWords" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "draftText" TEXT,
    "finalText" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "writing_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_assessments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "grammarScore" DOUBLE PRECISION NOT NULL,
    "vocabularyScore" DOUBLE PRECISION NOT NULL,
    "coherenceScore" DOUBLE PRECISION NOT NULL,
    "taskAchievementScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "corrections" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "model" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_prompts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "topic" TEXT,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'INTERMEDIATE',
    "preparationSeconds" INTEGER,
    "speakingSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "speaking_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_submissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "audioUrl" TEXT,
    "audioDurationMs" INTEGER,
    "rawTranscript" TEXT,
    "confirmedTranscript" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "speaking_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_assessments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "grammarScore" DOUBLE PRECISION NOT NULL,
    "vocabularyScore" DOUBLE PRECISION NOT NULL,
    "coherenceScore" DOUBLE PRECISION NOT NULL,
    "topicRelevanceScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "corrections" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "model" TEXT,
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weakness_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "category" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weakness_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "reading_lessons_topic_difficulty_idx" ON "reading_lessons"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "reading_questions_lessonId_idx" ON "reading_questions"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_questions_lessonId_order_key" ON "reading_questions"("lessonId", "order");

-- CreateIndex
CREATE INDEX "reading_attempts_userId_completedAt_idx" ON "reading_attempts"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "reading_attempts_lessonId_idx" ON "reading_attempts"("lessonId");

-- CreateIndex
CREATE INDEX "reading_answers_attemptId_idx" ON "reading_answers"("attemptId");

-- CreateIndex
CREATE INDEX "reading_answers_questionId_idx" ON "reading_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "reading_answers_attemptId_questionId_key" ON "reading_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "listening_lessons_topic_difficulty_idx" ON "listening_lessons"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "listening_questions_lessonId_idx" ON "listening_questions"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "listening_questions_lessonId_order_key" ON "listening_questions"("lessonId", "order");

-- CreateIndex
CREATE INDEX "listening_attempts_userId_completedAt_idx" ON "listening_attempts"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "listening_attempts_lessonId_idx" ON "listening_attempts"("lessonId");

-- CreateIndex
CREATE INDEX "listening_answers_attemptId_idx" ON "listening_answers"("attemptId");

-- CreateIndex
CREATE INDEX "listening_answers_questionId_idx" ON "listening_answers"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "listening_answers_attemptId_questionId_key" ON "listening_answers"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "writing_prompts_topic_difficulty_idx" ON "writing_prompts"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "writing_submissions_userId_createdAt_idx" ON "writing_submissions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "writing_submissions_promptId_idx" ON "writing_submissions"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "writing_assessments_submissionId_key" ON "writing_assessments"("submissionId");

-- CreateIndex
CREATE INDEX "speaking_prompts_topic_difficulty_idx" ON "speaking_prompts"("topic", "difficulty");

-- CreateIndex
CREATE INDEX "speaking_submissions_userId_createdAt_idx" ON "speaking_submissions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "speaking_submissions_promptId_idx" ON "speaking_submissions"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_assessments_submissionId_key" ON "speaking_assessments"("submissionId");

-- CreateIndex
CREATE INDEX "weakness_records_userId_skill_idx" ON "weakness_records"("userId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "weakness_records_userId_skill_category_key" ON "weakness_records"("userId", "skill", "category");

-- AddForeignKey
ALTER TABLE "reading_questions" ADD CONSTRAINT "reading_questions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "reading_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_attempts" ADD CONSTRAINT "reading_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_attempts" ADD CONSTRAINT "reading_attempts_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "reading_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_answers" ADD CONSTRAINT "reading_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "reading_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_answers" ADD CONSTRAINT "reading_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "reading_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_questions" ADD CONSTRAINT "listening_questions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "listening_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_attempts" ADD CONSTRAINT "listening_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_attempts" ADD CONSTRAINT "listening_attempts_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "listening_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_answers" ADD CONSTRAINT "listening_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "listening_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_answers" ADD CONSTRAINT "listening_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "listening_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "writing_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_assessments" ADD CONSTRAINT "writing_assessments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "writing_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_submissions" ADD CONSTRAINT "speaking_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_submissions" ADD CONSTRAINT "speaking_submissions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "speaking_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_assessments" ADD CONSTRAINT "speaking_assessments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "speaking_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weakness_records" ADD CONSTRAINT "weakness_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

