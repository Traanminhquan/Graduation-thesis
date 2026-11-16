/**
 * Adds the missing demo lessons so every skill has fifty items.
 *
 *   npx tsx scripts/seed-lesson-bank.ts            dry run: no connection, nothing written
 *   node --env-file=.env --import tsx scripts/seed-lesson-bank.ts --status   read-only: host + counts
 *   node --env-file=.env --import tsx scripts/seed-lesson-bank.ts --apply    create missing rows
 *   node --env-file=.env --import tsx scripts/seed-lesson-bank.ts --labels   fill in CEFR levels
 *   node --env-file=.env --import tsx scripts/seed-lesson-bank.ts --audio    point Listening lessons at their MP3
 *
 * --apply is CREATE-ONLY. A lesson or prompt whose id already exists is skipped
 * as a whole (its questions are not touched), so existing content and every
 * learner's attempts, answers and submissions are never modified or deleted.
 * Each new lesson and its questions go in one transaction.
 *
 * --labels writes only the `cefr` column, and only on rows whose level is
 * missing or differs from the data files. It needs the cefr_level migration.
 *
 * --audio writes only `audioUrl` and `audioDurationMs` of Listening lessons that
 * have a file in public/audio/listening (see scripts/listening-audio-manifest.json).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import {
  listeningLessons,
  readingLessons,
  speakingPrompts,
  writingPrompts,
} from "./lesson-bank-data";
import type { Cefr } from "./lesson-bank-data";
import { earlyCefrLabels } from "./lesson-bank-cefr";
import {
  estimateAudioDurationMs,
  listeningRow,
  readingRow,
} from "./lesson-bank-rows";

const apply = process.argv.includes("--apply");
const labels = process.argv.includes("--labels");
const audio = process.argv.includes("--audio");
const status = process.argv.includes("--status") || labels || audio;

/** Recorded MP3 per Listening lesson: only entries whose file is really there. */
const MANIFEST = path.join("scripts", "listening-audio-manifest.json");
const recorded = new Map<string, { audioUrl: string; audioDurationMs: number }>(
  Object.entries(
    existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, { durationMs: number }>) : {},
  )
    .filter(([id]) => existsSync(path.join("public", "audio", "listening", `${id}.mp3`)))
    .map(([id, entry]) => [id, { audioUrl: `/audio/listening/${id}.mp3`, audioDurationMs: entry.durationMs }]),
);

/** The level of every seeded item: per item for 25 and up, from the early-label table for 1 to 24. */
const levelById = new Map<string, Cefr>(Object.entries(earlyCefrLabels));
for (const item of [...readingLessons, ...listeningLessons, ...writingPrompts, ...speakingPrompts]) {
  const level = item.cefr ?? earlyCefrLabels[item.id];
  if (level) levelById.set(item.id, level);
}
const levelOf = (id: string): Cefr | null => levelById.get(id) ?? null;

