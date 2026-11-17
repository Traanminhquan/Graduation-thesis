/** Offline only: importing the pure mapper does not initialize the database. */
import assert from "node:assert/strict";
import { toListeningQuestionView } from "../../src/lib/listening/data";

try {
  const pairs = [
    { left: "Small dry bags", right: "Top shelf" },
    { left: "Large backpacks", right: "Bottom shelf" },
    { left: "Spare straps", right: "Middle shelf" },
    { left: "Waterproof cases", right: "Top shelf" },
  ];
  const row = {
    id: "matching-fixture", order: 1, type: "MATCHING" as const,
    prompt: "Match each item to its location.", options: [], matchingPairs: pairs,
    correctAnswer: JSON.stringify(Object.fromEntries(pairs.map(({ left, right }) => [left, right]))),
    acceptedAnswers: ["secret"], correctOptionIndex: 0, explanation: "secret",
  };
  const view = toListeningQuestionView(row);
  const serialized = JSON.stringify(view);
  assert.deepEqual(JSON.parse(serialized), {
    id: row.id, order: row.order, type: row.type, prompt: row.prompt, options: [],
    matchingLefts: pairs.map(({ left }) => left),
    matchingOptions: ["Bottom shelf", "Middle shelf", "Top shelf"],
  });
  for (const { left, right } of pairs) {
    assert.ok(serialized.includes(JSON.stringify(left)));
    assert.ok(serialized.includes(JSON.stringify(right)));
    assert.ok(!serialized.includes(JSON.stringify({ left, right })));
    assert.ok(!serialized.includes(JSON.stringify([left, right])));
  }
  assert.ok(!serialized.includes('"matchingPairs"'));
  assert.notDeepEqual(view.matchingOptions, pairs.map(({ right }) => right));
  // Even with distinct rights, options must not retain the answer-key order.
  const distinct = toListeningQuestionView({ ...row, matchingPairs: pairs.slice(0, 3) });
  assert.notDeepEqual(distinct.matchingOptions, pairs.slice(0, 3).map(({ right }) => right));
  for (const type of ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK"] as const) {
    const other = toListeningQuestionView({ ...row, type, options: ["one", "two"] });
    assert.deepEqual(other.matchingLefts, []);
    assert.deepEqual(other.matchingOptions, []);
    assert.deepEqual(other.options, type === "MULTIPLE_CHOICE" ? ["one", "two"] : []);
  }
  console.log("ok Listening browser views expose labels and sorted options without matching answers");
} catch (error) {
  console.error("FAIL Listening matching answer leak", error);
  process.exitCode = 1;
}
