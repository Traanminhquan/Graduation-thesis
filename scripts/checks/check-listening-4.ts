/** Offline batch-four validation. Seed sources are read as text, never executed. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isListeningAnswerCorrect, normalizeAnswer } from "../../src/lib/listening/scoring";
import { splitSentences } from "../../src/lib/listening/speech";
import type { Cefr, Level } from "../content/lesson-bank-data";
import { listeningLessons4 } from "../content/lesson-bank-listening-4";
import { listeningRow } from "../content/lesson-bank-rows";

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
const limits: Record<Cefr, [number, number, Level, number]> = {
  A1: [100, 150, "BEGINNER", 2], A2: [150, 200, "BEGINNER", 2],
  B1: [180, 250, "INTERMEDIATE", 2], B2: [220, 300, "ADVANCED", 2],
  C1: [250, 300, "ADVANCED", 1],
};
const scriptsDir = resolve(import.meta.dirname, "../content");
const titleSources = readdirSync(scriptsDir)
  .filter((name) => /^(lesson-bank.*|seed.*)\.ts$/.test(name) && name !== "lesson-bank-listening-4.ts")
  .map((name) => resolve(scriptsDir, name));
titleSources.push(resolve(scriptsDir, "../../prisma/seed.ts"), resolve(scriptsDir, "../../src/lib/conversation/scenarios.ts"));
const existingTitles = new Set(titleSources.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/\btitle\s*:\s*"((?:\\.|[^"\\])*)"/g)]
    .map((entry) => normalizeAnswer(JSON.parse(`"${entry[1]}"`) as string))));
const lessons = listeningLessons4;
check("exact ids 34 through 42, in order", lessons.length === 9 && lessons.every((l, i) => l.id === `seed-listening-${34 + i}`));
check("unique ids", new Set(lessons.map((l) => l.id)).size === 9);
check("unique batch titles", new Set(lessons.map((l) => normalizeAnswer(l.title))).size === lessons.length);
check("unique type sequences", new Set(lessons.map((l) => l.questions.map((q) => q.type).join(","))).size === lessons.length);
check("at least half have six questions", lessons.filter((l) => l.questions.length === 6).length >= 5);
check("matching in at least five lessons", lessons.filter((l) => l.questions.some((q) => q.type === "MATCHING")).length >= 5);
for (const [cefr, [, , , count]] of Object.entries(limits)) {
  check(`${cefr} spread`, lessons.filter((l) => l.cefr === cefr).length === count);
}
const positions = new Set<number>();
for (const lesson of lessons) {
  const label = lesson.id;
  const n = words(lesson.transcript);
  const range = lesson.cefr ? limits[lesson.cefr] : undefined;
  check(`${label}: valid CEFR, matching difficulty and word range (${n})`, !!range && n >= range[0] && n <= range[1] && lesson.difficulty === range[2]);
  const minScript = lesson.cefr === "A1" ? 100 : 150;
  check(`${label}: base script length`, n >= minScript && n <= 300);
  check(`${label}: title new against existing sources`, !existingTitles.has(normalizeAnswer(lesson.title)));
  check(`${label}: five or six questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: at least three types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  check(`${label}: sentence punctuation`, (lesson.transcript.match(/[.!?]/g) ?? []).length >= 8);
  check(`${label}: eight playable sentences`, splitSentences(lesson.transcript).length >= 8);
  check(`${label}: distinct prompts`, new Set(lesson.questions.map((q) => q.prompt)).size === lesson.questions.length);
  check(`${label}: spoken numbers`, !/\d/.test(lesson.transcript));
  // Enumerate every learner-facing string, including answer aliases and pair values.
  const strings = [lesson.title, lesson.topic, lesson.transcript, ...lesson.questions.flatMap((q) =>
    [q.prompt, q.explanation, q.answer ?? "", ...(q.options ?? []), ...(q.accepted ?? []), ...(q.pairs ?? []).flatMap((p) => [p.left, p.right])])];
  check(`${label}: no forbidden words`, strings.every((s) => !/fictional|imaginary|invented|made-up|adult/i.test(s)));
  check(`${label}: plain learner text`, strings.every((s) => !/[<>`]|\p{Extended_Pictographic}/u.test(s)));
  const text = plain(lesson.transcript);
  lesson.questions.forEach((item, index) => {
    const row = listeningRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = row.options ?? [];
    const pairs = row.matchingPairs ?? [];
    const gradable = { type: row.type, correctAnswer: row.correctAnswer, correctOptionIndex: row.correctOptionIndex,
      acceptedAnswers: row.acceptedAnswers ?? [], options, matchingPairs: pairs };
    check(`${q}: explanation over twenty characters`, item.explanation.length > 20);
    check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
    if (item.type === "MATCHING") {
      check(`${q}: three or four pairs`, pairs.length >= 3 && pairs.length <= 4);
      check(`${q}: unique left values`, new Set(pairs.map((p) => p.left)).size === pairs.length);
      check(`${q}: unique right values`, new Set(pairs.map((p) => p.right)).size === pairs.length);
      check(`${q}: distinct normalized values`, new Set(pairs.flatMap((p) => [normalizeAnswer(p.left), normalizeAnswer(p.right)])).size === pairs.length * 2);
      const correct = JSON.stringify(Object.fromEntries(pairs.map((p) => [p.left, p.right])));
      check(`${q}: correct mapping accepted`, isListeningAnswerCorrect(gradable, correct));
      const swapped = Object.fromEntries(pairs.map((p, i) => [p.left, pairs[(i + 1) % pairs.length].right]));
      check(`${q}: swapped mapping rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(swapped)));
    } else if (item.type === "TRUE_FALSE") {
      check(`${q}: boolean answer`, ["true", "false"].includes(item.answer ?? ""));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: blank present`, item.prompt.includes("______"));
      const answer = item.answer ?? "";
      const escaped = answer.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      check(`${q}: canonical answer spoken exactly`, answer.length > 0 && new RegExp(`\\b${escaped}\\b`).test(text));
      check(`${q}: one or two words`, words(answer) >= 1 && words(answer) <= 2);
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, "zzz"));
    } else {
      check(`${q}: three or four distinct options`, options.length >= 3 && options.length <= 4 && new Set(options).size === options.length);
      check(`${q}: four normalized distinct options`, options.length === 4 && new Set(options.map(normalizeAnswer)).size === 4);
      check(`${q}: exactly one correct option`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: index points at answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      if (row.correctOptionIndex !== null) positions.add(row.correctOptionIndex);
      for (const wrong of options.filter((o) => o !== item.answer)) {
        check(`${q}: distractor rejected (${wrong})`, !isListeningAnswerCorrect(gradable, wrong));
      }
    }
  });
}
check("correct options occupy all four positions", [0, 1, 2, 3].every((p) => positions.has(p)));
if (failures) {
  console.error(`FAIL ${checks} checks, ${failures} failures`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks} offline Listening batch-four checks`);
}
