/**
 * Unit checks for the progress aggregation helpers.
 * No database, no network: every case builds attempt rows in memory.
 *
 *   npx tsx scripts/checks/check-progress-stats.ts
 */
import {
  getProgressOverview,
  submissionToAttempt,
  PROGRESS_SKILLS,
  averageOf,
  combineRecent,
  overallAverage,
  percentageOf,
  RECENT_ATTEMPT_LIMIT,
  summariseAttempts,
  toTrendPoints,
  type AttemptInput,
  type AttemptView,
} from "../../src/lib/progress/stats";

let failures = 0;
let checks = 0;

function check(label: string, actual: unknown, expected: unknown) {
  checks += 1;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}${
      ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`
    }`,
  );
}

function attempt(
  id: string,
  score: number,
  maxScore: number,
  completedAt: string | null,
): AttemptInput {
  return {
    id,
    lessonId: `lesson-${id}`,
    lessonTitle: `Lesson ${id}`,
    score,
    maxScore,
    completedAt: completedAt === null ? null : new Date(completedAt),
  };
}

const hour = 60 * 60 * 1000;

console.log("-- percentage guard --");
check("3 of 4 is 75%", percentageOf(3, 4), 75);
check("rounds to the nearest whole percent", percentageOf(2, 3), 67);
check("maxScore 0 has no percentage", percentageOf(0, 0), null);
check("positive score with maxScore 0 has no percentage", percentageOf(5, 0), null);
check("negative maxScore has no percentage", percentageOf(3, -4), null);
check("NaN score has no percentage", percentageOf(Number.NaN, 4), null);
check("score above maxScore clamps to 100", percentageOf(7, 5), 100);
check("negative score clamps to 0", percentageOf(-2, 5), 0);

console.log("-- averaging --");
check("empty list averages to null", averageOf([]), null);
check("single value", averageOf([80]), 80);
check("mean of two values", averageOf([60, 90]), 75);
check("mean is rounded once, not per value", averageOf([67, 67, 68]), 67);

console.log("-- zero attempts --");
const zero = summariseAttempts("reading", []);
check("attempt count", zero.attemptCount, 0);
check("scored attempts", zero.scoredAttemptCount, 0);
check("average is null", zero.averagePercentage, null);
check("best is null", zero.bestPercentage, null);
check("recent is empty", zero.recent, []);
check("trend is empty", zero.trend, []);

console.log("-- maxScore = 0 --");
const zeroMarks = summariseAttempts("listening", [
  attempt("a", 0, 0, "2026-11-01T09:00:00.000Z"),
  attempt("b", 4, 5, "2026-11-02T09:00:00.000Z"),
  attempt("c", 5, 5, "2026-11-03T09:00:00.000Z"),
]);
check("zero-mark attempt still counts as an attempt", zeroMarks.attemptCount, 3);
check("zero-mark attempt is excluded from scored attempts", zeroMarks.scoredAttemptCount, 2);
check("average ignores the zero-mark attempt", zeroMarks.averagePercentage, 90);
check("best ignores the zero-mark attempt", zeroMarks.bestPercentage, 100);
check(
  "zero-mark attempt keeps a null percentage",
  zeroMarks.recent.map((item) => item.percentage),
  [100, 80, null],
);
check(
  "zero-mark attempt is dropped from the trend",
  zeroMarks.trend.map((point) => point.percentage),
  [80, 100],
);

const onlyZeroMarks = summariseAttempts("reading", [
  attempt("z1", 0, 0, "2026-11-01T09:00:00.000Z"),
  attempt("z2", 0, 0, "2026-11-02T09:00:00.000Z"),
]);
check("only zero-max attempts: attempt count", onlyZeroMarks.attemptCount, 2);
check("only zero-max attempts: no average", onlyZeroMarks.averagePercentage, null);
check("only zero-max attempts: no best", onlyZeroMarks.bestPercentage, null);
check("only zero-max attempts: no trend", onlyZeroMarks.trend, []);

console.log("-- incomplete attempts are ignored --");
const mixed = summariseAttempts("reading", [
  attempt("done", 6, 10, "2026-11-02T09:00:00.000Z"),
  attempt("open", 9, 10, null),
]);
check("in-progress attempt is not counted", mixed.attemptCount, 1);
check("in-progress attempt is not averaged", mixed.averagePercentage, 60);
check(
  "in-progress attempt is not listed",
  mixed.recent.map((item) => item.id),
  ["done"],
);

