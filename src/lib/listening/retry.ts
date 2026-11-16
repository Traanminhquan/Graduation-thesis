import { isListeningAnswerCorrect, parseMatchingPairs, toStringArray, type ListeningQuestionKind } from "./scoring";
export type RetryQuestion = {
  id: string; order: number; type: ListeningQuestionKind; prompt: string;
  options: unknown; acceptedAnswers: unknown; correctOptionIndex: number | null;
  correctAnswer: string; explanation: string | null;
  matchingPairs: unknown;
};
/** Only database questions in the server-derived missed-id set are graded. */
export function gradeRetry(questions: RetryQuestion[], wrongIds: readonly string[], responses: Record<string, string | null | undefined>) {
  const allowed = new Set(wrongIds);
  return questions.filter((question) => allowed.has(question.id)).map((question) => {
    const raw = responses[question.id];
    let response = typeof raw === "string" ? raw.trim().slice(0, question.type === "MATCHING" ? 4000 : 500) || null : null;
    const pairs = parseMatchingPairs(question.matchingPairs);
    if (question.type === "MATCHING") {
      let selections: unknown;
      try { selections = JSON.parse(response ?? ""); } catch { selections = null; }
      response = Array.isArray(selections) && selections.length === pairs.length && pairs.length > 0 && selections.every((value) => typeof value === "string" && value.trim())
        ? JSON.stringify(Object.fromEntries(pairs.map((pair, index) => [pair.left, (selections as string[])[index].trim()]))) : null;
    }
    const gradable = {
      type: question.type, correctAnswer: question.correctAnswer, correctOptionIndex: question.correctOptionIndex,
      options: toStringArray(question.options),
      acceptedAnswers: toStringArray(question.acceptedAnswers),
      matchingPairs: pairs,
    };
    return { id: question.id, order: question.order, type: question.type, prompt: question.prompt,
      response, isCorrect: isListeningAnswerCorrect(gradable, response),
      correctAnswer: question.correctAnswer, explanation: question.explanation };
  });
}
