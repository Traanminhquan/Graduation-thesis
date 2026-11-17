/**
 * Seeds three sample Writing prompts.
 *
 *   node --env-file=.env --import tsx scripts/seed-writing.ts --apply
 *
 * SAFETY GATE: without `--apply` the script only prints what it would upsert
 * and exits without opening a database connection. Seeding needs explicit
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
  minWords: number;
  maxWords: number;
};

const prompts: SeedPrompt[] = [
  {
    id: "seed-writing-1",
    title: "An Email About a Missed Meeting",
    topic: "Work",
    difficulty: Difficulty.BEGINNER,
    minWords: 60,
    maxWords: 100,
    promptText:
      "You were ill yesterday and missed a team meeting.\n\nWrite a short email to your manager. Explain why you were absent, apologise for not being there, and ask for any notes or action points from the meeting.\n\nBegin with \"Subject:\" and write 60–100 words.",
  },
  {
    id: "seed-writing-2",
    title: "A Review of a Local Café",
    topic: "Lifestyle",
    difficulty: Difficulty.INTERMEDIATE,
    minWords: 120,
    maxWords: 180,
    promptText:
      "A local website is collecting reviews of places to eat and drink in your area.\n\nWrite a review of a café you have visited recently. Describe what you ordered, what the atmosphere was like, and whether you would recommend it to a friend. Give at least one concrete detail for each point.\n\nWrite 120–180 words.",
  },
  {
    id: "seed-writing-3",
    title: "Should Schools Ban Mobile Phones?",
    topic: "Education",
    difficulty: Difficulty.ADVANCED,
    minWords: 180,
    maxWords: 250,
    promptText:
      "Some schools have banned mobile phones during the school day. Others allow them between lessons.\n\nWrite a short opinion essay. State your position clearly, give two reasons supported by examples, and acknowledge one argument on the other side before you conclude.\n\nWrite 180–250 words.",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  console.log(
    `${apply ? "APPLYING" : "DRY RUN"} — ${prompts.length} writing prompts:`,
  );
  for (const prompt of prompts) {
    console.log(
      `  ${prompt.id} · ${prompt.title} · ${prompt.difficulty} · ${prompt.minWords}–${prompt.maxWords} words`,
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

    await prisma.writingPrompt.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });

    console.log(`Upserted writing prompt "${prompt.title}" (${id}).`);
  }

  const total = await prisma.writingPrompt.count();
  console.log(`Writing prompts now: ${total} rows.`);
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
