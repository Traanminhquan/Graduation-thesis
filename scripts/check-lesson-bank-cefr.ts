/** Offline only: imports data modules, never executable seed scripts or providers. */
import {
  listeningLessons,
  readingLessons,
  speakingPrompts,
  writingPrompts,
  type Cefr,
  type Level,
} from "./lesson-bank-data";
import { earlyCefrLabels } from "./lesson-bank-cefr";

const skills = ["reading", "listening", "writing", "speaking"] as const;
const labels: Cefr[] = ["A1", "A2", "B1", "B2", "C1"];
const difficultyFor: Record<Cefr, Level> = {
  A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED",
};

// Copied id/difficulty pairs: prisma/seed.ts, scripts/seed-listening.ts,
// scripts/seed-writing.ts and scripts/seed-speaking.ts construct Prisma clients
// and execute main() on import. Do not import them, even for a dry run.
const originalSeedItems: { id: string; difficulty: Level }[] = [
  { id: "seed-reading-1", difficulty: "BEGINNER" },
  { id: "seed-reading-2", difficulty: "INTERMEDIATE" },
  { id: "seed-listening-1", difficulty: "BEGINNER" },
  { id: "seed-listening-2", difficulty: "INTERMEDIATE" },
  { id: "seed-writing-1", difficulty: "BEGINNER" },
  { id: "seed-writing-2", difficulty: "INTERMEDIATE" },
  { id: "seed-writing-3", difficulty: "ADVANCED" },
  { id: "seed-speaking-1", difficulty: "BEGINNER" },
  { id: "seed-speaking-2", difficulty: "INTERMEDIATE" },
  { id: "seed-speaking-3", difficulty: "ADVANCED" },
];

// These aggregate exports include the base, more-* and *-2 data modules.
// Select only 1-24; later batches calibrate the labels but are outside this check.
const expectedIds = skills.flatMap((skill) =>
  Array.from({ length: 24 }, (_, index) => `seed-${skill}-${index + 1}`),
);
const expected = new Set(expectedIds);
const items = [
  ...originalSeedItems,
  ...[...readingLessons, ...listeningLessons, ...writingPrompts, ...speakingPrompts]
    .filter((item) => expected.has(item.id)),
];

let checks = 0;
let failures = 0;
function check(description: string, ok: boolean) {
  checks++;
  if (!ok) {
    failures++;
    console.error(`FAIL ${description}`);
  }
}

const actualIds = Object.keys(earlyCefrLabels);
check("exactly 96 labels", actualIds.length === 96);
check("no unexpected ids", actualIds.every((id) => expected.has(id)));
check("all expected ids present", expectedIds.every((id) => Object.hasOwn(earlyCefrLabels, id)));
check("exactly 96 source items", items.length === 96);
check("source ids unique", new Set(items.map((item) => item.id)).size === items.length);

for (const [id, value] of Object.entries(earlyCefrLabels)) {
  check(`${id}: valid CEFR`, labels.includes(value));
}
for (const id of expectedIds) {
  const sources = items.filter((item) => item.id === id);
  check(`${id}: exactly one source item`, sources.length === 1);
  const value = earlyCefrLabels[id];
  check(`${id}: difficulty agrees with CEFR`,
    labels.includes(value) && sources.length === 1 && sources[0].difficulty === difficultyFor[value]);
}

for (const skill of skills) {
  const counts = labels.map((label) => {
    const count = expectedIds.filter((id) =>
      id.startsWith(`seed-${skill}-`) && earlyCefrLabels[id] === label).length;
    return `${label}=${count}`;
  });
  console.log(`${skill}: ${counts.join(", ")}`);
}

if (failures) {
  console.error(`FAIL ${checks} checks, ${failures} failures`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks} checks; 96 CEFR labels across four skills`);
}
