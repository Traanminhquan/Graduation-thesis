/** Pure comparison of bank content with stored rows. No database imports. */
import { isDeepStrictEqual } from "node:util";
import type { ListeningBankLesson, ReadingBankLesson, WritingBankPrompt, SpeakingBankPrompt } from "./lesson-bank-data";
import { earlyCefrLabels } from "./lesson-bank-cefr";
import { listeningRow, readingRow } from "./lesson-bank-rows";

export type Change = { field: string; from: unknown; to: unknown };
export type LessonDiff = { id: string; changes: Change[]; questionChanges: (Change & { questionId: string })[]; blocked: string | null };
type Row = Record<string, unknown>;
const common = ["title", "topic", "difficulty", "cefr"];
function compare(bank: Row, stored: Row, fields: string[]): Change[] {
  return fields.filter((field) => !isDeepStrictEqual(stored[field] ?? null, bank[field] ?? null))
    .map((field) => ({ field, from: stored[field] ?? null, to: bank[field] ?? null }));
}
function base(item: { id: string; cefr?: string }): Row {
  return { ...item, cefr: item.cefr ?? earlyCefrLabels[item.id] ?? null };
}
export function diffPrompt(kind: "writing" | "speaking", bankItem: WritingBankPrompt | SpeakingBankPrompt, dbRow: Row): LessonDiff {
  const fields = [...common, "promptText", ...(kind === "writing" ? ["minWords", "maxWords"] : ["preparationSeconds", "speakingSeconds"])];
  return { id: bankItem.id, changes: compare(base(bankItem), dbRow, fields), questionChanges: [], blocked: null };
}
export function diffLesson(kind: "reading" | "listening", bankItem: ReadingBankLesson | ListeningBankLesson, dbRow: Row & { questions: Row[] }): LessonDiff {
  const result: LessonDiff = { id: bankItem.id, changes: compare(base(bankItem), dbRow, [...common, ...(kind === "reading" ? ["summary", "content", "estimatedMinutes"] : ["transcript"])]), questionChanges: [], blocked: null };
  const reasons: string[] = [];
  if (bankItem.questions.length !== dbRow.questions.length) reasons.push("question count differs");
  const expected = kind === "reading"
    ? (bankItem as ReadingBankLesson).questions.map((q, i) => readingRow(bankItem.id, i, q))
    : (bankItem as ListeningBankLesson).questions.map((q, i) => listeningRow(bankItem.id, i, q));
  for (const question of expected) {
    const stored = dbRow.questions.find((q) => q.id === question.id);
    if (!stored) { reasons.push(`question ${question.id} is missing or has a different id`); continue; }
    for (const change of compare(question, stored, Object.keys(question).filter((key) => key !== "id" && key !== "lessonId"))) {
      result.questionChanges.push({ questionId: question.id, ...change });
      const removedAnswer = change.field === "acceptedAnswers" && Array.isArray(change.from) && change.from.some((answer) => !Array.isArray(change.to) || !change.to.includes(answer));
      if (["type", "correctAnswer", "correctOptionIndex", "matchingPairs"].includes(change.field) || removedAnswer) {
        reasons.push(`${question.id}: ${change.field} changes existing grading`);
      }
    }
  }
  result.blocked = reasons.length ? reasons.join("; ") : null;
  return result;
}
