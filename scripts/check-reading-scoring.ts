/**
 * Unit checks for the Reading grading rules (no database, no network).
 *
 *   npx tsx scripts/check-reading-scoring.ts
 */
import {
  isAnswerCorrect,
  normalizeAnswer,
  type GradableQuestion,
} from "../src/lib/reading/scoring";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

const mcq: GradableQuestion = {
  type: "MULTIPLE_CHOICE",
  correctAnswer: "Every Saturday morning",
  correctOptionIndex: 1,
  acceptedAnswers: [],
  options: ["Every evening", "Every Saturday morning", "Once a month", "Only in winter"],
};

const mainIdea: GradableQuestion = {
  type: "MAIN_IDEA",
  correctAnswer: "Mai's regular Saturday trip to the local market.",
  correctOptionIndex: 1,
  acceptedAnswers: [],
  options: [
    "Markets in the city are too crowded.",
    "Mai's regular Saturday trip to the local market.",
    "How to grow tomatoes at home.",
  ],
};

const vocab: GradableQuestion = {
  type: "VOCAB_IN_CONTEXT",
  correctAnswer: "Small shops or tables where goods are sold",
  correctOptionIndex: 0,
  acceptedAnswers: [],
  options: ["Small shops or tables where goods are sold", "Groups of customers"],
};

const trueFalse: GradableQuestion = {
  type: "TRUE_FALSE",
  correctAnswer: "false",
  correctOptionIndex: null,
  acceptedAnswers: [],
  options: [],
};

const fillBlank: GradableQuestion = {
  type: "FILL_BLANK",
  correctAnswer: "spaced",
  correctOptionIndex: null,
  acceptedAnswers: ["spaced", "Spaced"],
  options: [],
};

console.log("-- multiple choice --");
check("chosen correct option text", isAnswerCorrect(mcq, "Every Saturday morning"), true);
check("chosen wrong option text", isAnswerCorrect(mcq, "Every evening"), false);
check("answer matching correctOptionIndex text", isAnswerCorrect(mcq, mcq.options[1]), true);
check("case-insensitive option", isAnswerCorrect(mcq, "every saturday MORNING"), true);

console.log("-- main idea --");
check("correct main idea option", isAnswerCorrect(mainIdea, "Mai's regular Saturday trip to the local market."), true);
check("trailing punctuation is ignored", isAnswerCorrect(mainIdea, "Mai's regular Saturday trip to the local market"), true);
check("wrong main idea option", isAnswerCorrect(mainIdea, "Markets in the city are too crowded."), false);

console.log("-- vocabulary in context --");
check("correct definition", isAnswerCorrect(vocab, "Small shops or tables where goods are sold"), true);
check("wrong definition", isAnswerCorrect(vocab, "Groups of customers"), false);

console.log("-- true / false --");
check("stored lowercase false", isAnswerCorrect(trueFalse, "false"), true);
check("capitalised False", isAnswerCorrect(trueFalse, "False"), true);
check("uppercase FALSE", isAnswerCorrect(trueFalse, " FALSE "), true);
check("opposite answer", isAnswerCorrect(trueFalse, "true"), false);
check("empty answer", isAnswerCorrect(trueFalse, ""), false);

console.log("-- fill in the blank --");
check("exact word", isAnswerCorrect(fillBlank, "spaced"), true);
check("capitalised accepted answer", isAnswerCorrect(fillBlank, "Spaced"), true);
check("padded + trailing period", isAnswerCorrect(fillBlank, "  spaced. "), true);
check("wrong word", isAnswerCorrect(fillBlank, "massed"), false);
check("empty answer", isAnswerCorrect(fillBlank, "   "), false);
check("null response", isAnswerCorrect(fillBlank, null), false);

console.log("-- normalisation --");
check("collapses whitespace", normalizeAnswer("  spaced   practice "), "spaced practice");
check("curly apostrophes", normalizeAnswer("Mai\u2019s trip"), "mai's trip");
check("strips trailing punctuation", normalizeAnswer("corner?!"), "corner");
check("keeps inner punctuation", normalizeAnswer("Every Saturday, morning"), "every saturday, morning");

console.log("");
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
