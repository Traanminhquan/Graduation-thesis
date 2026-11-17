# Lingua

An English practice site covering the four skills, built as a graduation project. Every exercise is marked, and every mark comes with a reason.

| Skill | What the learner does | How it is marked |
| --- | --- | --- |
| Reading | Reads a passage and answers multiple-choice, true/false and gap-fill questions | Scored on the server; each answer is reviewed with an explanation |
| Listening | Listens to a text read by the browser's speech synthesis and answers questions | Scored on the server; the transcript is shown with the review |
| Writing | Writes on a topic within a word range; drafts are saved automatically | A rule-based basic check, plus an optional AI assessment with scores, corrections and suggestions |
| Speaking | Records an answer, which is transcribed to text | An optional AI assessment of the content of the transcript (pronunciation is not scored) |

The Progress page brings the four skills together: averages, best scores, trends, recent attempts, a "where to focus next" section derived from the learner's own mistakes, and the words they got wrong in Reading.

## Stack

- Next.js 16 (App Router, Cache Components, `src/proxy.ts` for route protection) and React 19
- PostgreSQL through Prisma 6, hosted on Supabase behind the session pooler
- Tailwind CSS 4
- Accounts: email and password (bcrypt), a signed session cookie, rate limits on login, registration and password change
- AI assessment: DeepSeek chat completions. Speech to text: Groq. Both are off unless switched on in the environment, and both are capped by a spend ledger stored in the database

> This Next.js version differs from older releases. Read the guide in `node_modules/next/dist/docs/` before changing framework-level code.

## Getting started

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy     # create the tables
npm run db:seed               # two Reading lessons
node --env-file=.env --import tsx scripts/seed-listening.ts
node --env-file=.env --import tsx scripts/seed-writing.ts --apply
node --env-file=.env --import tsx scripts/seed-speaking.ts --apply
node --env-file=.env --import tsx scripts/seed-lesson-bank.ts --apply   # tops every skill up to fifty items
node --env-file=.env --import tsx scripts/seed-lesson-bank.ts --labels  # CEFR level (A1 to C1) of every item
npm run dev
```

The seed scripts only insert or upsert rows with fixed ids; none of them deletes a learner's work. `seed-lesson-bank.ts --status` prints the current counts without writing.

The database connection allows one client at a time, so the application runs its queries one after another. Keep it that way in new code and scripts: `Promise.all` over Prisma calls fails on the pooler.

## Environment

`.env.example` lists every variable with a comment. The two required ones are `DATABASE_URL` and `AUTH_SECRET`. Everything to do with AI and speech is optional:

- `AI_ASSESSMENT_ENABLED=true` turns on Writing assessment; `SPEAKING_AI_ASSESSMENT_ENABLED=true` adds Speaking. Anything other than the exact string `true` means off.
- `SPEAKING_STT_ENABLED=true` with a `GROQ_API_KEY` turns on transcription. Without it the learner types the transcript.
- `SPEAKING_AUDIO_STORAGE_ENABLED=true` keeps each recording in the database so the learner can listen again and delete it (needs transcription to be on).
- `CONVERSATION_ENABLED=true` turns on spoken conversations with AI (needs transcription, a `CONVERSATION_MODEL` and its two prices). With Groq, `qwen/qwen3.8-27b` and `CONVERSATION_REASONING_EFFORT=none` gave the fastest replies.
- `AI_PILOT_BUDGET_USD` and `AI_BUDGET_PERIOD` cap the spend; requests beyond the cap are refused before a provider is called.

Never commit `.env`.

## Checks

```bash
npm run typecheck
npm run lint
npm test          # every scripts/checks/check-*.ts: offline, no database, no provider
npm run build
```

The same four steps run in GitHub Actions on pull requests and on pushes to `main` (`.github/workflows/ci.yml`).

The `scripts/e2e-*.ts` runners drive the real application against a database, and `provider-integration-test.ts` calls a paid provider. Neither is part of `npm test`.

## Layout

```
prisma/            schema, migrations, seed
scripts/           seed scripts, offline checks, end-to-end runners
src/app/           routes: the four skills, progress, profile, auth API
src/components/    shared UI; one folder per skill for its workspace
src/lib/           data access and rules per skill, ai/ (provider, cost ledger), auth/, progress/
```

## Design

The interface is a marked-up page: blue-black ink for text, highlighter yellow for what is selected or linked, and the teacher's red pen for mistakes and marks. Literata is used for anything read or written by the learner, Be Vietnam Pro for the interface (both fonts include the Vietnamese subset). The tokens and their rules are at the top of `src/app/globals.css`.
