/** Offline only: no session, database, environment files or network access. */
import assert from "node:assert/strict";
import { gradeRetry as reading, type RetryQuestion as ReadingQuestion } from "../../src/lib/reading/retry";
import { gradeRetry as listening, type RetryQuestion as ListeningQuestion } from "../../src/lib/listening/retry";
import { READING_QUESTION_TYPES } from "../../src/lib/reading/scoring";
import { LISTENING_QUESTION_TYPES } from "../../src/lib/listening/scoring";

function check(label: string, run: () => void) {
  try { run(); console.log(`ok ${label}`); }
  catch (error) { console.error(`FAIL ${label}`, error); process.exitCode = 1; }
}

const base = {
  id: "missed", order: 1, prompt: "Question", options: ["one", "two"],
  correctAnswer: "one", correctOptionIndex: 1, acceptedAnswers: ["alternate"],
  explanation: "Explanation",
};

for (const type of READING_QUESTION_TYPES) {
  const question: ReadingQuestion = { ...base, type };
  check(`Reading ${type}: correct, wrong and unanswered`, () => {
    const response = type === "TRUE_FALSE" ? " TRUE. " : type === "FILL_BLANK" ? " ALTERNATE. " : "two";
    const row = type === "TRUE_FALSE" ? { ...question, correctAnswer: "true", correctOptionIndex: null } : question;
    const [review] = reading([row], [row.id], { [row.id]: response });
    assert.equal(review.isCorrect, true);
    assert.equal(review.explanation, row.explanation);
    assert.equal(review.correctAnswer, row.correctAnswer);
    for (const value of [null, undefined, "", "   ", "wrong"]) {
      assert.equal(reading([row], [row.id], { [row.id]: value })[0].isCorrect, false);
    }
    if (["MULTIPLE_CHOICE", "MAIN_IDEA", "VOCAB_IN_CONTEXT"].includes(type)) {
      assert.equal(reading([row], [row.id], { [row.id]: "alternate" })[0].isCorrect, false);
    }
  });
}

for (const type of LISTENING_QUESTION_TYPES) {
  const question: ListeningQuestion = {
    ...base, type, matchingPairs: [{ left: "A", right: "one" }, { left: "B", right: "two" }],
    ...(type === "MATCHING" ? { correctAnswer: '{"A":"one","B":"two"}' } : {}),
    ...(type === "TRUE_FALSE" ? { correctAnswer: "true", correctOptionIndex: null } : {}),
  };
  check(`Listening ${type}: correct, wrong and unanswered`, () => {
    const response = type === "MATCHING" ? '[" ONE. ","two"]' : type === "TRUE_FALSE" ? " TRUE. " : type === "FILL_BLANK" ? " ALTERNATE. " : "two";
    assert.equal(listening([question], [question.id], { [question.id]: response })[0].isCorrect, true);
    for (const value of [null, undefined, "", "   ", "wrong"]) {
      assert.equal(listening([question], [question.id], { [question.id]: value })[0].isCorrect, false);
    }
    if (type === "MATCHING") {
      for (const value of ['["one"]', '["one",""]', '["two","one"]', '["one","two","extra"]', '{"A":"one","B":"two"}']) {
        assert.equal(listening([question], [question.id], { [question.id]: value })[0].isCorrect, false);
      }
      assert.deepEqual(JSON.parse(listening([question], [question.id], { [question.id]: response })[0].response!), { A: "ONE.", B: "two" });
    }
  });
}

check("Only missed database ids are graded; right and unknown fields are ignored", () => {
  const question: ReadingQuestion = { ...base, type: "FILL_BLANK" };
  const right = { ...question, id: "right" };
  const responses = { missed: "alternate", right: "wrong", unknown: "one" };
  assert.deepEqual(reading([question, right], ["missed", "unknown"], responses).map((q) => q.id), ["missed"]);
  assert.deepEqual(reading([question], [], responses), []);
  const audioQuestion: ListeningQuestion = { ...question, type: "FILL_BLANK", matchingPairs: [] };
  assert.deepEqual(listening([audioQuestion, { ...audioQuestion, id: "right" }], ["missed", "unknown"], responses).map((q) => q.id), ["missed"]);
  assert.deepEqual(listening([audioQuestion], [], responses), []);
  assert.equal(reading([question], ["missed"], {})[0].isCorrect, false);
  assert.equal(listening([audioQuestion], ["missed"], {})[0].isCorrect, false);
});
