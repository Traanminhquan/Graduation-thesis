/**
 * Seeds the two demo Listening lessons.
 *
 *   node --env-file=.env --import tsx scripts/seed-listening.ts
 *
 * This is a normal Prisma Client script: INSERT/UPDATE only, no migration and
 * no destructive operation. Ids are deterministic and every row is upserted, so
 * re-running the script updates the demo content in place and never deletes a
 * learner's attempts.
 *
 * Audio: this build has no hosted audio files. `audioUrl` stores a descriptive
 * placeholder and the lesson is played client-side by the browser Web Speech
 * API reading `transcript`. `audioDurationMs` is an estimate at 150 wpm, used
 * only for the "~N min" label on the lesson list.
 */
import {
  Difficulty,
  ListeningQuestionType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

type SeedMatchingPair = { left: string; right: string };

type SeedQuestion = {
  /** Deterministic id, so re-seeding updates instead of duplicating. */
  id: string;
  order: number;
  type: ListeningQuestionType;
  prompt: string;
  options?: string[];
  matchingPairs?: SeedMatchingPair[];
  /** Plain text, or the JSON object `{ left: right }` for MATCHING. */
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
  transcript: string;
  questions: SeedQuestion[];
};

function matchingKey(pairs: SeedMatchingPair[]): string {
  return JSON.stringify(
    Object.fromEntries(pairs.map((pair) => [pair.left, pair.right])),
  );
}

const lessons: SeedLesson[] = [
  {
    id: "seed-listening-1",
    title: "A Call to the Dental Clinic",
    topic: "Health",
    difficulty: Difficulty.BEGINNER,
    transcript:
      "Good morning, and thank you for calling Green Street Dental. Our office is open from nine until five, Monday to Friday, and we are closed on Saturdays and Sundays. If you need to change an appointment, press one. If you have a dental emergency, press two and someone will answer you straight away. New patients should arrive fifteen minutes before their appointment to fill in the forms, and please bring your appointment card with you. Thank you for calling, and have a good day.",
    questions: [
      {
        id: "seed-listening-1-q1",
        order: 1,
        type: ListeningQuestionType.MULTIPLE_CHOICE,
        prompt: "When is the dental clinic closed?",
        options: [
          "On Saturdays and Sundays",
          "On Sunday mornings only",
          "Every weekday afternoon",
          "During public holidays",
        ],
        correctAnswer: "On Saturdays and Sundays",
        correctOptionIndex: 0,
        explanation:
          "The recording says the office is open Monday to Friday and *closed on Saturdays and Sundays*.",
      },
      {
        id: "seed-listening-1-q2",
        order: 2,
        type: ListeningQuestionType.TRUE_FALSE,
        prompt: "New patients should arrive fifteen minutes early.",
        correctAnswer: "true",
        explanation:
          "The recording asks new patients to arrive *fifteen minutes before* their appointment to fill in the forms.",
      },
      {
        id: "seed-listening-1-q3",
        order: 3,
        type: ListeningQuestionType.FILL_BLANK,
        prompt: "For a dental emergency, callers should press ______.",
        correctAnswer: "two",
        acceptedAnswers: ["two", "2"],
        explanation:
          "The message says: \"If you have a dental emergency, press *two* and someone will answer you straight away.\"",
      },
      {
        id: "seed-listening-1-q4",
        order: 4,
        type: ListeningQuestionType.MATCHING,
        prompt: "Match each action from the recording with what it is for.",
        matchingPairs: [
          { left: "Press one", right: "Change an appointment" },
          { left: "Press two", right: "Talk about a dental emergency" },
          {
            left: "Arrive fifteen minutes early",
            right: "Fill in the new-patient forms",
          },
        ],
        correctAnswer: matchingKey([
          { left: "Press one", right: "Change an appointment" },
          { left: "Press two", right: "Talk about a dental emergency" },
          {
            left: "Arrive fifteen minutes early",
            right: "Fill in the new-patient forms",
          },
        ]),
        explanation:
          "Press one is for changing an appointment, press two reaches someone about an emergency, and new patients come early to complete the forms.",
      },
      {
        id: "seed-listening-1-q5",
        order: 5,
        type: ListeningQuestionType.MULTIPLE_CHOICE,
        prompt: "What should patients bring with them?",
        options: [
          "Their appointment card",
          "A copy of their insurance form",
          "A list of their medicines",
          "Their previous X-rays",
        ],
        correctAnswer: "Their appointment card",
        correctOptionIndex: 0,
        explanation:
          "At the end of the message: \"please bring your *appointment card* with you\".",
      },
    ],
  },
  {
    id: "seed-listening-2",
    title: "A Weekend Cycling Trip",
    topic: "Travel",
    difficulty: Difficulty.INTERMEDIATE,
    transcript:
      "So last weekend, my brother and I decided to cycle to the lake outside the city. We left at about seven in the morning, because the forecast said it would get hot later. The first ten kilometres were easy, mostly flat roads through the suburbs. After that, the path climbed into the hills, and I had to get off and walk twice. We reached the lake just before noon, ate the sandwiches we had packed, and swam for half an hour. The ride home was faster, but my legs were finished by the time we got back. Next time, I think we'll take the train part of the way.",
    questions: [
      {
        id: "seed-listening-2-q1",
        order: 1,
        type: ListeningQuestionType.MULTIPLE_CHOICE,
        prompt: "Why did they leave at seven in the morning?",
        options: [
          "Because the weather was expected to get hot",
          "Because the train left early",
          "Because the lake closes at noon",
          "Because they wanted to watch the sunrise",
        ],
        correctAnswer: "Because the weather was expected to get hot",
        correctOptionIndex: 0,
        explanation:
          "The speaker says they left at seven *because the forecast said it would get hot later*.",
      },
      {
        id: "seed-listening-2-q2",
        order: 2,
        type: ListeningQuestionType.TRUE_FALSE,
        prompt: "The route became harder after the first ten kilometres.",
        correctAnswer: "true",
        explanation:
          "The first ten kilometres were easy and flat, but after that *the path climbed into the hills*.",
      },
      {
        id: "seed-listening-2-q3",
        order: 3,
        type: ListeningQuestionType.FILL_BLANK,
        prompt: "They reached the lake just before ______.",
        correctAnswer: "noon",
        acceptedAnswers: ["noon", "12", "twelve", "midday"],
        explanation:
          "The speaker says: \"We reached the lake just before *noon*.\"",
      },
      {
        id: "seed-listening-2-q4",
        order: 4,
        type: ListeningQuestionType.MATCHING,
        prompt: "Match each part of the trip with what happened there.",
        matchingPairs: [
          {
            left: "First ten kilometres",
            right: "Flat roads through the suburbs",
          },
          { left: "The hills", right: "He had to walk twice" },
          { left: "At the lake", right: "They swam for half an hour" },
          { left: "The ride home", right: "His legs were finished" },
        ],
        correctAnswer: matchingKey([
          {
            left: "First ten kilometres",
            right: "Flat roads through the suburbs",
          },
          { left: "The hills", right: "He had to walk twice" },
          { left: "At the lake", right: "They swam for half an hour" },
          { left: "The ride home", right: "His legs were finished" },
        ]),
        explanation:
          "The suburbs were flat, the hills forced him to walk twice, they swam for half an hour at the lake, and his legs were finished on the way home.",
      },
    ],
  },
];

function estimateAudioDurationMs(transcript: string): number {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60_000);
}

