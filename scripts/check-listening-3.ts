/** Offline content and application-grading checks; never executes seed files. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { isListeningAnswerCorrect, normalizeAnswer } from "../src/lib/listening/scoring";
import { splitSentences } from "../src/lib/listening/speech";
import type { Cefr, Level } from "./lesson-bank-data";
import { listeningRow } from "./lesson-bank-rows";
import { listeningLessons3 } from "./lesson-bank-listening-3";

let checks = 0;
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.error(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
  }
}
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9' -]/g, " ");
const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ranges: Record<Cefr, [number, number]> = {
  A1: [100, 150], A2: [150, 200], B1: [180, 250], B2: [220, 300], C1: [250, 300],
};
const levels: Record<Cefr, Level> = {
  A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED",
};

// Read source text rather than importing seed modules with database side effects.
// Include other lesson batches when present, including concurrently added batches.
const sourceFiles = [
  ...readdirSync(resolve("scripts"))
    .filter((name) => /^lesson-bank-.*\.ts$/.test(name) && name !== "lesson-bank-listening-3.ts")
    .map((name) => `scripts/${name}`),
  "prisma/seed.ts", "scripts/seed-listening.ts", "scripts/seed-writing.ts",
  "scripts/seed-speaking.ts", "src/lib/conversation/scenarios.ts",
];
const existingTitles = new Set(sourceFiles.flatMap((file) =>
  Array.from(readFileSync(resolve(file), "utf8").matchAll(/\btitle\s*:\s*(["'`])([^\r\n]*?)\1/g),
    (match) => normalizeAnswer(match[2]))));
const ids = listeningLessons3.map((lesson) => lesson.id);
check("exactly ids twenty-five through thirty-three", ids.length === 9 &&
  new Set(ids).size === 9 && Array.from({ length: 9 }, (_, i) => `seed-listening-${i + 25}`).every((id) => ids.includes(id)));
const titles = listeningLessons3.map((lesson) => normalizeAnswer(lesson.title));
check("new titles unique", new Set(titles).size === titles.length);
check("no existing title reused", titles.every((title) => !existingTitles.has(title)));
for (const [cefr, expected] of Object.entries({ A1: 2, A2: 2, B1: 2, B2: 2, C1: 1 })) {
  check(`${cefr}: required count`, listeningLessons3.filter((lesson) => lesson.cefr === cefr).length === expected);
}
check("at least half have six questions", listeningLessons3.filter((lesson) => lesson.questions.length === 6).length >= 5);
check("matching in at least five lessons", listeningLessons3.filter((lesson) => lesson.questions.some((q) => q.type === "MATCHING")).length >= 5);
const sequences = listeningLessons3.map((lesson) => lesson.questions.map((q) => q.type).join(","));
check("type sequences unique", new Set(sequences).size === sequences.length);
const positions = [0, 0, 0, 0];
const forbidden = /fictional|imaginary|invented|made-up|adult/i;
function learnerStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(learnerStrings);
  if (value && typeof value === "object") return Object.entries(value)
    .filter(([key]) => !["id", "type", "difficulty", "cefr"].includes(key))
    .flatMap(([, child]) => learnerStrings(child));
  return [];
}

for (const lesson of listeningLessons3) {
  const label = lesson.id;
  const n = words(lesson.transcript);
  const range = lesson.cefr ? ranges[lesson.cefr] : undefined;
  check(`${label}: CEFR word range`, Boolean(range && n >= range[0] && n <= range[1]), `${n} words`);
  check(`${label}: difficulty matches CEFR`, Boolean(lesson.cefr && lesson.difficulty === levels[lesson.cefr]));
  // The original minimum of 150 is replaced only for this batch's A1 lessons.
  check(`${label}: bank script length`, n >= (lesson.cefr === "A1" ? 100 : 150) && n <= 300);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: script has sentence punctuation for the player`, (lesson.transcript.match(/[.!?]/g) ?? []).length >= 8);
  check(`${label}: eight playable sentences`, splitSentences(lesson.transcript).length >= 8);
  check(`${label}: numbers written for speech`, !/\d/.test(lesson.transcript));
  check(`${label}: no stage directions or lists`, !/[\[\]\n]/.test(lesson.transcript));
  const strings = learnerStrings(lesson);
  check(`${label}: no forbidden learner text`, strings.every((value) => !forbidden.test(value)));
  check(`${label}: plain learner text`, strings.every((value) => !/[<>*_`#]|\p{Extended_Pictographic}/u.test(value.replace(/______/g, ""))));
  check(`${label}: at least three question types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  check(`${label}: distinct prompts`, new Set(lesson.questions.map((q) => q.prompt)).size === lesson.questions.length);
  const text = plain(lesson.transcript);

  lesson.questions.forEach((item, index) => {
    const row = listeningRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = row.options ?? [];
    const pairs = row.matchingPairs ?? [];
    const gradable = { type: row.type, correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex, acceptedAnswers: row.acceptedAnswers ?? [], options, matchingPairs: pairs };
    if (item.type === "MATCHING") {
      check(`${q}: three or four pairs`, pairs.length >= 3 && pairs.length <= 4);
      check(`${q}: left values unique`, new Set(pairs.map((p) => normalizeAnswer(p.left))).size === pairs.length);
      check(`${q}: right values unique`, new Set(pairs.map((p) => normalizeAnswer(p.right))).size === pairs.length);
      const correct = JSON.stringify(Object.fromEntries(pairs.map((p) => [p.left, p.right])));
      check(`${q}: correct mapping accepted`, isListeningAnswerCorrect(gradable, correct));
      // Swap only two entries so an otherwise complete mapping must still fail.
      const swapped = Object.fromEntries(pairs.map((p, i) => [p.left, pairs[i === 0 ? 1 : i === 1 ? 0 : i]?.right ?? ""]));
      check(`${q}: swapped mapping rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(swapped)));
    } else if (item.type === "TRUE_FALSE") {
      check(`${q}: answer is true/false`, ["true", "false"].includes(item.answer ?? ""));
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has a blank`, item.prompt.includes("______"));
      const spoken = [item.answer ?? "", ...(item.accepted ?? [])].some((answer) =>
        Boolean(answer) && new RegExp(`\\b${escapeRegex(answer.toLowerCase())}\\b`).test(text));
      check(`${q}: answer or accepted form occurs in script`, spoken);
      check(`${q}: canonical answer spoken exactly`, Boolean(item.answer) &&
        new RegExp(`\\b${escapeRegex(item.answer ?? "")}\\b`).test(lesson.transcript));
      check(`${q}: one or two answer words`, words(item.answer ?? "") >= 1 && words(item.answer ?? "") <= 2);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, "zzz"));
    } else {
      check(`${q}: three or four distinct options`, options.length >= 3 && options.length <= 4 && new Set(options).size === options.length);
      check(`${q}: four options`, options.length === 4);
      check(`${q}: exactly one correct option`, options.filter((option) => option === item.answer).length === 1);
      check(`${q}: index points at answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong option rejected`, !isListeningAnswerCorrect(gradable, options.find((option) => option !== item.answer) ?? ""));
      check(`${q}: all distractors rejected`, options.filter((option) => option !== item.answer).every((option) => !isListeningAnswerCorrect(gradable, option)));
      if (row.correctOptionIndex !== null) positions[row.correctOptionIndex]++;
    }
    check(`${q}: explanation present`, item.explanation.length > 20);
  });
  console.log(`${label} | ${lesson.title} | ${lesson.cefr} | ${n} words | ${lesson.questions.map((q) => q.type).join(", ")}`);
}
check("correct choices cover all four positions", positions.every((count) => count > 0));
console.log(`Correct-option positions: ${positions.join(", ")}`);
process.exitCode = failures === 0 ? 0 : 1;
console.log(`${failures === 0 ? "PASS" : "FAIL"} ${checks} checks, ${failures} failures`);
