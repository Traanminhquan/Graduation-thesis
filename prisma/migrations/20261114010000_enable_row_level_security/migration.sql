-- Close the tables to the hosted database's public API roles.
--
-- On Supabase every table in "public" is reachable through the project's REST
-- API, and the "anon" and "authenticated" roles hold SELECT on all of them.
-- Without row level security that includes users (email, password hash) and
-- every learner's work. The application never uses that API: it connects as
-- the table owner, which bypasses row level security. Switching it on with no
-- policy therefore changes nothing for the application and denies everyone else.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reading_lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reading_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reading_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reading_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listening_lessons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listening_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listening_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listening_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "writing_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "writing_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "writing_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "speaking_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "speaking_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "speaking_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weakness_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
