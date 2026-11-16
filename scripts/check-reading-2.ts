/** Offline validation only: never import seed runners or check-lesson-bank.ts. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAnswerCorrect as readingCorrect, READING_QUESTION_TYPES } from "../src/lib/reading/scoring";
import { readingRow } from "./lesson-bank-rows";
import { readingLessons2 } from "./lesson-bank-reading-2";

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9' -]/g, " ");
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const titleKey = (text: string) => text.normalize("NFKC").trim().toLowerCase();
// Read source text, never execute seed files (which can connect to a database).
const titleSources = [
  "scripts/lesson-bank-data.ts", "scripts/lesson-bank-more-reading-listening.ts",
  "scripts/lesson-bank-more-prompts.ts", "prisma/seed.ts", "scripts/seed-listening.ts",
  "scripts/seed-writing.ts", "scripts/seed-speaking.ts", "src/lib/conversation/scenarios.ts",
];
const existingTitles = new Set(titleSources.flatMap((file) => {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  return [...source.matchAll(/\btitle\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[^`]*`)/g)]
    .map((match) => titleKey(match[1].slice(1, -1)));
}));
const ids = readingLessons2.map((lesson) => lesson.id);
check("ids are unique", new Set(ids).size === ids.length);
check("ids exactly 13 to 24", ids.length === 12 && Array.from({ length: 12 }, (_, i) => `seed-reading-${i + 13}`).every((id) => ids.includes(id)));
const titles = readingLessons2.map((lesson) => titleKey(lesson.title));
check("new titles are unique", new Set(titles).size === titles.length);
check("titles do not collide with any existing source", titles.every((title) => !existingTitles.has(title)));
for (const level of ["BEGINNER", "INTERMEDIATE", "ADVANCED"]) {
  check(`four ${level} lessons`, readingLessons2.filter((lesson) => lesson.difficulty === level).length === 4);
}
check("at least half have six questions", readingLessons2.filter((lesson) => lesson.questions.length === 6).length >= 6);
const sequences = readingLessons2.map((lesson) => lesson.questions.map((q) => q.type).join(","));
check("type sequences are unique", new Set(sequences).size === sequences.length);
check("main idea is not always last", readingLessons2.some((lesson) => lesson.questions.at(-1)?.type !== "MAIN_IDEA"));
const counts = new Map<string, number>();
const positions = [0, 0, 0, 0];
const forbidden = /\b(?:fictional|imaginary|invented|made-up|adult)\b/i;

for (const lesson of readingLessons2) {
  const label = lesson.id;
  const n = words(lesson.content);
  check(`${label}: passage length 150-300 words`, n >= 150 && n <= 300, `${n} words`);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: estimated minutes 4-8`, Number.isInteger(lesson.estimatedMinutes) && lesson.estimatedMinutes >= 4 && lesson.estimatedMinutes <= 8);
  check(`${label}: one-sentence summary`, /^[^.!?]+[.!?]$/.test(lesson.summary));
  check(`${label}: at least three types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  const prompts = lesson.questions.map((q) => q.prompt);
  check(`${label}: question prompts are distinct`, new Set(prompts).size === prompts.length);
  const text = plain(lesson.content);
  const learnerFields = [lesson.title, lesson.topic, lesson.summary, lesson.content];

  lesson.questions.forEach((item, index) => {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
    learnerFields.push(item.prompt, item.answer, item.explanation, ...(item.options ?? []), ...(item.accepted ?? []));
    const row = readingRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = Array.isArray(row.options) ? row.options : [];
    const gradable = {
      type: row.type, correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex,
      acceptedAnswers: row.acceptedAnswers ?? [], options,
    };
    check(`${q}: known type`, READING_QUESTION_TYPES.includes(item.type));
    if (item.type === "TRUE_FALSE") {
      check(`${q}: answer is true/false`, ["true", "false"].includes(item.answer));
      check(`${q}: wrong answer rejected`, !readingCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has a blank`, item.prompt.includes("______"));
      check(`${q}: answer occurs in the passage`, new RegExp(`\\b${escapeRegex(item.answer.toLowerCase())}\\b`).test(text));
      check(`${q}: exact one or two word answer`, words(item.answer) >= 1 && words(item.answer) <= 2 && lesson.content.includes(item.answer));
      check(`${q}: wrong answer rejected`, !readingCorrect(gradable, "zzz"));
    } else {
      check(`${q}: four distinct options`, options.length === 4 && new Set(options).size === 4);
      check(`${q}: exactly one option equals the answer`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: index points at the answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: wrong option rejected`, !readingCorrect(gradable, options.find((o) => o !== item.answer) ?? ""));
      check(`${q}: every distractor rejected`, options.filter((o) => o !== item.answer).every((o) => !readingCorrect(gradable, o)));
      if (row.correctOptionIndex !== null) positions[row.correctOptionIndex] += 1;
      if (item.type === "VOCAB_IN_CONTEXT") {
        const quoted = item.prompt.match(/"([^"]+)"/);
        check(`${q}: quoted vocabulary occurs in passage`, Boolean(quoted && lesson.content.includes(quoted[1])));
      }
    }
    check(`${q}: stored answer is accepted`, readingCorrect(gradable, row.correctAnswer));
    check(`${q}: explanation present`, item.explanation.length > 20);
    for (const alternative of item.accepted ?? []) {
      check(`${q}: accepted alternative is graded correctly`, readingCorrect(gradable, alternative));
    }
  });
  check(`${label}: no forbidden learner-facing words`, learnerFields.every((field) => !forbidden.test(field)));
  check(`${label}: plain learner-facing text`, learnerFields.every((field) => !/<[^>]*>|\*\*|`|\p{Extended_Pictographic}/u.test(field)));
}
for (const type of READING_QUESTION_TYPES) check(`${type}: at least four occurrences`, (counts.get(type) ?? 0) >= 4);
check("correct options spread across all four positions", positions.every((count) => count > 0));
console.log(`correct-option positions: ${JSON.stringify(positions)}`);
process.exitCode = failures === 0 ? 0 : 1;
console.log(`${failures === 0 ? "PASS" : "FAIL"} ${checks} checks, ${failures} failures`);