console.log("-- ordering, limit and trend --");
const many: AttemptInput[] = Array.from({ length: 12 }, (_, index) =>
  attempt(
    `a${index + 1}`,
    index + 1,
    12,
    new Date(Date.UTC(2026, 10, 1, 9) + index * hour).toISOString(),
  ),
);
const manyStats = summariseAttempts("reading", many);
check("limit is 10", RECENT_ATTEMPT_LIMIT, 10);
check("all attempts counted", manyStats.attemptCount, 12);
check("recent is capped at 10", manyStats.recent.length, 10);
check("recent is newest first", manyStats.recent[0].id, "a12");
check("recent ends at the 10th newest", manyStats.recent[9].id, "a3");
check("trend is oldest first", manyStats.trend[0].id, "a3");
check("trend ends at the newest", manyStats.trend[9].id, "a12");
check(
  "trend excludes attempts outside the recent window",
  manyStats.trend.length,
  10,
);
check(
  "percentages stay in 0-100",
  manyStats.recent.every(
    (item) => item.percentage === null || (item.percentage >= 0 && item.percentage <= 100),
  ),
  true,
);

console.log("-- averaging across attempts --");
const averages = summariseAttempts("listening", [
  attempt("a", 1, 4, "2026-11-01T09:00:00.000Z"), // 25%
  attempt("b", 3, 4, "2026-11-02T09:00:00.000Z"), // 75%
  attempt("c", 4, 4, "2026-11-03T09:00:00.000Z"), // 100%
]);
check("average of 25/75/100", averages.averagePercentage, 67);
check("best of 25/75/100", averages.bestPercentage, 100);
check("scored attempts", averages.scoredAttemptCount, 3);

console.log("-- combining skills --");
const readingStats = summariseAttempts("reading", [
  attempt("r1", 5, 10, "2026-11-01T09:00:00.000Z"),
  attempt("r2", 10, 10, "2026-11-04T09:00:00.000Z"),
]);
const listeningStats = summariseAttempts("listening", [
  attempt("l1", 8, 10, "2026-11-02T09:00:00.000Z"),
  attempt("l2", 2, 10, "2026-11-03T09:00:00.000Z"),
]);
const combined = combineRecent([readingStats, listeningStats]);
check("combined is newest first", combined.map((item) => item.id), ["r2", "l2", "l1", "r1"]);
check("combined keeps the skill on each row", combined.map((item) => item.skill), [
  "reading",
  "listening",
  "listening",
  "reading",
]);
check("combined respects the limit", combineRecent([readingStats, listeningStats], 2).length, 2);
check(
  "combined with no attempts is empty",
  combineRecent([summariseAttempts("reading", []), summariseAttempts("listening", [])]),
  [],
);

console.log("-- overall average --");
check(
  "weighted across both skills",
  overallAverage([readingStats, listeningStats]),
  63,
);
check(
  "no scored attempts anywhere",
  overallAverage([
    summariseAttempts("reading", [attempt("x", 0, 0, "2026-11-01T09:00:00.000Z")]),
    summariseAttempts("listening", []),
  ]),
  null,
);
check(
  "one skill with data",
  overallAverage([summariseAttempts("reading", []), listeningStats]),
  50,
);

console.log("-- trend helper --");
const views: AttemptView[] = [
  {
    id: "v2",
    skill: "reading",
    lessonId: "l2",
    lessonTitle: "Second",
    score: 4,
    maxScore: 5,
    completedAt: new Date("2026-11-02T09:00:00.000Z"),
    percentage: 80,
  },
  {
    id: "v1",
    skill: "reading",
    lessonId: "l1",
    lessonTitle: "First",
    score: 0,
    maxScore: 0,
    completedAt: new Date("2026-11-01T09:00:00.000Z"),
    percentage: null,
  },
];
check("drops unscored views and reverses to oldest-first", toTrendPoints(views).map((p) => p.id), [
  "v2",
]);

