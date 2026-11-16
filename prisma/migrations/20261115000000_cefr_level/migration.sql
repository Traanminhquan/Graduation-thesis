-- CreateEnum
CREATE TYPE "Cefr" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1');

-- AlterTable: nullable, so existing rows stay valid until the labels are filled in.
ALTER TABLE "reading_lessons" ADD COLUMN "cefr" "Cefr";
ALTER TABLE "listening_lessons" ADD COLUMN "cefr" "Cefr";
ALTER TABLE "writing_prompts" ADD COLUMN "cefr" "Cefr";
ALTER TABLE "speaking_prompts" ADD COLUMN "cefr" "Cefr";
