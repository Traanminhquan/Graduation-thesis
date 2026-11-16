/**
 * Offline check of the sentence splitter behind the Listening player.
 *
 *   npx tsx scripts/check-listening-speech.ts
 *
 * The player speaks these strings, so a dropped or altered character is an
 * audible defect: every seeded script must survive the split unchanged.
 */
import assert from "node:assert/strict";

import { splitSentences } from "../src/lib/listening/speech";
import { listeningLessons } from "./lesson-bank-data";

assert.deepEqual(splitSentences("She reads. This is his class!  Is it? Yes"), [
  "She reads.",
  "This is his class!",
  "Is it?",
  "Yes",
]);
assert.deepEqual(splitSentences("It costs 9.50 at 7.30 today. Thanks."), [
  "It costs 9.50 at 7.30 today.",
  "Thanks.",
]);
assert.deepEqual(splitSentences("Wait... what?! No."), ["Wait...", "what?!", "No."]);
assert.deepEqual(splitSentences("  \n "), []);
assert.deepEqual(splitSentences("line one\nline two."), ["line one line two."]);

for (const lesson of listeningLessons) {
  const sentences = splitSentences(lesson.transcript);
  const expected = lesson.transcript.replace(/\s+/g, " ").trim();
  assert.equal(sentences.join(" "), expected, `${lesson.id}: text changed by the split`);
  assert.ok(sentences.length >= 8, `${lesson.id}: expected several sentences`);
}

console.log(`PASS sentence splitter (${listeningLessons.length} seeded scripts preserved exactly)`);
