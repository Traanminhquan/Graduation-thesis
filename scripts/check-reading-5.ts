/** Offline only: no seed-script imports, database access or provider calls. */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAnswerCorrect, READING_QUESTION_TYPES } from "../src/lib/reading/scoring";
import type { Cefr, Level } from "./lesson-bank-data";
import { readingLessons5 } from "./lesson-bank-reading-5";
import { readingRow } from "./lesson-bank-rows";

let checks = 0;
let failures = 0;
function check(label: string, ok: boolean) {
  checks++;
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}`);
  }
}
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9' -]/g, " ");
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ranges: Record<Cefr, [number, number]> = { A1: [100, 150], A2: [150, 200], B1: [180, 250], B2: [220, 300], C1: [250, 300] };
const levels: Record<Cefr, Level> = { A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED" };
const spread: Record<Cefr, number> = { A1: 2, A2: 2, B1: 2, B2: 1, C1: 1 };

// Read source text rather than importing executable seed modules. Include all
// batches and the original seeds/scenarios, including concurrent new batches.
const sources = [
  ...readdirSync(resolve("scripts")).filter((name) => /^lesson-bank-.*\.ts$/.test(name) && name !== "lesson-bank-reading-5.ts").map((name) => `scripts/${name}`),
  "prisma/seed.ts", "scripts/seed-listening.ts", "scripts/seed-writing.ts", "scripts/seed-speaking.ts", "src/lib/conversation/scenarios.ts",
];
const existingTitles = new Set(sources.flatMap((file) => {
  const source = readFileSync(resolve(file), "utf8");
  return [...source.matchAll(/\btitle\s*:\s*(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g)]
    .map((match) => match[2].replace(/\\(["'`\\])/g, "$1").trim().toLowerCase());
}));
const ids = readingLessons5.map((lesson) => lesson.id);
check("exactly ids 43 through 50", ids.length === 8 && new Set(ids).size === 8 && Array.from({ length: 8 }, (_, i) => `seed-reading-${43 + i}`).every((id) => ids.includes(id)));
const titles = readingLessons5.map((lesson) => lesson.title.trim().toLowerCase());
check("batch titles unique", new Set(titles).size === titles.length);
check("titles unique against existing content", titles.every((title) => !existingTitles.has(title)));
for (const [cefr, count] of Object.entries(spread)) {
  check(`${cefr} spread`, readingLessons5.filter((lesson) => lesson.cefr === cefr).length === count);
}
check("at least four six-question lessons", readingLessons5.filter((lesson) => lesson.questions.length === 6).length >= 4);
const sequences = readingLessons5.map((lesson) => lesson.questions.map((q) => q.type).join(","));
check("different type sequence in every lesson", new Set(sequences).size === sequences.length);
check("main idea not always last", readingLessons5.some((lesson) => lesson.questions.findIndex((q) => q.type === "MAIN_IDEA") < lesson.questions.length - 1));
for (const type of READING_QUESTION_TYPES) {
  check(`${type} occurs at least three times`, readingLessons5.flatMap((lesson) => lesson.questions).filter((q) => q.type === type).length >= 3);
}
const positions = [0, 0, 0, 0];
for (const lesson of readingLessons5) {
  const label = lesson.id;
  const n = words(lesson.content);
  const cefr = lesson.cefr;
  check(`${label}: CEFR present`, cefr !== undefined && cefr in ranges);
  if (cefr) {
    const [min, max] = ranges[cefr];
    check(`${label}: ${min}-${max} words (${n})`, n >= min && n <= max);
    check(`${label}: difficulty matches CEFR`, lesson.difficulty === levels[cefr]);
  }
  // Reading rules copied from check-lesson-bank.ts, with its A1 exception.
  check(`${label}: passage length`, n >= (cefr === "A1" ? 100 : 150) && n <= 300);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  const prompts = lesson.questions.map((q) => q.prompt);
  check(`${label}: distinct prompts`, new Set(prompts).size === prompts.length);
  check(`${label}: at least three types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  check(`${label}: 4-8 minutes`, Number.isInteger(lesson.estimatedMinutes) && lesson.estimatedMinutes >= 4 && lesson.estimatedMinutes <= 8);
  check(`${label}: one sentence summary`, /^[^.!?]+[.!?]$/.test(lesson.summary));
  const learnerText = [lesson.title, lesson.topic, lesson.summary, lesson.content, ...lesson.questions.flatMap((q) => [q.prompt, q.answer, q.explanation, ...(q.options ?? []), ...(q.accepted ?? [])])];
  for (const [index, field] of learnerText.entries()) {
    check(`${label}: field ${index} has no forbidden words`, !/\b(?:fictional|imaginary|invented|made-up|adult)\b/i.test(field));
    check(`${label}: field ${index} is plain text`, !/<[^>]+>|\*\*|```|\p{Extended_Pictographic}/u.test(field));
  }
  const text = plain(lesson.content);
  lesson.questions.forEach((item, index) => {
    const row = readingRow(label, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = Array.isArray(row.options) ? row.options : [];
    const gradable = { type: row.type, correctAnswer: row.correctAnswer, correctOptionIndex: row.correctOptionIndex, acceptedAnswers: row.acceptedAnswers ?? [], options };
    if (item.type === "TRUE_FALSE") {
      check(`${q}: answer true/false`, ["true", "false"].includes(item.answer));
      check(`${q}: wrong answer rejected`, !isAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has blank`, item.prompt.includes("______"));
      check(`${q}: answer occurs in passage`, new RegExp(`\\b${escapeRegex(item.answer.toLowerCase())}\\b`).test(text));
      check(`${q}: exact one/two-word answer in passage`, words(item.answer) >= 1 && words(item.answer) <= 2 && new RegExp(`\\b${escapeRegex(item.answer)}\\b`).test(lesson.content));
      check(`${q}: wrong answer rejected`, !isAnswerCorrect(gradable, "zzz"));
      for (const accepted of item.accepted ?? []) {
        check(`${q}: alternative accepted by scorer`, isAnswerCorrect(gradable, accepted));
      }
    } else {
      check(`${q}: four distinct options`, options.length === 4 && new Set(options).size === 4);
      check(`${q}: exactly one answer option`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: index points at answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: wrong option rejected`, !isAnswerCorrect(gradable, options.find((o) => o !== item.answer) ?? ""));
      check(`${q}: all distractors rejected`, options.filter((o) => o !== item.answer).every((o) => !isAnswerCorrect(gradable, o)));
      if (row.correctOptionIndex !== null) positions[row.correctOptionIndex]++;
    }
    if (item.type === "VOCAB_IN_CONTEXT") {
      const quoted = item.prompt.match(/"([^"]+)"/);
      check(`${q}: double-quoted passage vocabulary`, Boolean(quoted && lesson.content.includes(quoted[1])));
    }
    check(`${q}: stored answer accepted`, isAnswerCorrect(gradable, row.correctAnswer));
    check(`${q}: explanation over 20 characters`, item.explanation.length > 20);
  });
}
check("correct options use all four positions", positions.every((count) => count >= 3));
if (failures) {
  console.error(`FAIL ${checks} checks, ${failures} failures`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks} checks; 8 Reading lessons; option positions ${positions.join("/")}`);
}
