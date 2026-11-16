-- CreateTable
CREATE TABLE "speaking_recordings" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "speaking_recordings_submissionId_key" ON "speaking_recordings"("submissionId");

-- CreateIndex
CREATE INDEX "speaking_recordings_userId_createdAt_idx" ON "speaking_recordings"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "speaking_recordings" ADD CONSTRAINT "speaking_recordings_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "speaking_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_recordings" ADD CONSTRAINT "speaking_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Voice recordings are personal data. With row level security on and no policy,
-- only the table owner (the role the application connects as) can read or write
-- them; the API roles of a hosted Postgres get nothing.
ALTER TABLE "speaking_recordings" ENABLE ROW LEVEL SECURITY;