async function checkFourSkills() {
  const date = new Date("2026-11-05T09:00:00.000Z");
  const submission = (id: string, score?: number | null) => ({
    id, promptId: `prompt-${id}`, submittedAt: date,
    prompt: { title: `Prompt ${id}` },
    assessment: score === undefined ? null : { overallScore: score },
  });
  for (const [score, expected] of [[75.4, 75], [null, null], [undefined, null], [NaN, null], [Infinity, null], [-5, 0], [150, 100]] as const) {
    const mapped = submissionToAttempt(submission("mapped", score));
    check(`mapped percentage ${String(score)}`, percentageOf(mapped.score, mapped.maxScore), expected);
    check(`mapped marks ${String(score)}`, mapped.maxScore, expected === null ? 0 : 100);
    check(`mapped score ${String(score)}`, mapped.score, expected === null ? 0 : score);
  }
  const mapped = submissionToAttempt(submission("mapped", 75));
  check("submission identity and prompt title", [mapped.id, mapped.lessonId, mapped.lessonTitle, mapped.completedAt], ["mapped", "prompt-mapped", "Prompt mapped", date]);
  check("missing submittedAt excluded", summariseAttempts("writing", [submissionToAttempt({ ...submission("missing", 90), submittedAt: undefined })]).attemptCount, 0);
  for (const skill of PROGRESS_SKILLS) {
    const stats = summariseAttempts(skill, [attempt("zero", 5, 0, date.toISOString()), attempt("negative", 5, -1, date.toISOString())]);
    check(`${skill} invalid denominators`, [stats.attemptCount, stats.scoredAttemptCount, stats.percentageSum, stats.averagePercentage, stats.bestPercentage, stats.trend], [2, 0, 0, null, null, []]);
  }
  const writing = summariseAttempts("writing", [submissionToAttempt(submission("w1", 100)), submissionToAttempt(submission("w2"))]);
  const speaking = summariseAttempts("speaking", [submissionToAttempt(submission("s1", 0))]);
  check("unassessed excluded from aggregates", [writing.attemptCount, writing.scoredAttemptCount, writing.percentageSum, writing.averagePercentage, writing.bestPercentage, writing.trend.map(p => p.id)], [2, 1, 100, 100, 100, ["w1"]]);
  check("speaking uses overallScore only", [speaking.averagePercentage, speaking.bestPercentage, speaking.percentageSum], [0, 0, 0]);
  const four = [readingStats, listeningStats, writing, speaking];
  check("four skill weighted mean (350 / 6)", overallAverage(four), 58);
  check("unweighted skill mean differs", averageOf(four.map(s => s.averagePercentage!)), 56);
  check("four skill merge and id ties", combineRecent(four).map(a => a.id), ["s1", "w1", "w2", "r2", "l2", "l1", "r1"]);
  check("four skill cap", combineRecent([manyStats, listeningStats, writing, speaking]).length, 10);
  check("exact SkillStats keys", Object.keys(speaking).sort(), ["skill", "attemptCount", "scoredAttemptCount", "percentageSum", "averagePercentage", "bestPercentage", "recent", "trend"].sort());
  check("exact AttemptView keys", Object.keys(speaking.recent[0]).sort(), ["id", "skill", "lessonId", "lessonTitle", "score", "maxScore", "completedAt", "percentage"].sort());
  for (const item of combineRecent(four)) {
    check(`result link ${item.id}`, `/${item.skill}/${item.lessonId}/result/${item.id}`,
      `/${item.skill}/${item.skill === "writing" || item.skill === "speaking" ? "prompt" : "lesson"}-${item.id}/result/${item.id}`);
  }

  for (const skill of ["writing", "speaking"] as const) {
    const ordered = summariseAttempts(skill, [
      submissionToAttempt({ ...submission("later", 90), submittedAt: new Date("2026-11-06T00:00:00Z") }),
      submissionToAttempt({ ...submission("earlier", 30), submittedAt: new Date("2026-11-01T00:00:00Z") }),
      submissionToAttempt(submission("tie-b", 60)),
      submissionToAttempt(submission("tie-a")),
    ]);
    check(`${skill} average and best`, [ordered.averagePercentage, ordered.bestPercentage, ordered.percentageSum], [60, 90, 180]);
    check(`${skill} recent ordering and ties`, ordered.recent.map(a => a.id), ["later", "tie-a", "tie-b", "earlier"]);
    check(`${skill} trend oldest to newest and assessed only`, ordered.trend.map(a => a.id), ["earlier", "tie-b", "later"]);
  }
  check("assessment property absent", submissionToAttempt({ id: "absent", promptId: "p", prompt: { title: "P" }, submittedAt: date }).maxScore, 0);

  type Row = { userId: string; status?: string; completedAt?: Date | null; submittedAt?: Date | null };
  type Query = { where: { userId: string; status?: { not: string }; completedAt?: { not: null } } };
  function fakeDb(rows: Record<string, Row[]>) {
    const order: string[] = [];
    let active = false;
    const db = Object.fromEntries(["readingAttempt", "listeningAttempt", "writingSubmission", "speakingSubmission"].map(table => [table, {
      async findMany(query: Query) {
        if (active) throw new Error("Overlapping reads");
        active = true;
        order.push(`start:${table}`);
        check(`${table} user ownership`, query.where.userId, "learner");
        check(`${table} exclusion filter`, table.endsWith("Submission") ? query.where.status : query.where.completedAt, table.endsWith("Submission") ? { not: "DRAFT" } : { not: null });
        await Promise.resolve();
        const result = (rows[table] ?? []).filter(row => row.userId === query.where.userId && (!query.where.status || row.status !== query.where.status.not) && (!query.where.completedAt || row.completedAt != null));
        order.push(`finish:${table}`);
        active = false;
        return result;
      },
    }]));
    return { db: db as unknown as NonNullable<Parameters<typeof getProgressOverview>[1]>, order };
  }
  const tables = ["readingAttempt", "listeningAttempt", "writingSubmission", "speakingSubmission"];
  const rows = Object.fromEntries(tables.map((table, index) => {
    const isSubmission = index > 1;
    const base = isSubmission ? submission(index === 2 ? "w1" : "s1", index === 2 ? 100 : 0) : {
      ...attempt(index === 0 ? "r" : "l", 50, 100, date.toISOString()), lesson: { title: "Lesson" },
    };
    return [table, [
      { ...base, userId: "learner", status: "ASSESSED" },
      { ...base, id: "other", userId: "other", status: "ASSESSED" },
      { ...base, id: "draft", userId: "learner", status: "DRAFT", completedAt: null },
      ...(isSubmission ? [{ ...submission("unscored"), userId: "learner", status: "SUBMITTED" }] : []),
    ]];
  }));
  const fake = fakeDb(rows);
  const overview = await getProgressOverview("learner", fake.db);
  check("all reads sequential", fake.order, tables.flatMap(t => [`start:${t}`, `finish:${t}`]));
  check("ownership and drafts excluded", overview.recentAttempts.some(a => a.id === "other" || a.id === "draft"), false);
  check("overview counts", [overview.totalAttempts, overview.totalScoredAttempts, overview.overallAveragePercentage], [6, 4, 50]);
  check("writing overview aggregates", [overview.writing.attemptCount, overview.writing.scoredAttemptCount, overview.writing.averagePercentage, overview.writing.bestPercentage, overview.writing.percentageSum], [2, 1, 100, 100, 100]);
  check("speaking overview submitted counts", [overview.speaking.attemptCount, overview.speaking.scoredAttemptCount], [2, 1]);
  const legacyRows = Object.fromEntries([["readingAttempt", readingStats], ["listeningAttempt", listeningStats]].map(([table, stats]) => [table as string, (stats as typeof readingStats).recent.map(a => ({ ...a, userId: "learner", lesson: { title: a.lessonTitle } }))]));
  const legacy = await getProgressOverview("learner", fakeDb(legacyRows).db);
  check("legacy reading unchanged", legacy.reading, readingStats);
  check("legacy listening unchanged", legacy.listening, listeningStats);
  check("legacy overall unchanged", legacy.overallAveragePercentage, 63);
  const empty = await getProgressOverview("learner", fakeDb({}).db);
  check("empty overview totals", [empty.totalAttempts, empty.totalScoredAttempts, empty.overallAveragePercentage, empty.recentAttempts], [0, 0, null, []]);
  for (const skill of PROGRESS_SKILLS) check(`empty ${skill}`, empty[skill], summariseAttempts(skill, []));
  const unscored = await getProgressOverview("learner", fakeDb({ writingSubmission: [{ ...submission("only"), userId: "learner", status: "SUBMITTED" }] }).db);
  check("only unassessed overview", [unscored.totalAttempts, unscored.totalScoredAttempts, unscored.overallAveragePercentage, unscored.writing.percentageSum, unscored.writing.bestPercentage, unscored.writing.trend], [1, 0, null, 0, null, []]);
  check("rounded percentages summed before overall division", overallAverage([averages, summariseAttempts("writing", [submissionToAttempt(submission("round", 0))])]), 50);
}

checkFourSkills().then(() => {
  console.log("");
  console.log(`${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
