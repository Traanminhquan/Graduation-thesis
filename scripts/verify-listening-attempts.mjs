/**
 * Read-only verification for the Listening module.
 *
 *   node --env-file=.env scripts/verify-listening-attempts.mjs learner@example.com
 *
 * Prints only the named learner's attempts and table-wide row counts. It never
 * selects other users' rows, never prints DATABASE_URL, and performs no writes
 * (no create/update/delete anywhere in this file).
 */
import { PrismaClient } from "@prisma/client";

const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: node --env-file=.env scripts/verify-listening-attempts.mjs <email>",
  );
  process.exit(2);
}

const prisma = new PrismaClient();

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const attempts = await prisma.listeningAttempt.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      lessonId: true,
      score: true,
      maxScore: true,
      startedAt: true,
      completedAt: true,
      lesson: { select: { title: true } },
      answers: {
        select: {
          response: true,
          isCorrect: true,
          questionId: true,
          question: { select: { order: true, type: true, lessonId: true } },
        },
        orderBy: { question: { order: "asc" } },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  console.log(`Learner: ${user.email} (${user.id})`);
  console.log(`Attempts for this learner: ${attempts.length}`);

  for (const attempt of attempts) {
    const correct = attempt.answers.filter((answer) => answer.isCorrect).length;
    const sameLesson = attempt.answers.every(
      (answer) => answer.question.lessonId === attempt.lessonId,
    );
    console.log("");
    console.log(`- attempt ${attempt.id}`);
    console.log(`  lesson      : ${attempt.lesson.title} (${attempt.lessonId})`);
    console.log(`  score       : ${attempt.score}/${attempt.maxScore}`);
    console.log(
      `  completedAt : ${attempt.completedAt?.toISOString() ?? "null"}`,
    );
    console.log(`  answers     : ${attempt.answers.length} rows, ${correct} correct`);
    console.log(
      `  questions   : ${attempt.answers
        .map(
          (answer) =>
            `Q${answer.question.order}:${answer.question.type}:${
              answer.isCorrect ? "ok" : "no"
            }:${JSON.stringify(answer.response)}`,
        )
        .join(" | ")}`,
    );
    console.log(`  all answers belong to the attempt's lesson: ${sameLesson}`);
  }

  // Sequential counts: the pooler rejects bursts of parallel connections.
  const attemptTotal = await prisma.listeningAttempt.count();
  const answerTotal = await prisma.listeningAnswer.count();
  const lessonTotal = await prisma.listeningLesson.count();
  const questionTotal = await prisma.listeningQuestion.count();
  console.log("");
  console.log(
    `Table totals (whole board, counts only): listening_lessons=${lessonTotal}, listening_questions=${questionTotal}, listening_attempts=${attemptTotal}, listening_answers=${answerTotal}`,
  );
} finally {
  await prisma.$disconnect();
}
