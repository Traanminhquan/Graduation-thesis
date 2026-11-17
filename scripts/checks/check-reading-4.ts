/** Offline batch check: pure row conversion and application grading only. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Cefr, Level } from "../content/lesson-bank-data";
import { readingLessons4 } from "../content/lesson-bank-reading-4";
import { readingRow } from "../content/lesson-bank-rows";
import { isAnswerCorrect, normalizeAnswer, READING_QUESTION_TYPES } from "../../src/lib/reading/scoring";

let checks = 0;
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}
const words = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const plain = (value: string) => value.toLowerCase().replace(/[^a-z0-9' -]/g, " ");
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const occurs = (text: string, answer: string) => new RegExp(`\\b${escape(answer)}\\b`, "i").test(text);
const levels: Record<Cefr, { count: number; min: number; max: number; difficulty: Level }> = {
  A1: { count: 2, min: 100, max: 150, difficulty: "BEGINNER" },
  A2: { count: 2, min: 150, max: 200, difficulty: "BEGINNER" },
  B1: { count: 2, min: 180, max: 250, difficulty: "INTERMEDIATE" },
  B2: { count: 2, min: 220, max: 300, difficulty: "ADVANCED" },
  C1: { count: 1, min: 250, max: 300, difficulty: "ADVANCED" },
};

// Read source text rather than importing seed modules, which may have side effects.
// Include every current batch, including other skills added alongside this one.
const sourceFiles = [
  ...readdirSync(path.join(__dirname, "../content"))
    .filter((name) => /^lesson-bank.*\.ts$/.test(name) && name !== "lesson-bank-reading-4.ts")
    .map((name) => path.join(__dirname, "../content", name)),
  ...["seed-listening.ts", "seed-writing.ts", "seed-speaking.ts"].map((name) => path.join(__dirname, "..", name)),
  path.join(__dirname, "../../prisma/seed.ts"),
  path.join(__dirname, "../../src/lib/conversation/scenarios.ts"),
];
const existingTitles = new Set(sourceFiles.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/\btitle\s*:\s*(["'`])([^\r\n]*?)\1/g)]
    .map((match) => match[2].trim().toLowerCase()),
));

const ids = readingLessons4.map((lesson) => lesson.id);
check("exactly ids 34 through 42, each once", ids.length === 9 && new Set(ids).size === 9 &&
  Array.from({ length: 9 }, (_, i) => `seed-reading-${34 + i}`).every((id) => ids.includes(id)));
check("no collision with original Reading ids", ids.every((id) => !["seed-reading-1", "seed-reading-2"].includes(id)));
const titles = readingLessons4.map((lesson) => lesson.title.trim().toLowerCase());
check("batch titles unique", new Set(titles).size === titles.length);
check("titles unique against all existing content", titles.every((title) => !existingTitles.has(title)));
check("at least half have six questions", readingLessons4.filter((lesson) => lesson.questions.length === 6).length >= 5);
const sequences = readingLessons4.map((lesson) => lesson.questions.map((q) => q.type).join(","));
check("all type sequences differ", new Set(sequences).size === readingLessons4.length);
check("main idea positions vary", new Set(readingLessons4.map((lesson) => lesson.questions.findIndex((q) => q.type === "MAIN_IDEA"))).size > 1);
for (const [cefr, rule] of Object.entries(levels)) {
  check(`${cefr}: required spread`, readingLessons4.filter((lesson) => lesson.cefr === cefr).length === rule.count);
}
const typeCounts = new Map<string, number>();
const positions = [0, 0, 0, 0];

for (const lesson of readingLessons4) {
  const label = lesson.id;
  const rule = lesson.cefr ? levels[lesson.cefr] : undefined;
  const n = words(lesson.content);
  check(`${label}: valid CEFR`, Boolean(rule));
  check(`${label}: CEFR word range`, Boolean(rule && n >= rule.min && n <= rule.max), `${n} words`);
  check(`${label}: difficulty matches CEFR`, lesson.difficulty === rule?.difficulty);
  check(`${label}: passage length`, n >= (lesson.cefr === "A1" ? 100 : 150) && n <= 300);
  check(`${label}: estimated minutes 4-8`, Number.isInteger(lesson.estimatedMinutes) && lesson.estimatedMinutes >= 4 && lesson.estimatedMinutes <= 8);
  check(`${label}: one-sentence summary`, /^[^.!?]+[.!?]$/.test(lesson.summary));
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: at least three types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  const prompts = lesson.questions.map((q) => q.prompt);
  check(`${label}: distinct prompts`, new Set(prompts).size === prompts.length);
  const text = plain(lesson.content);
  const facing = [lesson.title, lesson.topic, lesson.summary, lesson.content,
    ...lesson.questions.flatMap((q) => [q.prompt, q.answer, q.explanation, ...(q.options ?? []), ...(q.accepted ?? [])])];
  for (const [i, field] of facing.entries()) {
    check(`${label}: field ${i} has no forbidden words`, !/\b(?:fictional|imaginary|invented|made-up|adult)\b/i.test(field));
    check(`${label}: field ${i} is plain text`, !/<[^>]+>|\*\*|```|^\s*#|\p{Extended_Pictographic}/u.test(field));
  }

  lesson.questions.forEach((item, index) => {
    const row = readingRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = Array.isArray(row.options) ? row.options : [];
    const gradable = { type: row.type, correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex, acceptedAnswers: row.acceptedAnswers ?? [], options };
    typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
    check(`${q}: supported type`, READING_QUESTION_TYPES.includes(item.type));
    if (item.type === "TRUE_FALSE") {
      check(`${q}: true/false answer`, ["true", "false"].includes(item.answer));
      check(`${q}: wrong answer rejected`, !isAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has blank`, item.prompt.includes("______"));
      check(`${q}: answer in passage`, occurs(text, item.answer.toLowerCase()));
      check(`${q}: exact one or two word extract`, words(item.answer) >= 1 && words(item.answer) <= 2 && occurs(lesson.content, item.answer));
      check(`${q}: wrong answer rejected`, !isAnswerCorrect(gradable, "zzz"));
      for (const accepted of item.accepted ?? []) {
        check(`${q}: alternative accepted`, isAnswerCorrect(gradable, accepted));
        check(`${q}: alternative differs from canonical form`, normalizeAnswer(accepted) !== normalizeAnswer(item.answer));
      }
    } else {
      check(`${q}: four distinct options`, options.length === 4 && new Set(options).size === 4);
      check(`${q}: exactly one answer option`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: correct index`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: wrong option rejected`, !isAnswerCorrect(gradable, options.find((o) => o !== item.answer) ?? ""));
      for (const wrong of options.filter((o) => o !== item.answer)) {
        check(`${q}: each distractor rejected`, !isAnswerCorrect(gradable, wrong));
      }
      if (row.correctOptionIndex !== null) positions[row.correctOptionIndex] += 1;
    }
    if (item.type === "VOCAB_IN_CONTEXT") {
      const quoted = item.prompt.match(/"([^"]+)"/);
      check(`${q}: quoted vocabulary in passage`, Boolean(quoted && occurs(lesson.content, quoted[1])));
    }
    check(`${q}: stored answer accepted`, isAnswerCorrect(gradable, row.correctAnswer));
    check(`${q}: explanation over 20 characters`, item.explanation.length > 20);
  });
  console.log(`${label}: ${lesson.cefr}, ${n} words, ${lesson.questions.map((q) => q.type).join(" > ")}`);
}
for (const type of READING_QUESTION_TYPES) check(`${type}: at least three occurrences`, (typeCounts.get(type) ?? 0) >= 3);
check("correct options spread across four positions", positions.every((n) => n > 0) && Math.max(...positions) - Math.min(...positions) <= 1);
console.log(`Correct-option positions: ${positions.join(", ")}`);
process.exitCode = failures === 0 ? 0 : 1;
console.log(`${failures === 0 ? "PASS" : "FAIL"} ${checks} checks, ${failures} failures`);
