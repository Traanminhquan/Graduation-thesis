/** Offline checks only: no seed scripts, database clients, or providers. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isAnswerCorrect, normalizeAnswer, READING_QUESTION_TYPES } from "../../src/lib/reading/scoring";
import type { Cefr, Level } from "../content/lesson-bank-data";
import { readingLessons3 } from "../content/lesson-bank-reading-3";
import { readingRow } from "../content/lesson-bank-rows";

let checks = 0;
function check(label: string, ok: boolean): void {
  checks++;
  if (!ok) throw new Error(label);
}
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9' -]/g, " ");
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ranges: Record<Cefr, [number, number, Level, number]> = {
  A1: [100, 150, "BEGINNER", 2], A2: [150, 200, "BEGINNER", 2],
  B1: [180, 250, "INTERMEDIATE", 2], B2: [220, 300, "ADVANCED", 2],
  C1: [250, 300, "ADVANCED", 1],
};

// Read source text, rather than import seed entry points that can write data.
const root = resolve(import.meta.dirname, "../..");
const sources = [
  ...readdirSync(resolve(root, "scripts/content")).filter((name) =>
    (/^lesson-bank.*\.ts$/.test(name) && name !== "lesson-bank-reading-3.ts") ||
    ["seed-listening.ts", "seed-writing.ts", "seed-speaking.ts"].includes(name),
  ).map((name) => `scripts/content/${name}`),
  "prisma/seed.ts", "src/lib/conversation/scenarios.ts",
];
const existingTitles = new Set(sources.flatMap((file) =>
  [...readFileSync(resolve(root, file), "utf8").matchAll(/\btitle\s*:\s*(["'`])([^\r\n]*?)\1/g)]
    .map((match) => normalizeAnswer(match[2])),
));
const titles = new Set<string>();
const sequences = new Set<string>();
const counts = new Map<string, number>();
const positions = [0, 0, 0, 0];
check("exactly nine lessons", readingLessons3.length === 9);
check("exact ids 25 through 33", readingLessons3.map((l) => l.id).sort().join() ===
  Array.from({ length: 9 }, (_, i) => `seed-reading-${25 + i}`).sort().join());
check("at least five lessons have six questions", readingLessons3.filter((l) => l.questions.length === 6).length >= 5);
for (const [cefr, range] of Object.entries(ranges)) {
  check(`${cefr} spread`, readingLessons3.filter((l) => l.cefr === cefr).length === range[3]);
}
for (const lesson of readingLessons3) {
  const label = lesson.id;
  check(`${label}: CEFR present`, Boolean(lesson.cefr && ranges[lesson.cefr]));
  const [min, max, level] = ranges[lesson.cefr!];
  const n = words(lesson.content);
  check(`${label}: ${min}-${max} words (got ${n})`, n >= min && n <= max);
  check(`${label}: matching difficulty`, lesson.difficulty === level);
  const title = normalizeAnswer(lesson.title);
  check(`${label}: new unique title`, !titles.has(title) && !existingTitles.has(title));
  titles.add(title);
  check(`${label}: 4-8 minutes`, lesson.estimatedMinutes >= 4 && lesson.estimatedMinutes <= 8);
  check(`${label}: one-sentence summary`, /^[^.!?]+[.!?]$/.test(lesson.summary));
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: distinct prompts`, new Set(lesson.questions.map((q) => q.prompt)).size === lesson.questions.length);
  check(`${label}: three question types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  const sequence = lesson.questions.map((q) => q.type).join(",");
  check(`${label}: distinct type sequence`, !sequences.has(sequence));
  sequences.add(sequence);
  const facing = [lesson.title, lesson.topic, lesson.summary, lesson.content,
    ...lesson.questions.flatMap((q) => [q.prompt, q.answer, q.explanation, ...(q.options ?? []), ...(q.accepted ?? [])])];
  for (const field of facing) {
    check(`${label}: no forbidden word`, !/\b(?:fictional|imaginary|invented|made-up|adult)\b/i.test(field));
    check(`${label}: plain learner text`, !/<\/?[a-z][^>]*>|[*#`]|\p{Extended_Pictographic}/u.test(field));
  }
  lesson.questions.forEach((item, index) => {
    const row = readingRow(label, index, item);
    const q = `${label} q${index + 1}`;
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    check(`${q}: recognised type`, READING_QUESTION_TYPES.includes(item.type));
    const options = row.options ?? [];
    const gradable = { ...row, options, acceptedAnswers: row.acceptedAnswers ?? [] };
    if (item.type === "TRUE_FALSE") {
      check(`${q}: true/false answer`, ["true", "false"].includes(item.answer));
      check(`${q}: wrong answer rejected`, !isAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: blank present`, item.prompt.includes("______"));
      check(`${q}: answer in passage`, new RegExp(`\\b${escapeRegex(item.answer.toLowerCase())}\\b`).test(plain(lesson.content)));
      check(`${q}: exact one/two-word answer`, words(item.answer) <= 2 && words(item.answer) >= 1 &&
        new RegExp(`\\b${escapeRegex(item.answer)}\\b`).test(lesson.content));
      check(`${q}: wrong answer rejected`, !isAnswerCorrect(gradable, "zzz"));
    } else {
      check(`${q}: four distinct options`, options.length === 4 && new Set(options.map(normalizeAnswer)).size === 4);
      check(`${q}: exactly one answer option`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: correct index`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      for (const wrong of options.filter((o) => o !== item.answer)) {
        check(`${q}: wrong option rejected`, !isAnswerCorrect(gradable, wrong));
      }
      positions[row.correctOptionIndex!]++;
    }
    if (item.type === "VOCAB_IN_CONTEXT") {
      const quoted = item.prompt.match(/"([^"]+)"/);
      check(`${q}: quoted vocabulary occurs in passage`, Boolean(quoted && lesson.content.includes(quoted[1])));
    }
    check(`${q}: stored answer accepted`, isAnswerCorrect(gradable, row.correctAnswer));
    check(`${q}: explanation over 20 characters`, item.explanation.length > 20);
    for (const accepted of item.accepted ?? []) check(`${q}: accepted form grades correctly`, isAnswerCorrect(gradable, accepted));
  });
}
for (const type of READING_QUESTION_TYPES) check(`${type}: at least three occurrences`, (counts.get(type) ?? 0) >= 3);
check("main idea is not always last", readingLessons3.some((l) => l.questions.at(-1)?.type !== "MAIN_IDEA"));
check("correct positions spread across four places", positions.every((n) => n > 0) && Math.max(...positions) - Math.min(...positions) <= 2);
console.log(`PASS ${checks} offline Reading-3 checks; correct-option positions ${positions.join(", ")}`);
