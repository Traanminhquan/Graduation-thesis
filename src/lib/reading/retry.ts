import { isAnswerCorrect, isChoiceQuestion, toStringArray, type ReadingQuestionKind } from "./scoring";
export type RetryQuestion = {
  id: string; order: number; type: ReadingQuestionKind; prompt: string;
  options: unknown; acceptedAnswers: unknown; correctOptionIndex: number | null;
  correctAnswer: string; explanation: string | null;
  
};
/** Only database questions in the server-derived missed-id set are graded. */
export function gradeRetry(questions: RetryQuestion[], wrongIds: readonly string[], responses: Record<string, string | null | undefined>) {
  const allowed = new Set(wrongIds);
  return questions.filter((question) => allowed.has(question.id)).map((question) => {
    const raw = responses[question.id];
    const response = typeof raw === "string" ? raw.trim().slice(0, 500) || null : null;
    const gradable = {
      type: question.type, correctAnswer: question.correctAnswer, correctOptionIndex: question.correctOptionIndex,
      options: toStringArray(question.options),
      acceptedAnswers: isChoiceQuestion(question.type) ? [] : toStringArray(question.acceptedAnswers),
      
    };
    return { id: question.id, order: question.order, type: question.type, prompt: question.prompt,
      response, isCorrect: isAnswerCorrect(gradable, response),
      correctAnswer: question.correctAnswer, explanation: question.explanation };
  });
}
