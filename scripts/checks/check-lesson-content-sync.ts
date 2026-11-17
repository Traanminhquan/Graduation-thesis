import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { listeningLessons, readingLessons, writingPrompts } from "../content/lesson-bank-data";
import { diffLesson, diffPrompt } from "../content/lesson-bank-diff";
import { listeningRow, readingRow } from "../content/lesson-bank-rows";
import { earlyCefrLabels } from "../content/lesson-bank-cefr";

let failures = 0;
function check(name: string, passed: boolean) {
  console.log(`${passed ? "ok" : "FAIL"} ${name}`);
  if (!passed) failures++;
}
const lesson = readingLessons[0];
const row = { ...lesson, cefr: lesson.cefr ?? earlyCefrLabels[lesson.id] ?? null, questions: lesson.questions.map((q, i) => readingRow(lesson.id, i, q)) };
const unchanged = diffLesson("reading", lesson, row);
check("unchanged item", !unchanged.blocked && !unchanged.changes.length && !unchanged.questionChanges.length);
const explanation = structuredClone(row);
explanation.questions[0].explanation += " correction";
const allowed = diffLesson("reading", lesson, explanation);
check("explanation correction allowed", !allowed.blocked && allowed.questionChanges.length === 1);
const answer = structuredClone(row);
answer.questions[0].correctAnswer = "different";
check("correct answer blocked", !!diffLesson("reading", lesson, answer).blocked);
check("question count blocked", !!diffLesson("reading", lesson, { ...row, questions: row.questions.slice(1) }).blocked);
check("JSON arrays compared by value", !diffLesson("reading", lesson, structuredClone(row)).questionChanges.length);
const matching = listeningLessons.find((l) => l.questions.some((q) => q.pairs?.length));
if (matching) {
  // Reverse object key insertion order while preserving JSON values.
  const stored = { ...matching, cefr: matching.cefr ?? earlyCefrLabels[matching.id] ?? null, questions: matching.questions.map((q, i) => ({ ...listeningRow(matching.id, i, q), matchingPairs: q.pairs?.map((p) => ({ right: p.right, left: p.left })) ?? null })) };
  check("JSON object key order ignored", !diffLesson("listening", matching, stored).questionChanges.length);
  const pairsQuestion = stored.questions.find((q) => q.matchingPairs?.length);
  if (pairsQuestion?.matchingPairs) pairsQuestion.matchingPairs[0].right += " changed";
  check("matching pairs change blocked", !!diffLesson("listening", matching, stored).blocked);
}
const prompt = writingPrompts[0];
check("prompt unchanged", !diffPrompt("writing", prompt, { ...prompt, cefr: prompt.cefr ?? earlyCefrLabels[prompt.id] ?? null }).changes.length);
const added = structuredClone(lesson);
added.questions[0].accepted = [...(added.questions[0].accepted ?? []), "extra"];
check("added accepted answer allowed", !diffLesson("reading", added, row).blocked);
const removed = structuredClone(row);
removed.questions[0].acceptedAnswers = ["previously accepted"];
check("removed accepted answer blocked", !!diffLesson("reading", lesson, removed).blocked);
const changedType = structuredClone(row);
changedType.questions[0].type = "FILL_BLANK";
check("question type change blocked", !!diffLesson("reading", lesson, changedType).blocked);
const changedIndex = structuredClone(row);
changedIndex.questions[0].correctOptionIndex = 999;
check("correct option change blocked", !!diffLesson("reading", lesson, changedIndex).blocked);
const wording = structuredClone(lesson);
wording.questions[0].options = wording.questions[0].options?.map((option, i) => i === row.questions[0].correctOptionIndex ? option : option + " revised");
check("option wording keeps correct answer allowed", !diffLesson("reading", wording, row).blocked);
const reordered = { ...row, questions: [...row.questions].reverse() };
check("question query order does not matter", !diffLesson("reading", lesson, reordered).questionChanges.length);
const unrelated = { ...row, audioUrl: "ignored", createdAt: new Date(), attempts: [] };
check("non-seed columns ignored", !diffLesson("reading", lesson, unrelated).changes.length);
check("diff does not mutate input", isDeepStrictEqual(row.questions[0], readingRow(lesson.id, 0, lesson.questions[0])));

const directory = "public/audio/listening";
const manifest = JSON.parse(readFileSync("scripts/content/listening-audio-manifest.json", "utf8")) as Record<string, { transcriptSha256?: string }>;
for (const item of listeningLessons) {
  check(`${item.id} MP3 exists`, existsSync(`${directory}/${item.id}.mp3`));
  check(`${item.id} transcript matches audio`, manifest[item.id]?.transcriptSha256 === createHash("sha256").update(item.transcript).digest("hex"));
}
for (const [id, entry] of Object.entries(manifest)) {
  check(`${id} manifest file exists`, existsSync(`${directory}/${id}.mp3`));
  if (!entry.transcriptSha256) console.log(`unknown ${id} transcript hash`);
}
for (const file of readdirSync(directory).filter((name) => name.endsWith(".mp3"))) check(`${file} manifest entry exists`, !!manifest[file.slice(0, -4)]);
process.exitCode = failures ? 1 : 0;
