/**
 * Offline validation of the added lesson bank (no database, no network).
 *
 *   npx tsx scripts/check-lesson-bank.ts
 *
 * Grades every question through the application's own scoring functions:
 * the stored answer must be accepted and a wrong answer must be rejected.
 */
import { isAnswerCorrect as readingCorrect } from "../src/lib/reading/scoring";
import { isListeningAnswerCorrect } from "../src/lib/listening/scoring";
import {
  listeningLessons,
  readingLessons,
  speakingPrompts,
  writingPrompts,
} from "./lesson-bank-data";
import { listeningRow, readingRow } from "./lesson-bank-rows";

const EXISTING = {
  reading: ["seed-reading-1", "seed-reading-2"],
  listening: ["seed-listening-1", "seed-listening-2"],
  writing: ["seed-writing-1", "seed-writing-2", "seed-writing-3"],
  speaking: ["seed-speaking-1", "seed-speaking-2", "seed-speaking-3"],
};

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? `  (${detail})` : ""}`);
  }
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9' -]/g, " ");

function uniqueIds(label: string, ids: string[], existing: string[]) {
  check(`${label}: ids are unique`, new Set(ids).size === ids.length);
  check(
    `${label}: no id collides with an existing lesson`,
    ids.every((id) => !existing.includes(id)),
  );
}

uniqueIds("reading", readingLessons.map((l) => l.id), EXISTING.reading);
uniqueIds("listening", listeningLessons.map((l) => l.id), EXISTING.listening);
uniqueIds("writing", writingPrompts.map((p) => p.id), EXISTING.writing);
uniqueIds("speaking", speakingPrompts.map((p) => p.id), EXISTING.speaking);

const titles = [
  ...readingLessons,
  ...listeningLessons,
  ...writingPrompts,
  ...speakingPrompts,
].map((x) => x.title.toLowerCase());
check("titles are unique across the bank", new Set(titles).size === titles.length);

for (const lesson of readingLessons) {
  const label = lesson.id;
  const n = words(lesson.content);
  // A1 items are shorter on purpose.
  const minPassage = lesson.cefr === "A1" ? 100 : 150;
  check(`${label}: passage length ${minPassage}-300 words`, n >= minPassage && n <= 300, `${n} words`);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  const prompts = lesson.questions.map((q) => q.prompt);
  check(`${label}: question prompts are distinct`, new Set(prompts).size === prompts.length);
  const text = plain(lesson.content);

  lesson.questions.forEach((item, index) => {
    const row = readingRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = Array.isArray(row.options) ? (row.options as string[]) : [];
    const gradable = {
      type: row.type,
      correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex,
      acceptedAnswers: (row.acceptedAnswers as string[] | null) ?? [],
      options,
    };

    if (item.type === "TRUE_FALSE") {
      check(`${q}: answer is true/false`, ["true", "false"].includes(item.answer));
      check(`${q}: wrong answer rejected`, !readingCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has a blank`, item.prompt.includes("______"));
      check(`${q}: answer occurs in the passage`, new RegExp(`\\b${item.answer.toLowerCase()}\\b`).test(text));
      check(`${q}: wrong answer rejected`, !readingCorrect(gradable, "zzz"));
    } else {
      check(`${q}: four distinct options`, options.length === 4 && new Set(options).size === 4);
      check(`${q}: exactly one option equals the answer`, options.filter((o) => o === item.answer).length === 1);
      check(`${q}: index points at the answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      const wrong = options.find((o) => o !== item.answer) ?? "";
      check(`${q}: wrong option rejected`, !readingCorrect(gradable, wrong));
    }
    check(`${q}: stored answer is accepted`, readingCorrect(gradable, row.correctAnswer));
    check(`${q}: explanation present`, item.explanation.length > 20);
  });
}

for (const lesson of listeningLessons) {
  const label = lesson.id;
  const n = words(lesson.transcript);
  const minScript = lesson.cefr === "A1" ? 100 : 150;
  check(`${label}: script length ${minScript}-300 words`, n >= minScript && n <= 300, `${n} words`);
  check(`${label}: 5-6 questions`, lesson.questions.length >= 5 && lesson.questions.length <= 6);
  check(`${label}: script has sentence punctuation for the player`, (lesson.transcript.match(/[.!?]/g) ?? []).length >= 8);
  const text = plain(lesson.transcript);

  lesson.questions.forEach((item, index) => {
    const row = listeningRow(lesson.id, index, item);
    const q = `${label} q${index + 1} (${item.type})`;
    const options = Array.isArray(row.options) ? (row.options as string[]) : [];
    const pairs = (row.matchingPairs as { left: string; right: string }[] | null) ?? [];
    const gradable = {
      type: row.type,
      correctAnswer: row.correctAnswer,
      correctOptionIndex: row.correctOptionIndex,
      acceptedAnswers: (row.acceptedAnswers as string[] | null) ?? [],
      options,
      matchingPairs: pairs,
    };

    if (item.type === "MATCHING") {
      check(`${q}: 3+ pairs`, pairs.length >= 3);
      check(`${q}: left values unique`, new Set(pairs.map((p) => p.left)).size === pairs.length);
      check(`${q}: right values unique`, new Set(pairs.map((p) => p.right)).size === pairs.length);
      const correct = JSON.stringify(Object.fromEntries(pairs.map((p) => [p.left, p.right])));
      check(`${q}: correct mapping accepted`, isListeningAnswerCorrect(gradable, correct));
      const swapped = Object.fromEntries(pairs.map((p, i) => [p.left, pairs[(i + 1) % pairs.length].right]));
      check(`${q}: swapped mapping rejected`, !isListeningAnswerCorrect(gradable, JSON.stringify(swapped)));
    } else if (item.type === "TRUE_FALSE") {
      check(`${q}: answer is true/false`, ["true", "false"].includes(item.answer ?? ""));
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, item.answer === "true" ? "false" : "true"));
    } else if (item.type === "FILL_BLANK") {
      check(`${q}: prompt has a blank`, item.prompt.includes("______"));
      const spoken = [item.answer ?? "", ...(item.accepted ?? [])].some((a) => new RegExp(`\\b${a.toLowerCase()}\\b`).test(text));
      check(`${q}: answer (or accepted form) occurs in the script`, spoken);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong answer rejected`, !isListeningAnswerCorrect(gradable, "zzz"));
    } else {
      check(`${q}: three or four distinct options`, options.length >= 3 && options.length <= 4 && new Set(options).size === options.length);
      check(`${q}: index points at the answer`, row.correctOptionIndex !== null && options[row.correctOptionIndex] === item.answer);
      check(`${q}: stored answer accepted`, isListeningAnswerCorrect(gradable, row.correctAnswer));
      check(`${q}: wrong option rejected`, !isListeningAnswerCorrect(gradable, options.find((o) => o !== item.answer) ?? ""));
    }
    check(`${q}: explanation present`, item.explanation.length > 20);
  });
}

