/** Offline batch check. Reads source titles without executing any seed script. */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { isListeningAnswerCorrect, normalizeAnswer } from "../../src/lib/listening/scoring";
import { splitSentences } from "../../src/lib/listening/speech";
import type { Cefr, Level } from "../content/lesson-bank-data";
import { listeningLessons5 } from "../content/lesson-bank-listening-5";
import { listeningRow } from "../content/lesson-bank-rows";

let checks = 0;
let failures = 0;
function check(label: string, ok: boolean) {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9' -]/g, " ");
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const spoken = (text: string, answer: string) => Boolean(answer.trim()) && new RegExp(`\\b${escaped(answer.toLowerCase())}\\b`).test(plain(text));
const titleKey = (title: string) => normalizeAnswer(title);
const existingTitles = new Set<string>();
const titleSources = [
  ...readdirSync(path.resolve("scripts/content"))
    .filter((name) => /^lesson-bank.*\.ts$/.test(name) && name !== "lesson-bank-listening-5.ts")
    .map((name) => `scripts/content/${name}`),
  "prisma/seed.ts", "scripts/seed-listening.ts", "scripts/seed-writing.ts",
  "scripts/seed-speaking.ts", "src/lib/conversation/scenarios.ts",
];
for (const filename of titleSources) {
  const source = ts.createSourceFile(filename, readFileSync(filename, "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) &&
        ((ts.isIdentifier(node.name) && node.name.text === "title") ||
         (ts.isStringLiteral(node.name) && node.name.text === "title")) &&
        (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
      existingTitles.add(titleKey(node.initializer.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const ranges: Record<Cefr, [number, number]> = {
  A1: [100, 150], A2: [150, 200], B1: [180, 250], B2: [220, 300], C1: [250, 300],
};
const levels: Record<Cefr, Level> = {
  A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED",
};
const expectedSpread: Record<Cefr, number> = { A1: 2, A2: 2, B1: 2, B2: 1, C1: 1 };
const expectedIds = Array.from({ length: 8 }, (_, i) => `seed-listening-${43 + i}`);
check("exactly eight lessons with ids 43 through 50", listeningLessons5.length === 8 &&
  new Set(listeningLessons5.map((lesson) => lesson.id)).size === 8 &&
  expectedIds.every((id) => listeningLessons5.some((lesson) => lesson.id === id)));
for (const [cefr, count] of Object.entries(expectedSpread)) {
  check(`${cefr}: expected ${count} lessons`, listeningLessons5.filter((lesson) => lesson.cefr === cefr).length === count);
}
const titles = listeningLessons5.map((lesson) => titleKey(lesson.title));
check("batch titles unique", new Set(titles).size === titles.length);
check("titles unique against all existing source titles", titles.every((title) => !existingTitles.has(title)));
const sequences = listeningLessons5.map((lesson) => lesson.questions.map((item) => item.type).join(","));
check("type sequences unique", new Set(sequences).size === sequences.length);
check("at least half have six questions", listeningLessons5.filter((lesson) => lesson.questions.length === 6).length >= 4);
check("at least five lessons include matching", listeningLessons5.filter((lesson) => lesson.questions.some((item) => item.type === "MATCHING")).length >= 5);
const positions = [0, 0, 0, 0];

for (const lesson of listeningLessons5) {
  const label = lesson.id;
  const cefr = lesson.cefr;
  check(`${label}: valid CEFR`, cefr !== undefined && Object.hasOwn(ranges, cefr));
  if (!cefr || !Object.hasOwn(ranges, cefr)) continue;
  const n = words(lesson.transcript);
  const [min, max] = ranges[cefr];
  check(`${label}: ${min}-${max} words (got ${n})`, n >= min && n <= max);
  check(`${label}: difficulty matches CEFR`, lesson.difficulty === levels[cefr]);
  // Listening rules copied from check-lesson-bank.ts, with the batch's stricter ranges above.
  const minScript = cefr === "A1" ? 100 : 150;
  check(`${label}: script length ${minScript}-300 words`, n >= minScript && n <= 300);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: sentence punctuation for player`, (lesson.transcript.match(/[.!?]/g) ?? []).length >= 8);
  check(`${label}: eight playable sentences`, splitSentences(lesson.transcript).length >= 8);
  check(`${label}: numbers written for speech`, !/\d/.test(lesson.transcript));
  check(`${label}: at least three types`, new Set(lesson.questions.map((item) => item.type)).size >= 3);
  check(`${label}: distinct prompts`, new Set(lesson.questions.map((item) => item.prompt)).size === lesson.questions.length);
  const learnerFields = [lesson.title, lesson.topic, lesson.transcript];

  lesson.questions.forEach((item, index) => {
    const row = listeningRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = row.options ?? [];
    const pairs = row.matchingPairs ?? [];
    const gradable = {
      type: row.type,
      correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex,
      acceptedAnswers: row.acceptedAnswers ?? [],
      options,
      matchingPairs: pairs,
    };
    learnerFields.push(item.prompt, item.explanation, item.answer ?? "", ...(item.accepted ?? []),
      ...options, ...pairs.flatMap((pair) => [pair.left, pair.right]));
    if (item.type === "MATCHING") {
      check(`${q}: 3+ pairs`, pairs.length >= 3);
      check(`${q}: three or four pairs`, pairs.length === 3 || pairs.length === 4);
      check(`${q}: left values unique`, new Set(pairs.map((pair) => normalizeAnswer(pair.left))).size === pairs.length);
      check(`${q}: right values unique`, new Set(pairs.map((pair) => normalizeAnswer(pair.right))).size === pairs.length);
      check(`${q}: all pair values distinct`, new Set(pairs.flatMap((pair) => [normalizeAnswer(pair.left), normalizeAnswer(pair.right)])).size === pairs.length * 2);
      const correct = JSON.stringify(Object.fromEntries(pairs.map((pair) => [pair.left, pair.right])));
      check(`${q}: correct mapping accepted`, isListeningAnswerCorrect(gradable, correct));
      const swapped = Object.fromEntries(pairs.map((pair, i) => [pair.left, pairs[(i + 1) % pairs.length].right]));
      check(`${q}: swapped mapping rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(swapped)));
      if (pairs.length >= 2) {
        const singleSwap = Object.fromEntries(pairs.map((pair) => [pair.left, pair.right]));
        singleSwap[pairs[0].left] = pairs[1].right;
        singleSwap[pairs[1].left] = pairs[0].right;
        check(`${q}: swapping only two rights rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(singleSwap)));
      }
    } else if (item.type === "TRUE_FALSE") {
      check(`${q}: true/false answer`, ["true", "false"].includes(item.answer ?? ""));
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has a blank`, item.prompt.includes("______"));
      check(`${q}: answer or accepted form spoken`, [item.answer ?? "", ...(item.accepted ?? [])].some((answer) => spoken(lesson.transcript, answer)));
      check(`${q}: canonical answer spoken exactly`, spoken(lesson.transcript, item.answer ?? ""));
      check(`${q}: answer is one or two words`, words(item.answer ?? "") >= 1 && words(item.answer ?? "") <= 2);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, "zzz"));
    } else {
      check(`${q}: three or four distinct options`, options.length >= 3 && options.length <= 4 && new Set(options).size === options.length);
      check(`${q}: four options`, options.length === 4);
      check(`${q}: exactly one option equals answer`, options.filter((option) => option === item.answer).length === 1);
      check(`${q}: index points at answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong option rejected`, !isListeningAnswerCorrect(gradable, options.find((option) => option !== item.answer) ?? ""));
      check(`${q}: every distractor rejected`, options.filter((option) => option !== item.answer).every((option) => !isListeningAnswerCorrect(gradable, option)));
      if (row.correctOptionIndex !== null) positions[row.correctOptionIndex] += 1;
    }
    check(`${q}: explanation present`, item.explanation.length > 20);
    check(`${q}: stored key accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
  });
  check(`${label}: no forbidden learner-facing words`, learnerFields.every((field) => !/\b(?:fictional|imaginary|invented|made-up|adult)\b/i.test(field)));
  check(`${label}: plain learner-facing text`, learnerFields.every((field) => !/[<>`#*]|\p{Extended_Pictographic}/u.test(field)));
  console.log(`${label} | ${lesson.title} | ${cefr} | ${n} words | ${lesson.questions.map((item) => item.type).join(", ")}`);
}
check("correct option appears in all four positions", positions.every((count) => count > 0));
check("correct option positions reasonably balanced", Math.max(...positions) - Math.min(...positions) <= 2);
console.log(`Correct-option positions: ${positions.join(", ")}`);
process.exitCode = failures === 0 ? 0 : 1;
console.log(`${failures === 0 ? "PASS" : "FAIL"} ${checks} checks, ${failures} failures`);
