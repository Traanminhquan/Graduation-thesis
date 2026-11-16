/**
 * Unit checks for the Writing analysis and validation helpers.
 * No database, no network, no AI call: every case is built in memory.
 *
 *   npx tsx scripts/check-writing-analysis.ts
 */
import {
  analyseWriting,
  averageSentenceLength,
  countWords,
  evaluateWordTarget,
  findRepeatedWords,
  splitSentences,
} from "../src/lib/writing/analysis";
import {
  cleanWritingText,
  MAX_WRITING_CHARACTERS,
  MIN_WRITING_CHARACTERS,
  validateWritingText,
} from "../src/lib/writing/validation";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${
      ok
        ? ""
        : `\n      got  ${JSON.stringify(actual)}\n      want ${JSON.stringify(expected)}`
    }`,
  );
}

function sentenceCount(text: string): number {
  return splitSentences(text).length;
}

console.log("-- word counting --");
check("empty string", countWords(""), 0);
check("whitespace only", countWords("   \n\t  "), 0);
check("two plain words", countWords("Hello world"), 2);
check("apostrophe stays inside a word", countWords("I'm learning English."), 3);
check("comma without space is not a separator", countWords("hello, world!"), 2);
check("spaced em dash is not a word", countWords("word — word"), 2);
check("unspaced em dash splits a word pair", countWords("word—word"), 2);
check("punctuation only", countWords("... !!! ???"), 0);
check("collapsed whitespace", countWords("  Hello   world  "), 2);
check("newlines separate words", countWords("one\ntwo"), 2);
check("decimal point does not split", countWords("3.5 hours"), 2);
check("hyphenated word is one word", countWords("well-known idea"), 2);
check("curly apostrophe is normalised", countWords("don’t stop"), 2);
check("digits count as a word", countWords("12345"), 1);
check("non-breaking space separates", countWords("one\u00A0two"), 2);

console.log("-- sentence splitting --");
check("empty string has no sentence", sentenceCount(""), 0);
check("whitespace has no sentence", sentenceCount("   \n "), 0);
check("no terminal punctuation is one sentence", sentenceCount("one sentence here"), 1);
check("three terminals give three sentences", sentenceCount("First. Second! Third?"), 3);
check("closing quote stays with its sentence", sentenceCount('He said "Hello." Then he left.'), 2);
check("ellipsis is treated as a boundary (heuristic)", sentenceCount("Wait... what?"), 2);
check("decimal point is not a boundary", sentenceCount("3.5 hours is enough."), 1);
check("punctuation only has no sentence", sentenceCount("!!! ??? ..."), 0);
check("blank line is a boundary", sentenceCount("First line.\n\nSecond line."), 2);
check("mixed blank line and terminal punctuation", sentenceCount("One. Two\n\nThree."), 3);
check("single trailing full stop", sentenceCount("Trailing punctuation only."), 1);
check("newline without a full stop", sentenceCount("Line one\nLine two"), 2);
check("dialogue with a quoted question", sentenceCount('He asked, "Ready?" She nodded.'), 2);

console.log("-- average sentence length --");
check("10 words over 2 sentences", averageSentenceLength(10, 2), 5);
check("rounds to one decimal", averageSentenceLength(5, 2), 2.5);
check("rounds 3.333 to 3.3", averageSentenceLength(10, 3), 3.3);
check("rounds 6.666 to 6.7", averageSentenceLength(20, 3), 6.7);
check("no sentence -> null", averageSentenceLength(5, 0), null);
check("empty text -> null", averageSentenceLength(0, 0), null);
check("negative words -> null", averageSentenceLength(-1, 2), null);
check("NaN -> null", averageSentenceLength(Number.NaN, 3), null);

console.log("-- repeated words --");
check(
  "counts content words and sorts by frequency",
  findRepeatedWords(
    "Students need practice. Students need feedback. Students need time.",
  ),
  [
    { word: "need", count: 3 },
    { word: "students", count: 3 },
  ],
);
check(
  "stop words are ignored",
  findRepeatedWords("because because because because"),
  [],
);
check(
  "two occurrences are below the threshold",
  findRepeatedWords("practice practice"),
  [],
);
check(
  "short words are ignored",
  findRepeatedWords("the the the the the and and and and"),
  [],
);
check(
  "custom threshold of 2",
  findRepeatedWords("practice practice", { threshold: 2 }),
  [{ word: "practice", count: 2 }],
);
check(
  "limit caps the list",
  findRepeatedWords(
    "alpha alpha alpha beta beta beta gamma gamma gamma",
    { limit: 1 },
  ),
  [{ word: "alpha", count: 3 }],
);
check(
  "punctuation around words does not split counts",
  findRepeatedWords("Work, work! Work? (work)"),
  [{ word: "work", count: 4 }],
);
check(
  "case-insensitive",
  findRepeatedWords("Practice practice PRACTICE"),
  [{ word: "practice", count: 3 }],
);
check(
  "inner apostrophe is kept",
  findRepeatedWords("don't don't don't"),
  [{ word: "don't", count: 3 }],
);
check(
  "hyphenated repeats are counted as one token",
  findRepeatedWords("well-known well-known well-known"),
  [{ word: "well-known", count: 3 }],
);
check("empty text has no repeats", findRepeatedWords(""), []);

console.log("-- word target --");
check("inside the range", evaluateWordTarget(120, 120, 180), {
  min: 120,
  max: 180,
  status: "within",
  wordsToMinimum: null,
  wordsOverMaximum: null,
});
check("one word under the minimum", evaluateWordTarget(119, 120, 180), {
  min: 120,
  max: 180,
  status: "under",
  wordsToMinimum: 1,
  wordsOverMaximum: null,
});
check("one word over the maximum", evaluateWordTarget(181, 120, 180), {
  min: 120,
  max: 180,
  status: "over",
  wordsToMinimum: null,
  wordsOverMaximum: 1,
});
check("minimum only", evaluateWordTarget(60, 60, null), {
  min: 60,
  max: null,
  status: "within",
  wordsToMinimum: null,
  wordsOverMaximum: null,
});
check("maximum only", evaluateWordTarget(101, null, 100), {
  min: null,
  max: 100,
  status: "over",
  wordsToMinimum: null,
  wordsOverMaximum: 1,
});
check("no target", evaluateWordTarget(0, null, null), {
  min: null,
  max: null,
  status: "none",
  wordsToMinimum: null,
  wordsOverMaximum: null,
});
check("zero bounds are treated as unset", evaluateWordTarget(5, 0, 0), {
  min: null,
  max: null,
  status: "none",
  wordsToMinimum: null,
  wordsOverMaximum: null,
});
check("empty text under a minimum", evaluateWordTarget(0, 120, 180), {
  min: 120,
  max: 180,
  status: "under",
  wordsToMinimum: 120,
  wordsOverMaximum: null,
});

console.log("-- whole-text analysis --");
const empty = analyseWriting("");
check("empty: word count", empty.wordCount, 0);
check("empty: character count", empty.characterCount, 0);
check("empty: sentence count", empty.sentenceCount, 0);
check("empty: average", empty.averageSentenceLength, null);
check("empty: longest sentence", empty.longestSentenceWords, 0);
check("empty: repeated words", empty.repeatedWords, []);
check("empty: no target", empty.target.status, "none");
check("empty: no notes", empty.notes, []);

const whitespace = analyseWriting("   \n\n\t  ");
check("whitespace-only: word count", whitespace.wordCount, 0);
check("whitespace-only: sentence count", whitespace.sentenceCount, 0);

const shortText = analyseWriting("I like tea. I like coffee.", {
  minWords: 10,
  maxWords: 20,
});
check("short text: words", shortText.wordCount, 6);
check("short text: sentences", shortText.sentenceCount, 2);
check("short text: average", shortText.averageSentenceLength, 3);
check("short text: target status", shortText.target.status, "under");
check("short text: words to minimum", shortText.target.wordsToMinimum, 4);
check("short text: only a target note (avg 3 words)", shortText.notes, [
  "Add 4 words to reach the 10-word minimum.",
]);

const repeatText = analyseWriting(
  "Practice helps. Practice works. Practice builds confidence.",
);
check("repeat text: words", repeatText.wordCount, 7);
check("repeat text: sentences", repeatText.sentenceCount, 3);
check("repeat text: average", repeatText.averageSentenceLength, 2.3);
check("repeat text: only the repeated word is listed", repeatText.repeatedWords, [
  { word: "practice", count: 3 },
]);
check("repeat text: notes are ordered and capped", repeatText.notes, [
  "Sentences average 2.3 words. Joining a few short sentences may improve flow.",
  "“practice” appears 3 times. A synonym or a pronoun may read better.",
]);

const longSentenceNumbers = Array.from({ length: 50 }, (_, index) => index + 1)
  .join(" ")
  .replace("25 ", "25. ");
const longSentences = analyseWriting(longSentenceNumbers);
check("long sentences: words", longSentences.wordCount, 50);
check("long sentences: sentences", longSentences.sentenceCount, 2);
check("long sentences: average", longSentences.averageSentenceLength, 25);
check("long sentences: longest", longSentences.longestSentenceWords, 25);
check(
  "long sentences: advisory note",
  longSentences.notes,
  [
    "Sentences average 25 words. Long sentences are harder to follow — consider splitting the longest (25 words).",
  ],
);

const numbered = (count: number) =>
  Array.from({ length: count }, (_, index) => `w${index}`).join(" ");

const underTarget = analyseWriting(numbered(10), {
  minWords: 20,
});
check("under target: note text", underTarget.notes, [
  "Add 10 words to reach the 20-word minimum.",
]);

const overTarget = analyseWriting(numbered(30), {
  maxWords: 20,
});
check("over target: note text", overTarget.notes, [
  "Cut 10 words to stay within the 20-word maximum.",
]);

const withinTarget = analyseWriting(numbered(25), {
  minWords: 20,
  maxWords: 30,
});
check("within target: note text", withinTarget.notes, [
  "Word count is inside the 20–30 word target.",
]);

console.log("-- very long text --");
const longText = Array.from({ length: 5000 }, (_, index) => `word${index}`).join(
  " ",
);
const longAnalysis = analyseWriting(longText);
check("5000 unique words counted", longAnalysis.wordCount, 5000);
check("no terminal punctuation -> one sentence", longAnalysis.sentenceCount, 1);
check("average equals the whole text", longAnalysis.averageSentenceLength, 5000);
check("longest sentence is the whole text", longAnalysis.longestSentenceWords, 5000);
check("unique words are not repeated", longAnalysis.repeatedWords, []);

const repeatedLong = analyseWriting("word ".repeat(5000).trim());
check("5000 repeats counted", repeatedLong.wordCount, 5000);
check("5000 repeats listed once", repeatedLong.repeatedWords, [
  { word: "word", count: 5000 },
]);
check(
  "repeated-word notes are capped at 4 total notes",
  repeatedLong.notes.length <= 4,
  true,
);

console.log("-- validation --");
const emptyResult = validateWritingText("");
check("empty text is rejected", emptyResult.ok, false);
check(
  "empty text message",
  emptyResult.ok ? null : emptyResult.error,
  "Write your response before submitting.",
);
const whitespaceResult = validateWritingText("   \n\n\t  ");
check("whitespace-only is rejected", whitespaceResult.ok, false);
const nonString = validateWritingText(42 as unknown as string);
check("non-string is rejected", nonString.ok, false);
const nullValue = validateWritingText(null);
check("null is rejected", nullValue.ok, false);

const tooShort = validateWritingText("too short");
check("9 characters is rejected", tooShort.ok, false);
check(
  "too-short message names the length",
  tooShort.ok ? null : tooShort.error.includes("(9 characters)"),
  true,
);
check(
  "minimum is 20 characters",
  MIN_WRITING_CHARACTERS,
  20,
);

const exactlyMinimum = validateWritingText("12345678901234567890");
check("20 characters is accepted", exactlyMinimum.ok, true);
check(
  "20 characters -> one word",
  exactlyMinimum.ok ? exactlyMinimum.wordCount : null,
  1,
);

const nineteen = validateWritingText("1234567890123456789");
check("19 characters is rejected", nineteen.ok, false);

const atCap = validateWritingText("word ".repeat(4000).trim());
check("at the character cap is accepted", atCap.ok, true);
check(
  "cap is 20000 characters",
  MAX_WRITING_CHARACTERS,
  20_000,
);

const overCap = validateWritingText("a".repeat(MAX_WRITING_CHARACTERS + 1));
check("over the cap is rejected", overCap.ok, false);
check(
  "over-cap message names both lengths",
  overCap.ok
    ? null
    : overCap.error.includes("20,001") && overCap.error.includes("20,000"),
  true,
);

const punctuationOnly = validateWritingText("!".repeat(25));
check("long punctuation-only text is rejected", punctuationOnly.ok, false);
check(
  "punctuation-only message",
  punctuationOnly.ok ? null : punctuationOnly.error,
  "Your response does not contain any words yet.",
);

const messy = "  Hello   world.\r\n\r\n\r\nSecond   line.  ";
const cleaned = validateWritingText(messy);
check("messy text is accepted", cleaned.ok, true);
check(
  "CRLF and blank lines are normalised",
  cleaned.ok ? cleaned.text : null,
  "Hello   world.\n\nSecond   line.",
);
check("cleaned word count", cleaned.ok ? cleaned.wordCount : null, 4);
check(
  "cleaned character count",
  cleaned.ok ? cleaned.characterCount : null,
  cleaned.ok ? cleaned.text.length : null,
);

check(
  "NUL characters are stripped",
  cleanWritingText("hello\u0000 world"),
  "hello world",
);
check(
  "trailing spaces per line are removed",
  cleanWritingText("hello   \nworld   "),
  "hello\nworld",
);
check(
  "three blank lines collapse to one",
  cleanWritingText("one\n\n\n\ntwo"),
  "one\n\ntwo",
);
check("outer whitespace is trimmed", cleanWritingText("\n\n  hi  \n\n"), "hi");

console.log("-- counter and storage agree --");
const agreeText =
  "I enjoy learning English because it opens new doors. Every day I practise for twenty minutes, and I keep a list of new words.";
const agreeAnalysis = analyseWriting(agreeText, { minWords: 20, maxWords: 40 });
const agreeValidation = validateWritingText(agreeText);
check(
  "live counter equals the stored word count",
  agreeValidation.ok ? agreeValidation.wordCount : null,
  agreeAnalysis.wordCount,
);
check(
  "stored text equals the clean text",
  agreeValidation.ok ? agreeValidation.text : null,
  agreeText,
);
check("sample target status", agreeAnalysis.target.status, "within");

console.log("");
console.log(`${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