async function main() {
  for (const lesson of lessons) {
    const { questions, ...lessonData } = lesson;

    await prisma.listeningLesson.upsert({
      where: { id: lessonData.id },
      update: {
        title: lessonData.title,
        topic: lessonData.topic,
        difficulty: lessonData.difficulty,
        transcript: lessonData.transcript,
        audioUrl: `tts://browser-speech-synthesis/${lessonData.id}`,
        audioDurationMs: estimateAudioDurationMs(lessonData.transcript),
      },
      create: {
        ...lessonData,
        audioUrl: `tts://browser-speech-synthesis/${lessonData.id}`,
        audioDurationMs: estimateAudioDurationMs(lessonData.transcript),
      },
    });

    for (const question of questions) {
      const data = {
        lessonId: lessonData.id,
        order: question.order,
        type: question.type,
        prompt: question.prompt,
        options: question.options ?? Prisma.DbNull,
        matchingPairs: question.matchingPairs ?? Prisma.DbNull,
        correctAnswer: question.correctAnswer,
        correctOptionIndex: question.correctOptionIndex ?? null,
        acceptedAnswers: question.acceptedAnswers ?? Prisma.DbNull,
        explanation: question.explanation,
      };

      await prisma.listeningQuestion.upsert({
        where: { id: question.id },
        update: data,
        create: { id: question.id, ...data },
      });
    }

    console.log(
      `Seeded listening lesson "${lessonData.title}" (${lessonData.id}) with ${questions.length} questions.`,
    );
  }

  // One query at a time: the pooled connection allows a single client.
  const lessonCount = await prisma.listeningLesson.count();
  const questionCount = await prisma.listeningQuestion.count();
  console.log(
    `Listening totals now: ${lessonCount} lessons, ${questionCount} questions.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