for (const prompt of writingPrompts) {
  check(`${prompt.id}: word range sensible`, prompt.minWords >= 40 && prompt.maxWords > prompt.minWords);
  check(`${prompt.id}: instruction text present`, words(prompt.promptText) >= 40);
}
for (const prompt of speakingPrompts) {
  check(`${prompt.id}: timings sensible`, prompt.preparationSeconds >= 10 && prompt.speakingSeconds >= 45 && prompt.speakingSeconds <= 180);
  check(`${prompt.id}: instruction text present`, words(prompt.promptText) >= 40);
}

const totals = {
  reading: EXISTING.reading.length + readingLessons.length,
  listening: EXISTING.listening.length + listeningLessons.length,
  writing: EXISTING.writing.length + writingPrompts.length,
  speaking: EXISTING.speaking.length + speakingPrompts.length,
};
for (const [skill, total] of Object.entries(totals)) {
  check(`${skill}: fifty in total`, total === 50, String(total));
}

// The position of the right option should not be predictable.
const positions = new Map<number, number>();
const tally = (index: number | null, hasOptions: boolean) => {
  if (index !== null && hasOptions) positions.set(index, (positions.get(index) ?? 0) + 1);
};
readingLessons.forEach((l) => l.questions.forEach((q, i) => tally(readingRow(l.id, i, q).correctOptionIndex, Boolean(q.options))));
listeningLessons.forEach((l) => l.questions.forEach((q, i) => tally(listeningRow(l.id, i, q).correctOptionIndex, Boolean(q.options))));
console.log("correct-option positions:", JSON.stringify([...positions.entries()].sort()));

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}  ${checks} checks, ${failures} failures`);
console.log(`totals after seeding: ${JSON.stringify(totals)}`);
process.exitCode = failures === 0 ? 0 : 1;
