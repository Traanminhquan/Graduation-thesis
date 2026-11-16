import type { Correction } from "../ai/schema";

const scores = ["topicRelevanceScore", "grammarScore", "vocabularyScore", "coherenceScore"] as const;
const unsupported = /pronunciation|pronounc|intonation|accent|acoustic|prosod|fluency|disfluen|speech rate|speaking speed|filler words?|hesitat/i;
// `claims` is false for fields that quote the learner (original/corrected): a learner may legitimately talk about an accent.
const text = (v: unknown, max: number, claims = true): v is string => typeof v === "string" && !!v.trim() && v.length <= max && (!claims || !unsupported.test(v));
export function validateSpeakingAssessment(raw: string, transcript: string) {
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid AI JSON");
  if (Object.keys(value).some(key => ![...scores, "overallScore", "corrections", "suggestions", "summary"].includes(key))) throw new Error("Unexpected AI field");
  for (const key of scores) if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 100) throw new Error("Invalid AI score");
  if (!text(value.summary, 1200) || !Array.isArray(value.suggestions) || value.suggestions.length > 5 || !value.suggestions.every((s: unknown) => text(s, 300)) || !Array.isArray(value.corrections) || value.corrections.length > 20) throw new Error("Invalid AI feedback");
  for (const c of value.corrections) if (!c || typeof c !== "object" || Array.isArray(c) || Object.keys(c).sort().join() !== "corrected,errorType,explanation,original" || !Object.entries(c).every(([k, v]) => text(v, 500, k !== "original" && k !== "corrected"))) throw new Error("Invalid AI correction");
  const corrections: Correction[] = value.corrections.filter((c: Correction) => transcript.includes(c.original.trim()) && c.corrected.trim() !== c.original.trim());
  return { topicRelevanceScore: value.topicRelevanceScore as number, grammarScore: value.grammarScore as number, vocabularyScore: value.vocabularyScore as number, coherenceScore: value.coherenceScore as number,
    overallScore: scores.reduce((sum, key) => sum + value[key], 0) / 4, summary: value.summary as string, suggestions: value.suggestions as string[], corrections, droppedCorrections: value.corrections.length - corrections.length };
}
