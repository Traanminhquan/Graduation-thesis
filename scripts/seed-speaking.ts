/**
 * Seeds three sample Speaking prompts.
 *
 *   node --env-file=.env --import tsx scripts/seed-speaking.ts --apply
 *
 * SAFETY GATE: without `--apply` the script only prints what it would upsert
 * and exits without opening a database connection. Seeding needs Tech Lead
 * approval, so the default run is a dry run.
 *
 * Idempotent: every prompt has a deterministic id and is upserted, so running
 * it twice updates the three rows in place and never duplicates or deletes
 * anything. No migration, no schema change, no destructive statement.
 */
import { Difficulty, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedPrompt = {
  /** Deterministic id, so re-seeding updates instead of duplicating. */
  id: string;
  title: string;
  promptText: string;
  topic: string;
  difficulty: Difficulty;
  preparationSeconds: number;
  speakingSeconds: number;
};

const prompts: SeedPrompt[] = [
  {
    id: "seed-speaking-1",
    title: "Describe Your Typical Morning",
    topic: "Daily life",
    difficulty: Difficulty.BEGINNER,
    preparationSeconds: 15,
    speakingSeconds: 60,
    promptText:
      "Describe what you usually do in the morning, from the moment you wake up until you start your day.\n\nMention at least three activities and say how long each one takes. Use the present simple because this is your routine, not a single day.",
  },
  {
    id: "seed-speaking-2",
    title: "A Place You Would Like to Visit",
    topic: "Travel",
    difficulty: Difficulty.INTERMEDIATE,
    preparationSeconds: 30,
    speakingSeconds: 90,
    promptText:
      "Think of a place you have never visited but would like to see.\n\nSay where it is, why it interests you, and what you would do there. Mention one thing that might be difficult about the trip, and finish by saying whether you would go alone or with someone else.",
  },
  {
    id: "seed-speaking-3",
    title: "Should Cities Limit Car Use?",
    topic: "Environment",
    difficulty: Difficulty.ADVANCED,
    preparationSeconds: 45,
    speakingSeconds: 120,
    promptText:
      "Some cities charge drivers to enter the centre, and others have banned cars from certain streets entirely.\n\nGive your opinion on whether cities should limit car use. Support your view with two reasons, acknowledge one argument on the other side, and end with a clear conclusion. Try to use linking words such as \"however\", \"although\" and \"therefore\".",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(
    `${apply ? "APPLYING" : "DRY RUN"} — ${prompts.length} speaking prompts:`,
  );
  for (const prompt of prompts) {
    console.log(
      `  ${prompt.id} · ${prompt.title} · ${prompt.difficulty} · prepare ${prompt.preparationSeconds}s · speak ${prompt.speakingSeconds}s`,
    );
  }

  if (!apply) {
    console.log("");
    console.log("No database connection was opened and nothing was written.");
    console.log("Re-run with --apply to upsert these rows.");
    return;
  }

  for (const prompt of prompts) {
    const { id, ...data } = prompt;

    await prisma.speakingPrompt.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });

    console.log(`Upserted speaking prompt "${prompt.title}" (${id}).`);
  }

  const total = await prisma.speakingPrompt.count();
  console.log(`Speaking prompts now: ${total} rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // No connection is opened on a dry run, but disconnect is harmless.
    await prisma.$disconnect();
  });
