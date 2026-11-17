-- Each of these single-column indexes is the leading column of a unique index
-- on the same table ((lessonId, order) and (attemptId, questionId)), which
-- already serves every lookup by that column.
DROP INDEX IF EXISTS "listening_answers_attemptId_idx";
DROP INDEX IF EXISTS "listening_questions_lessonId_idx";
DROP INDEX IF EXISTS "reading_answers_attemptId_idx";
DROP INDEX IF EXISTS "reading_questions_lessonId_idx";
