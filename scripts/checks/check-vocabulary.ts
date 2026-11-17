/**
 * Offline checks for the "Words to review" list. No database: the
 * query is driven through a fake that records what it was asked for.
 *
 *   npx tsx scripts/checks/check-vocabulary.ts
 */
import assert from "node:assert/strict";

import {
  getWordsToReview,
  VOCABULARY_LIMITS,
  wordFromPrompt,
  wordsToReview,
  type VocabularyAnswer,
} from "../../src/lib/progress/vocabulary";

// The word is the first quoted run of the prompt; nothing quoted means no word.
assert.equal(wordFromPrompt('In the passage, "deliver" means:'), "deliver");
assert.equal(wordFromPrompt('As used in the passage, "sceptics" are people who:'), "sceptics");
assert.equal(wordFromPrompt("In the third paragraph, “withstand” most nearly means:"), "withstand");
assert.equal(wordFromPrompt('Which is closer: "first" or "second"?'), "first");
assert.equal(wordFromPrompt('The word " spaced " here'), "spaced");
assert.equal(wordFromPrompt("What does the writer mean?"), null);
assert.equal(wordFromPrompt('Empty "" quotes'), null);
assert.equal(wordFromPrompt(`"${"x".repeat(61)}"`), null);

const at = (day: number) => new Date(Date.UTC(2026, 10, day, 12));
const answer = (
  questionId: string,
  word: string,
  isCorrect: boolean,
  day: number,
  extra: Partial<VocabularyAnswer> = {},
): VocabularyAnswer => ({
  questionId,
  prompt: `In the passage, "${word}" means:`,
  correctAnswer: `meaning of ${word}`,
  lessonId: `lesson-${questionId}`,
  lessonTitle: `Lesson ${questionId}`,
  isCorrect,
  answeredAt: at(day),
  ...extra,
});

// Nothing answered, or nothing wrong: nothing to review.
assert.deepEqual(wordsToReview([]), []);
assert.deepEqual(wordsToReview([answer("q1", "deliver", true, 1)]), []);

// A wrong answer lists the word with the meaning and the lesson it came from.
assert.deepEqual(wordsToReview([answer("q1", "deliver", false, 1)]), [
  {
    questionId: "q1",
    word: "deliver",
    meaning: "meaning of deliver",
    lessonId: "lesson-q1",
    lessonTitle: "Lesson q1",
    misses: 1,
    lastMissedAt: at(1),
  },
]);

// Only the latest answer to a question decides, whatever order the rows arrive in.
{
  const fixedLater = [answer("q1", "deliver", false, 1), answer("q1", "deliver", true, 2)];
  assert.deepEqual(wordsToReview(fixedLater), []);
  assert.deepEqual(wordsToReview([...fixedLater].reverse()), []);

  const wrongAgain = [
    answer("q1", "deliver", true, 2),
    answer("q1", "deliver", false, 3),
    answer("q1", "deliver", false, 1),
  ];
  const [word] = wordsToReview(wrongAgain);
  assert.equal(word.misses, 2);
  assert.deepEqual(word.lastMissedAt, at(3));
}

// Newest miss first; ties broken by question id so the order is stable.
{
  const words = wordsToReview([
    answer("q2", "retention", false, 2),
    answer("q3", "stalls", false, 5),
    answer("q1", "deliver", false, 2),
  ]);
  assert.deepEqual(words.map((word) => word.word), ["stalls", "deliver", "retention"]);
}

// A question with no quoted word is skipped, not guessed at.
assert.deepEqual(
  wordsToReview([answer("q1", "x", false, 1, { prompt: "What does the writer mean?" })]),
  [],
);

// The list is capped.
{
  const many = Array.from({ length: 30 }, (_, index) => answer(`q${index}`, `word${index}`, false, 1));
  assert.equal(wordsToReview(many).length, VOCABULARY_LIMITS.words);
  assert.equal(wordsToReview(many, 3).length, 3);
  assert.equal(wordsToReview(many, 0).length, 0);
}

async function main() {
  // The query is scoped to the learner, to completed attempts and to
  // vocabulary questions, and it is bounded.
  const calls: unknown[] = [];
  const fake = {
    readingAnswer: {
      findMany: async (args: unknown) => {
        calls.push(args);
        return [
          {
            questionId: "q1",
            isCorrect: false,
            answeredAt: at(4),
            question: {
              prompt: 'In the passage, "deliver" means:',
              correctAnswer: "Bring something to a place",
              lesson: { id: "seed-reading-3", title: "Lost Luggage at the Airport" },
            },
          },
        ];
      },
    },
  };
  const words = await getWordsToReview("user-1", fake as never);
  assert.equal(calls.length, 1);
  const args = calls[0] as {
    where: { attempt: { userId: string; completedAt: unknown }; question: { type: string } };
    take: number;
    orderBy: unknown;
  };
  assert.equal(args.where.attempt.userId, "user-1");
  assert.deepEqual(args.where.attempt.completedAt, { not: null });
  assert.equal(args.where.question.type, "VOCAB_IN_CONTEXT");
  assert.equal(args.take, VOCABULARY_LIMITS.answers);
  assert.deepEqual(args.orderBy, { answeredAt: "desc" });
  assert.deepEqual(words, [
    {
      questionId: "q1",
      word: "deliver",
      meaning: "Bring something to a place",
      lessonId: "seed-reading-3",
      lessonTitle: "Lost Luggage at the Airport",
      misses: 1,
      lastMissedAt: at(4),
    },
  ]);

  console.log("PASS words to review: prompt parsing, latest answer decides, ordering, cap, scoped query (offline)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
