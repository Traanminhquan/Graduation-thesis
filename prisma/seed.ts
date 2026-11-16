/**
 * Minimal seed script — WRITTEN ONLY, NOT EXECUTED against the live database
 * as part of the Phase 1 schema task.
 *
 * Run later (after the migration has been reviewed and applied by a human):
 *   npx prisma db seed
 *
 * Idempotent: uses deterministic ids + upsert, and replaces each seeded
 * lesson's questions on every run.
 */
import { PrismaClient, Difficulty, ReadingQuestionType } from "@prisma/client";

const prisma = new PrismaClient();

type SeedQuestion = {
  order: number;
  type: ReadingQuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: string;
  correctOptionIndex?: number;
  acceptedAnswers?: string[];
  explanation: string;
};

type SeedLesson = {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  summary: string;
  content: string;
  questions: SeedQuestion[];
};

const lessons: SeedLesson[] = [
  {
    id: "seed-reading-1",
    title: "A Morning at the Market",
    topic: "Daily life",
    difficulty: Difficulty.BEGINNER,
    estimatedMinutes: 5,
    summary: "A short passage about shopping at a local market.",
    content: `Every Saturday, Mai wakes up early and walks to the market near her house.
The market is always busy in the morning. Farmers arrive before sunrise to set up
their stalls, and the air smells of fresh bread and ripe fruit.

Mai usually buys vegetables first. She says the best tomatoes are sold by an old
woman at the corner stall. After that, she stops for a bowl of noodles and talks
with her neighbours. By nine o'clock, the market is quieter, and Mai walks home
with a heavy bag and a smile.`,
    questions: [
      {
        order: 1,
        type: ReadingQuestionType.MULTIPLE_CHOICE,
        prompt: "When does Mai go to the market?",
        options: ["Every evening", "Every Saturday morning", "Once a month", "Only in winter"],
        correctAnswer: "Every Saturday morning",
        correctOptionIndex: 1,
        explanation: "The first sentence says she wakes up early every Saturday and walks to the market.",
      },
      {
        order: 2,
        type: ReadingQuestionType.TRUE_FALSE,
        prompt: "Farmers arrive at the market after sunrise.",
        options: undefined,
        correctAnswer: "false",
        explanation:
          "The passage states farmers arrive *before* sunrise to set up their stalls, so the statement is false.",
      },
      {
        order: 3,
        type: ReadingQuestionType.FILL_BLANK,
        prompt: "Mai buys the best tomatoes from an old woman at the ______ stall.",
        options: undefined,
        correctAnswer: "corner",
        acceptedAnswers: ["corner"],
        explanation: "The text says the old woman sells tomatoes at the corner stall.",
      },
      {
        order: 4,
        type: ReadingQuestionType.MAIN_IDEA,
        prompt: "What is the main idea of the passage?",
        options: [
          "Markets in the city are too crowded.",
          "Mai's regular Saturday trip to the local market.",
          "How to grow tomatoes at home.",
          "Why noodles are popular in the morning.",
        ],
        correctAnswer: "Mai's regular Saturday trip to the local market.",
        correctOptionIndex: 1,
        explanation:
          "The passage describes what Mai does on a typical Saturday at the market, not a general argument about markets.",
      },
      {
        order: 5,
        type: ReadingQuestionType.VOCAB_IN_CONTEXT,
        prompt: 'In the passage, "stalls" most nearly means:',
        options: ["Small shops or tables where goods are sold", "Groups of customers", "Roads closed for repairs", "Bags used for shopping"],
        correctAnswer: "Small shops or tables where goods are sold",
        correctOptionIndex: 0,
        explanation: "Farmers 'set up their stalls' — the tables/booths where they sell produce.",
      },
    ],
  },
  {
    id: "seed-reading-2",
    title: "Why We Forget What We Learn",
    topic: "Education",
    difficulty: Difficulty.INTERMEDIATE,
    estimatedMinutes: 7,
    summary: "A passage about memory and the value of spaced practice.",
    content: `Students often assume that if something feels easy to read, they have
learned it. Research on memory suggests the opposite. Re-reading a chapter feels
smooth, but that feeling of fluency is a poor signal of long-term retention.

A more effective strategy is spaced practice: studying the same material several
times, with gaps of hours or days between sessions. Each time you return, recall
is slightly harder, and that effort is exactly what strengthens the memory.
Testing yourself produces a similar effect, which is why practice quizzes often
teach more than another round of highlighting.

The practical lesson is simple. If studying feels effortless, it may not be
working. Short, difficult, repeated sessions beat long, comfortable ones.`,
    questions: [
      {
        order: 1,
        type: ReadingQuestionType.MULTIPLE_CHOICE,
        prompt: "According to the passage, feeling that a text is easy to read:",
        options: [
          "Proves that you have learned it",
          "Is a poor sign of long-term retention",
          "Means the text is badly written",
          "Only happens with difficult material",
        ],
        correctAnswer: "Is a poor sign of long-term retention",
        correctOptionIndex: 1,
        explanation:
          "The passage says fluency 'is a poor signal of long-term retention' despite feeling smooth.",
      },
      {
        order: 2,
        type: ReadingQuestionType.FILL_BLANK,
        prompt: "Studying the same material with gaps of time between sessions is called ______ practice.",
        options: undefined,
        correctAnswer: "spaced",
        acceptedAnswers: ["spaced", "Spaced"],
        explanation: "The passage defines spaced practice as studying with gaps of hours or days between sessions.",
      },
      {
        order: 3,
        type: ReadingQuestionType.MAIN_IDEA,
        prompt: "Which sentence best states the author's main point?",
        options: [
          "Highlighting is the most popular study method.",
          "Effortful, repeated practice is more effective than comfortable re-reading.",
          "Memory research is unreliable.",
          "Students should never take practice quizzes.",
        ],
        correctAnswer: "Effortful, repeated practice is more effective than comfortable re-reading.",
        correctOptionIndex: 1,
        explanation: "The closing paragraph summarises this: short, difficult, repeated sessions beat long ones.",
      },
      {
        order: 4,
        type: ReadingQuestionType.VOCAB_IN_CONTEXT,
        prompt: 'As used in the passage, "retention" means:',
        options: ["The ability to keep information in memory", "The cost of a course", "A written summary", "A type of exam"],
        correctAnswer: "The ability to keep information in memory",
        correctOptionIndex: 0,
        explanation: "Long-term retention refers to how well information is kept in memory over time.",
      },
    ],
  },
];

async function main() {
  for (const lesson of lessons) {
    const { questions, ...lessonData } = lesson;

    await prisma.readingLesson.upsert({
      where: { id: lessonData.id },
      update: lessonData,
      create: lessonData,
    });

    // Replace questions so re-running the seed stays idempotent.
    await prisma.readingQuestion.deleteMany({ where: { lessonId: lessonData.id } });
    await prisma.readingQuestion.createMany({
      data: questions.map((question) => ({
        lessonId: lessonData.id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        correctAnswer: question.correctAnswer,
        correctOptionIndex: question.correctOptionIndex ?? null,
        acceptedAnswers: question.acceptedAnswers,
        explanation: question.explanation,
      })),
    });

    console.log(`Seeded reading lesson "${lessonData.title}" with ${questions.length} questions.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
