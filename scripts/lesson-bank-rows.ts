/**
 * Pure conversion from the readable lesson-bank data to database rows.
 * Shared by the seed script and the offline check so both see the same rows.
 */
import type { ListeningItem, ReadingItem } from "./lesson-bank-data";

export function readingRow(lessonId: string, index: number, item: ReadingItem) {
  const correctOptionIndex = item.options
    ? item.options.indexOf(item.answer)
    : -1;
  return {
    id: `${lessonId}-q${index + 1}`,
    lessonId,
    order: index + 1,
    type: item.type,
    prompt: item.prompt,
    options: item.options ?? null,
    correctAnswer: item.answer,
    correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : null,
    acceptedAnswers: item.accepted ?? null,
    explanation: item.explanation,
  };
}

export function listeningRow(
  lessonId: string,
  index: number,
  item: ListeningItem,
) {
  const correctOptionIndex = item.options
    ? item.options.indexOf(item.answer ?? "")
    : -1;
  const correctAnswer =
    item.type === "MATCHING"
      ? JSON.stringify(
          Object.fromEntries((item.pairs ?? []).map((p) => [p.left, p.right])),
        )
      : (item.answer ?? "");
  return {
    id: `${lessonId}-q${index + 1}`,
    lessonId,
    order: index + 1,
    type: item.type,
    prompt: item.prompt,
    options: item.options ?? null,
    matchingPairs: item.pairs ?? null,
    correctAnswer,
    correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : null,
    acceptedAnswers: item.accepted ?? null,
    explanation: item.explanation,
  };
}

export function estimateAudioDurationMs(transcript: string): number {
  const words = transcript.trim().split(/\s+/).filter(Boolean).length;
  return Math.round((words / 150) * 60_000);
}
