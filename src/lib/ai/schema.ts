export type Correction = { original: string; corrected: string; errorType: string; explanation: string };
export type Assessment = {
  grammarScore: number; vocabularyScore: number; coherenceScore: number;
  taskAchievementScore: number; overallScore: number;
  corrections: Correction[]; suggestions: string[]; summary: string;
};
export function validateAssessment(raw: string, text: string): Assessment {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid AI JSON");
  const keys = ["grammarScore", "vocabularyScore", "coherenceScore", "taskAchievementScore"] as const;
  for (const key of keys) if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 100) throw new Error("Invalid AI score");
  if (Object.keys(value).some(key => ![...keys, "overallScore", "corrections", "suggestions", "summary"].includes(key))) throw new Error("Unexpected AI field");
  if (typeof value.summary !== "string" || !value.summary.trim() || value.summary.length > 2000 || !Array.isArray(value.corrections) || value.corrections.length > 100 || !Array.isArray(value.suggestions) || value.suggestions.length > 5 || value.suggestions.some((s: unknown) => typeof s !== "string" || !s.trim() || s.length > 2000)) throw new Error("Invalid AI feedback");
  for (const c of value.corrections) {
    if (!c || typeof c !== "object" || Object.keys(c).sort().join() !== "corrected,errorType,explanation,original" || Object.values(c).some(v => typeof v !== "string" || !v.trim() || v.length > 2000)) throw new Error("Invalid AI correction");
  }
  return { ...value, overallScore: keys.reduce((sum, key) => sum + value[key], 0) / 4,
    corrections: value.corrections.filter((c: Correction) => text.includes(c.original)) };
}