function json(value: unknown) {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

/** Host and database name only; never the user, password or full URL. */
function destination(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "DATABASE_URL is not set";
  try {
    const url = new URL(raw);
    return `${url.hostname}:${url.port || "default"}${url.pathname}`;
  } catch {
    return "DATABASE_URL could not be parsed";
  }
}

function plan() {
  console.log(
    `${apply ? "APPLYING" : labels ? "LABELLING" : audio ? "LINKING AUDIO" : status ? "STATUS (read-only)" : "DRY RUN"} - lesson bank additions:`,
  );
  for (const l of readingLessons) console.log(`  reading   ${l.id}  ${l.difficulty.padEnd(12)} ${l.title}`);
  for (const l of listeningLessons) console.log(`  listening ${l.id}  ${l.difficulty.padEnd(12)} ${l.title}`);
  for (const p of writingPrompts) console.log(`  writing   ${p.id}  ${p.difficulty.padEnd(12)} ${p.title}`);
  for (const p of speakingPrompts) console.log(`  speaking  ${p.id}  ${p.difficulty.padEnd(12)} ${p.title}`);
}

async function counts(prisma: PrismaClient) {
  // Sequential on purpose: the session pooler allows one client connection.
  const reading = await prisma.readingLesson.count();
  const listening = await prisma.listeningLesson.count();
  const writing = await prisma.writingPrompt.count();
  const speaking = await prisma.speakingPrompt.count();
  return { reading, listening, writing, speaking };
}

async function main() {
  plan();

  if (!apply && !status) {
    console.log("\nNo database connection was opened and nothing was written.");
    console.log("Use --status (read-only) to inspect the destination, then --apply.");
    return;
  }

  console.log(`\nDestination: ${destination()}`);
  const prisma = new PrismaClient();
  try {
    const before = await counts(prisma);
    console.log(`Counts before: ${JSON.stringify(before)}`);

    const existing = {
      reading: new Set((await prisma.readingLesson.findMany({ select: { id: true } })).map((r) => r.id)),
      listening: new Set((await prisma.listeningLesson.findMany({ select: { id: true } })).map((r) => r.id)),
      writing: new Set((await prisma.writingPrompt.findMany({ select: { id: true } })).map((r) => r.id)),
      speaking: new Set((await prisma.speakingPrompt.findMany({ select: { id: true } })).map((r) => r.id)),
    };
    const missing = {
      reading: readingLessons.filter((l) => !existing.reading.has(l.id)).length,
      listening: listeningLessons.filter((l) => !existing.listening.has(l.id)).length,
      writing: writingPrompts.filter((p) => !existing.writing.has(p.id)).length,
      speaking: speakingPrompts.filter((p) => !existing.speaking.has(p.id)).length,
    };
    console.log(`To create: ${JSON.stringify(missing)} (the rest already exist and are skipped)`);

    // Rows whose stored level is missing or differs from the data files.
    const stale = (rows: { id: string; cefr: Cefr | null }[]) =>
      rows.filter((row) => levelOf(row.id) !== null && row.cefr !== levelOf(row.id)).map((row) => row.id);
    const unlabelled = {
      reading: stale(await prisma.readingLesson.findMany({ select: { id: true, cefr: true } })),
      listening: stale(await prisma.listeningLesson.findMany({ select: { id: true, cefr: true } })),
      writing: stale(await prisma.writingPrompt.findMany({ select: { id: true, cefr: true } })),
      speaking: stale(await prisma.speakingPrompt.findMany({ select: { id: true, cefr: true } })),
    };
    console.log(
      `To label: ${JSON.stringify(Object.fromEntries(Object.entries(unlabelled).map(([skill, ids]) => [skill, ids.length])))}`,
    );

    // Listening lessons whose stored audio differs from the recorded file.
    const audioRows = await prisma.listeningLesson.findMany({ select: { id: true, audioUrl: true, audioDurationMs: true } });
    const unlinked = audioRows.filter((row) => {
      const file = recorded.get(row.id);
      return file && (row.audioUrl !== file.audioUrl || row.audioDurationMs !== file.audioDurationMs);
    });
    console.log(`To link audio: ${unlinked.length} of ${recorded.size} recorded files`);

    if (audio) {
      // Sequential, one row at a time; only the two audio columns.
      for (const row of unlinked) await prisma.listeningLesson.update({ where: { id: row.id }, data: recorded.get(row.id)! });
      console.log(`Linked ${unlinked.length} lessons to their MP3 (audioUrl and audioDurationMs only).`);
      return;
    }

    if (labels) {
      // One small update per row, sequential (single pooler connection); only the cefr column.
      for (const id of unlabelled.reading) await prisma.readingLesson.update({ where: { id }, data: { cefr: levelOf(id) } });
      for (const id of unlabelled.listening) await prisma.listeningLesson.update({ where: { id }, data: { cefr: levelOf(id) } });
      for (const id of unlabelled.writing) await prisma.writingPrompt.update({ where: { id }, data: { cefr: levelOf(id) } });
      for (const id of unlabelled.speaking) await prisma.speakingPrompt.update({ where: { id }, data: { cefr: levelOf(id) } });
      const total = Object.values(unlabelled).reduce((n, ids) => n + ids.length, 0);
      console.log(`Labelled ${total} rows (cefr column only).`);
      return;
    }

    if (!apply) {
      console.log("Status only: nothing was written.");
      return;
    }

    for (const lesson of readingLessons) {
      if (existing.reading.has(lesson.id)) {
        console.log(`skip   ${lesson.id} (exists)`);
        continue;
      }
      const { questions, ...data } = lesson;
      await prisma.readingLesson.create({
        data: {
          ...data,
          cefr: levelOf(lesson.id),
          questions: {
            create: questions.map((item, index) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { lessonId: _lessonId, ...row } = readingRow(lesson.id, index, item);
              return {
                ...row,
                options: json(row.options),
                acceptedAnswers: json(row.acceptedAnswers),
              };
            }),
          },
        },
      });
      console.log(`create ${lesson.id} "${lesson.title}" (${questions.length} questions)`);
    }

    for (const lesson of listeningLessons) {
      if (existing.listening.has(lesson.id)) {
        console.log(`skip   ${lesson.id} (exists)`);
        continue;
      }
      const { questions, ...data } = lesson;
      await prisma.listeningLesson.create({
        data: {
          ...data,
          cefr: levelOf(lesson.id),
          ...(recorded.get(lesson.id) ?? {
            audioUrl: `tts://browser-speech-synthesis/${lesson.id}`,
            audioDurationMs: estimateAudioDurationMs(lesson.transcript),
          }),
          questions: {
            create: questions.map((item, index) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { lessonId: _lessonId, ...row } = listeningRow(lesson.id, index, item);
              return {
                ...row,
                options: json(row.options),
                matchingPairs: json(row.matchingPairs),
                acceptedAnswers: json(row.acceptedAnswers),
              };
            }),
          },
        },
      });
      console.log(`create ${lesson.id} "${lesson.title}" (${questions.length} questions)`);
    }

    for (const prompt of writingPrompts) {
      if (existing.writing.has(prompt.id)) {
        console.log(`skip   ${prompt.id} (exists)`);
        continue;
      }
      await prisma.writingPrompt.create({ data: { ...prompt, cefr: levelOf(prompt.id) } });
      console.log(`create ${prompt.id} "${prompt.title}"`);
    }

    for (const prompt of speakingPrompts) {
      if (existing.speaking.has(prompt.id)) {
        console.log(`skip   ${prompt.id} (exists)`);
        continue;
      }
      await prisma.speakingPrompt.create({ data: { ...prompt, cefr: levelOf(prompt.id) } });
      console.log(`create ${prompt.id} "${prompt.title}"`);
    }

    console.log(`\nCounts after: ${JSON.stringify(await counts(prisma))}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
