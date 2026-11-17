/** Offline content and application-grading checks; never imports seed runners. */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { isListeningAnswerCorrect } from "../../src/lib/listening/scoring";
import { splitSentences } from "../../src/lib/listening/speech";
import { listeningLessons2 } from "../content/lesson-bank-listening-2";
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
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const titleKey = (text: string) => text.normalize("NFKC").trim().toLowerCase();

// Parse source literals without executing files that instantiate Prisma clients.
// Include other content batches when present, as well as all required originals.
const root = resolve(import.meta.dirname, "../..");
const titleFiles = [
  ...readdirSync(resolve(root, "scripts/content"))
    .filter((name) => /^lesson-bank.*\.ts$/.test(name) && name !== "lesson-bank-listening-2.ts")
    .map((name) => `scripts/content/${name}`),
  "prisma/seed.ts",
  "scripts/seed-listening.ts",
  "scripts/seed-writing.ts",
  "scripts/seed-speaking.ts",
  "src/lib/conversation/scenarios.ts",
];
const existingTitles = new Set<string>();
for (const file of titleFiles) {
  const source = ts.createSourceFile(file, readFileSync(resolve(root, file), "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source).replace(/["']/g, "") === "title" &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))) {
      existingTitles.add(titleKey(node.initializer.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
check("existing title sources were read", existingTitles.size >= 50);
const expectedIds = Array.from({ length: 12 }, (_, i) => `seed-listening-${i + 13}`);
const ids = listeningLessons2.map((l) => l.id);
check("exactly ids thirteen to twenty-four", ids.length === 12 && new Set(ids).size === 12 && expectedIds.every((id) => ids.includes(id)));
for (const level of ["BEGINNER", "INTERMEDIATE", "ADVANCED"]) {
  check(`four lessons at ${level}`, listeningLessons2.filter((l) => l.difficulty === level).length === 4);
}
const titles = listeningLessons2.map((l) => titleKey(l.title));
check("new titles unique", new Set(titles).size === titles.length);
check("no existing title reused", titles.every((title) => !existingTitles.has(title)));
const sequences = listeningLessons2.map((l) => l.questions.map((q) => q.type).join(","));
check("distinct question type sequences", new Set(sequences).size === sequences.length);
check("at least half have six questions", listeningLessons2.filter((l) => l.questions.length === 6).length >= 6);
check("matching in at least six lessons", listeningLessons2.filter((l) => l.questions.some((q) => q.type === "MATCHING")).length >= 6);
const positions = [0, 0, 0, 0];

for (const lesson of listeningLessons2) {
  const label = lesson.id;
  const n = words(lesson.transcript);
  check(`${label}: script length 150-300 words (${n})`, n >= 150 && n <= 300);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: script has sentence punctuation for the player`, (lesson.transcript.match(/[.!?]/g) ?? []).length >= 8);
  check(`${label}: player produces eight sentences`, splitSentences(lesson.transcript).length >= 8);
  check(`${label}: spoken numbers`, !/\d/.test(lesson.transcript));
  check(`${label}: three question types`, new Set(lesson.questions.map((q) => q.type)).size >= 3);
  check(`${label}: distinct prompts`, new Set(lesson.questions.map((q) => q.prompt)).size === lesson.questions.length);
  const learnerFields = [lesson.title, lesson.topic, lesson.transcript,
    ...lesson.questions.flatMap((q) => [q.prompt, q.explanation, q.answer ?? "", ...(q.options ?? []), ...(q.accepted ?? []), ...(q.pairs ?? []).flatMap((p) => [p.left, p.right])])];
  for (const [i, value] of learnerFields.entries()) {
    check(`${label}: field ${i} has no forbidden words`, !/\b(?:fictional|imaginary|invented|made-up|adult)\b/i.test(value));
    check(`${label}: field ${i} is plain English text`, !/[<>*#`\[\]{}]|[^\x20-\x7e\r\n]/.test(value));
  }
  const text = plain(lesson.transcript);
  lesson.questions.forEach((item, index) => {
    const row = listeningRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = Array.isArray(row.options) ? row.options : [];
    const pairs = row.matchingPairs ?? [];
    const gradable = {
      type: row.type,
      correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex,
      acceptedAnswers: row.acceptedAnswers ?? [],
      options,
      matchingPairs: pairs,
    };
    // These branches copy every Listening rule in check-lesson-bank.ts.
    if (item.type === "MATCHING") {
      check(`${q}: 3+ pairs`, pairs.length >= 3);
      check(`${q}: no more than four pairs`, pairs.length <= 4);
      check(`${q}: left values unique`, new Set(pairs.map((p) => p.left)).size === pairs.length);
      check(`${q}: right values unique`, new Set(pairs.map((p) => p.right)).size === pairs.length);
      check(`${q}: all pair values distinct`, new Set(pairs.flatMap((p) => [p.left, p.right])).size === pairs.length * 2);
      const correct = JSON.stringify(Object.fromEntries(pairs.map((p) => [p.left, p.right])));
      check(`${q}: correct mapping accepted`, isListeningAnswerCorrect(gradable, correct));
      const swapped = Object.fromEntries(pairs.map((p, i) => [p.left, pairs[(i + 1) % pairs.length].right]));
      check(`${q}: swapped mapping rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(swapped)));
      // Also test a single transposition, leaving the remaining pairs correct.
      if (pairs.length >= 2) {
        const transposed = Object.fromEntries(pairs.map((p) => [p.left, p.right]));
        transposed[pairs[0].left] = pairs[1].right;
        transposed[pairs[1].left] = pairs[0].right;
        check(`${q}: two swapped values rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(transposed)));
      }
    } else if (item.type === "TRUE_FALSE") {
      check(`${q}: answer is true/false`, ["true", "false"].includes(item.answer ?? ""));
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has a blank`, item.prompt.includes("______"));
      const spoken = [item.answer ?? "", ...(item.accepted ?? [])].some((a) => new RegExp(`\\b${escape(a.toLowerCase())}\\b`).test(text));
      check(`${q}: answer (or accepted form) occurs in the script`, spoken);
      const answer = item.answer ?? "";
      check(`${q}: canonical answer is one or two spoken words`, words(answer) >= 1 && words(answer) <= 2 && new RegExp(`\\b${escape(answer)}\\b`, "i").test(lesson.transcript));
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, "zzz"));
    } else {
      check(`${q}: three or four distinct options`, options.length >= 3 && options.length <= 4 && new Set(options).size === options.length);
      check(`${q}: four options`, options.length === 4);
      check(`${q}: index points at the answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: exactly one option equals answer`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong option rejected`, !isListeningAnswerCorrect(gradable, options.find((o) => o !== item.answer) ?? ""));
      options.filter((o) => o !== item.answer).forEach((o) => check(`${q}: distractor rejected: ${o}`, !isListeningAnswerCorrect(gradable, o)));
      if (row.correctOptionIndex !== null) positions[row.correctOptionIndex]++;
    }
    check(`${q}: explanation present`, item.explanation.length > 20);
  });
}
check("correct options spread across four positions", positions.every((n) => n > 0) && Math.max(...positions) - Math.min(...positions) <= 1);
console.log(`correct-option positions: ${JSON.stringify(positions)}`);
console.log(`${failures === 0 ? "PASS" : "FAIL"} ${checks} checks, ${failures} failures`);
process.exitCode = failures === 0 ? 0 : 1;
