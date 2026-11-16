import { type Locale } from "@/i18n/config";
import { progressMessages } from "@/i18n/messages/progress";
import type { PrismaClient } from "@prisma/client";
import { percentageOf } from "@/lib/progress/stats";

export const WEAKNESS_THRESHOLDS = {
  attemptWindow: 20, assessmentWindow: 10, answers: 3, attempts: 2, wrong: 2,
  errorPercent: 40, earlyAnswers: 2, earlyWrong: 1, submissions: 2,
  scoreSamples: 2, lowScore: 60, perSkill: 3, priorities: 5,
  catalogue: 200, submittedPrompts: 50, suggestions: 2, suggestionLength: 300, errorKeyLength: 60,
} as const;
const T = WEAKNESS_THRESHOLDS;
export const SKILLS = ["reading", "listening", "writing", "speaking"] as const;
export type Skill = typeof SKILLS[number];
export type Attempt = { id: string; lessonId: string; completedAt: Date | null; score: number; maxScore: number; answers: { isCorrect: boolean; question: { type: string } }[] };
export type Assessment = { id: string; assessedAt: Date; corrections: unknown; suggestions: unknown; overallScore: number | null; grammarScore: number; vocabularyScore: number; coherenceScore: number; taskAchievementScore?: number; topicRelevanceScore?: number; submission: { id: string; promptId: string; finalText?: string | null; confirmedTranscript?: string | null } };
export type Catalogue = { id: string; title: string; difficulty: string; questions?: { type: string }[] };
export type Recommendation = { href: string; title: string; reason: string };
export type Item = { skill: Skill; key: string; kind: "recurring" | "low-score" | "early"; title: string; evidence: string; rule: string; numerator: number; denominator: number; count: number; wrong: number; recency: number; example?: { original: string; corrected: string; explanation: string }; suggestions?: string[]; recommendation?: Recommendation };
export type SkillOverview = { skill: Skill; status: "insufficient" | "confirmed"; shortfall: string; items: Item[]; startingPoint?: Recommendation };
export type WeaknessOverview = { skills: SkillOverview[]; priorities: Item[] };
export type WeaknessDb = Pick<PrismaClient, "readingAttempt" | "listeningAttempt" | "writingAssessment" | "speakingAssessment" | "readingLesson" | "listeningLesson" | "writingPrompt" | "speakingPrompt" | "writingSubmission" | "speakingSubmission">;
export const humanise = (key: string) => key.replaceAll("_", " ").toLowerCase().replace(/^./, c => c.toUpperCase());
// Question types are a fixed enum, so they get proper names; anything unknown falls back to the humanised key (never invented).
const typeLabel = (key: string, locale: Locale = "en") => progressMessages[locale].questionTypes[key as keyof typeof progressMessages.en.questionTypes] ?? humanise(key);
export function normaliseErrorType(value: string) {
  const key = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return key && key.length <= T.errorKeyLength ? key : null;
}
export function validCorrections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => {
    if (!row || typeof row !== "object" || !["original", "corrected", "errorType", "explanation"].every(k => typeof row[k] === "string" && row[k].trim())) return [];
    const key = normaliseErrorType(row.errorType);
    return key ? [{ key, original: row.original as string, corrected: row.corrected as string, explanation: row.explanation as string }] : [];
  });
}
export function validSuggestions(value: unknown): string[] {
  return Array.isArray(value) && value.every(v => typeof v === "string" && v.trim()) ? value.slice(0, T.suggestions).map(v => v.slice(0, T.suggestionLength)) : [];
}
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const tier = (i: Item) => i.kind === "recurring" ? 1 : i.kind === "low-score" ? 2 : 3;
export function compareItems(a: Item, b: Item): number {
  const base = tier(a) - tier(b);
  if (base) return base;
  const fraction = b.numerator * a.denominator - a.numerator * b.denominator;
  if (a.kind === "low-score") return -fraction || b.count - a.count || b.recency - a.recency || lexical(a.key, b.key);
  if (a.skill === "writing" || a.skill === "speaking") return b.count - a.count || b.wrong - a.wrong || b.recency - a.recency || lexical(a.key, b.key);
  return fraction || b.wrong - a.wrong || b.recency - a.recency || lexical(a.key, b.key);
}
export function topPriorities(items: Item[]): Item[] {
  return items.filter(i => i.kind !== "early").sort((a, b) => {
    const severity = (i: Item) => i.kind === "low-score" ? 100 - i.numerator / i.denominator : 100 * i.numerator / i.denominator;
    const delta = severity(b) - severity(a);
    return tier(a) - tier(b) || (Math.abs(delta) > 1e-9 ? delta : 0) || b.count - a.count || b.recency - a.recency || lexical(`${a.skill}:${a.key}`, `${b.skill}:${b.key}`);
  }).slice(0, T.priorities);
}
function lowScore(skill: Skill, key: string, label: string, samples: { score: number; date: number }[], unit: string, locale: Locale = "en"): Item[] {
  const t = progressMessages[locale];
  const sum = samples.reduce((n, s) => n + s.score, 0);
  if (samples.length < T.scoreSamples || sum >= T.lowScore * samples.length) return [];
  return [{ skill, key, kind: "low-score", title: t.lowTitle(label), evidence: t.lowEvidence(Number((sum / samples.length).toFixed(2)), samples.length, unit, skill), rule: t.lowRule(T.scoreSamples, T.lowScore), numerator: sum, denominator: samples.length, count: samples.length, wrong: 0, recency: Math.max(...samples.map(s => s.date)) }];
}
export function detectAttempts(skill: "reading" | "listening", input: Attempt[], locale: Locale = "en"): Item[] {
  const t = progressMessages[locale];
  const rows = input.filter(r => r.completedAt).sort((a,b) => +b.completedAt! - +a.completedAt! || lexical(a.id,b.id)).slice(0,T.attemptWindow);
  const groups = new Map<string, { answers: number; wrong: number; ids: Set<string>; date: number }>();
  for (const row of rows) for (const answer of row.answers) {
    const g = groups.get(answer.question.type) ?? { answers: 0, wrong: 0, ids: new Set<string>(), date: 0 };
    g.answers++; g.ids.add(row.id);
    if (!answer.isCorrect) { g.wrong++; g.date = Math.max(g.date, +row.completedAt!); }
    groups.set(answer.question.type,g);
  }
  const items: Item[] = [];
  for (const [key,g] of groups) {
    const recurring = g.answers >= T.answers && g.ids.size >= T.attempts && g.wrong >= T.wrong && g.wrong * 100 >= T.errorPercent * g.answers;
    if (!recurring && !(g.answers >= T.earlyAnswers && g.wrong >= T.earlyWrong)) continue;
    items.push({skill,key,kind: recurring ? "recurring" : "early", title: typeLabel(key, locale), evidence: t.answerEvidence(g.wrong, g.answers, typeLabel(key, locale), g.ids.size), rule: recurring ? t.recurringRule(T.answers, T.wrong, T.attempts, T.errorPercent) : t.earlyRule(T.earlyAnswers, T.earlyWrong), numerator:g.wrong,denominator:g.answers,count:g.ids.size,wrong:g.wrong,recency:g.date});
  }
  items.push(...lowScore(skill,"overall",t.skills[skill],rows.flatMap(r => { const score = percentageOf(r.score,r.maxScore); return score === null ? [] : [{score,date:+r.completedAt!}]; }),t.skillAttempts(t.skills[skill]), locale));
  return items.sort(compareItems);
}
export const DIMENSIONS = { writing: ["grammar", "vocabulary", "coherence", "taskAchievement"], speaking: ["topicRelevance", "grammar", "vocabulary", "coherence"] } as const;
export function detectAssessments(skill: "writing" | "speaking", input: Assessment[], locale: Locale = "en"): Item[] {
  const t = progressMessages[locale];
  const rows = [...input].sort((a,b) => +b.assessedAt - +a.assessedAt || lexical(a.id,b.id)).slice(0,T.assessmentWindow);
  const groups = new Map<string, { ids: Set<string>; corrections: number; date: number; example?: Item["example"] }>();
  for (const row of rows) for (const c of validCorrections(row.corrections)) {
    let g = groups.get(c.key);
    if (!g) {
      const text = skill === "writing" ? row.submission.finalText : row.submission.confirmedTranscript;
      g = {ids:new Set(),corrections:0,date:+row.assessedAt,example:text?.includes(c.original) ? {original:c.original,corrected:c.corrected,explanation:c.explanation} : undefined};
      groups.set(c.key,g);
    }
    g.ids.add(row.submission.id); g.corrections++;
  }
  const items: Item[] = [];
  for (const [key,g] of groups) if (g.ids.size >= T.submissions) items.push({skill,key,kind:"recurring",title:humanise(key),evidence:t.correctionEvidence(g.corrections, g.ids.size, skill),rule:t.correctionRule(T.submissions),numerator:g.ids.size,denominator:rows.length,count:g.ids.size,wrong:g.corrections,recency:g.date,example:g.example});
  for (const dimension of DIMENSIONS[skill]) {
    const label = t.dimensions[dimension];
    const scores = rows.flatMap(row => {const score = row[`${dimension}Score` as keyof Assessment]; return typeof score === "number" && Number.isFinite(score) ? [{score,date:+row.assessedAt}] : [];});
    items.push(...lowScore(skill,dimension,label,scores,t.assessments,locale).map(i => ({...i,suggestions:validSuggestions(rows[0]?.suggestions)})));
  }
  return items.sort(compareItems);
}
const difficulty = (c: Catalogue) => ["BEGINNER","INTERMEDIATE","ADVANCED"].indexOf(c.difficulty);
const easier = (a: Catalogue,b: Catalogue) => difficulty(a)-difficulty(b) || lexical(a.id,b.id);
export function matchLesson(skill: Skill, item: Item | undefined, catalogue: Catalogue[], rows: Attempt[], locale: Locale = "en"): Recommendation | undefined {
  const t = progressMessages[locale];
  const latest = new Map<string, number | null>();
  for (const row of [...rows].sort((a,b) => +b.completedAt! - +a.completedAt! || lexical(a.id,b.id))) {
    // A completed, unscored retake still counts as attempted, but must not
    // replace the most recent scored percentage used to order practice.
    if (latest.get(row.lessonId) == null) latest.set(row.lessonId,percentageOf(row.score,row.maxScore));
  }
  const candidates = catalogue.filter(c => (!item ? !latest.has(c.id) : item.kind === "low-score" || c.questions?.some(q => q.type === item.key)));
  candidates.sort((a,b) => Number(latest.has(a.id))-Number(latest.has(b.id)) || (latest.get(a.id) ?? Infinity)-(latest.get(b.id) ?? Infinity) || easier(a,b));
  const c = candidates[0]; if (!c) return;
  const score = latest.get(c.id);
  const reason = !latest.has(c.id) ? t.untried : score == null ? t.recentUnscored : t.lastScore(score);
  return {href:`/${skill}/${c.id}`,title:c.title,reason:item && item.kind !== "low-score" ? t.containsQuestion(typeLabel(item.key, locale), reason) : !latest.has(c.id) ? t.untriedLesson : t.lowest};
}
export function matchPrompt(skill: Skill, catalogue: Catalogue[], submitted: string[], rows: Assessment[], starting = false, locale: Locale = "en"): Recommendation | undefined {
  const t = progressMessages[locale];
  const unseen = catalogue.filter(c => !submitted.includes(c.id));
  const lowest = (id: string) => Math.min(...rows.filter(r => r.submission.promptId === id && typeof r.overallScore === "number" && Number.isFinite(r.overallScore)).map(r => r.overallScore!));
  const candidates = unseen.length || starting ? unseen.sort(easier) : catalogue.filter(c => lowest(c.id) !== Infinity).sort((a,b) => lowest(a.id)-lowest(b.id) || easier(a,b));
  const c = candidates[0];
  return c ? {href:`/${skill}/${c.id}`,title:c.title,reason:t.generalPractice} : undefined;
}
export async function getWeaknessOverview(userId: string, injected?: WeaknessDb, locale: Locale = "en"): Promise<WeaknessOverview> {
  const t = progressMessages[locale];
  const db = injected ?? (await import("@/lib/db")).prisma;
  const shared = injected ? null : await import("./catalogue");
  const attemptQuery = {relationLoadStrategy:"join" as const,where:{userId,completedAt:{not:null}},orderBy:[{completedAt:"desc" as const},{id:"asc" as const}],take:T.attemptWindow,select:{id:true,lessonId:true,completedAt:true,score:true,maxScore:true,answers:{select:{isCorrect:true,question:{select:{type:true}}}}}};
  const reading = await db.readingAttempt.findMany(attemptQuery);
  const listening = await db.listeningAttempt.findMany(attemptQuery);
  const assessmentQuery = {relationLoadStrategy:"join" as const,where:{submission:{userId}},orderBy:[{assessedAt:"desc" as const},{id:"asc" as const}],take:T.assessmentWindow};
  const scores = {id:true,assessedAt:true,corrections:true,suggestions:true,overallScore:true,grammarScore:true,vocabularyScore:true,coherenceScore:true} as const;
  const writing = await db.writingAssessment.findMany({...assessmentQuery,select:{...scores,taskAchievementScore:true,submission:{select:{id:true,promptId:true,finalText:true}}}});
  const speaking = await db.speakingAssessment.findMany({...assessmentQuery,select:{...scores,topicRelevanceScore:true,submission:{select:{id:true,promptId:true,confirmedTranscript:true}}}});
  const skills: SkillOverview[] = [];
  const all: Item[] = [];
  for (const skill of SKILLS) {
    const receptive = skill === "reading" || skill === "listening";
    const attempts = skill === "reading" ? reading : listening;
    const assessments = skill === "writing" ? writing : speaking;
    const items = receptive ? detectAttempts(skill,attempts,locale) : detectAssessments(skill,assessments,locale);
    all.push(...items);
    const confirmed = items.some(i => i.kind !== "early");
    const count = receptive ? attempts.length : assessments.length;
    const shortfall = receptive ? count < T.attempts ? t.moreAttempts(T.attempts-count) : t.noPattern : count === 0 ? t.noAssessment : count < T.submissions ? t.moreSubmissions(T.submissions-count) : t.noPattern;
    const card: SkillOverview = {skill,status:confirmed ? "confirmed" : "insufficient",shortfall,items:items.slice(0,T.perSkill)};
    // Insufficient cards need a neutral starting point even without observed mistakes.
    const catalogueQuery = {orderBy:{id:"asc" as const},take:T.catalogue,select:{id:true,title:true,difficulty:true}};
    if (card.items.length || !confirmed) {
      if (receptive) {
        const query = {...catalogueQuery,select:{...catalogueQuery.select,questions:{select:{type:true}}}};
        const catalogue = shared ? await (skill === "reading" ? shared.readingCatalogue() : shared.listeningCatalogue()) : skill === "reading" ? await db.readingLesson.findMany(query) : await db.listeningLesson.findMany(query);
        for (const item of items) item.recommendation = matchLesson(skill,item,catalogue,attempts,locale);
        if (!confirmed) card.startingPoint = matchLesson(skill,undefined,catalogue,attempts,locale);
      } else {
        const catalogue = shared ? await (skill === "writing" ? shared.writingCatalogue() : shared.speakingCatalogue()) : skill === "writing" ? await db.writingPrompt.findMany(catalogueQuery) : await db.speakingPrompt.findMany(catalogueQuery);
        const query = {where:{userId,status:{not:"DRAFT" as const}},select:{promptId:true},orderBy:{submittedAt:"desc" as const},take:T.submittedPrompts};
        const submitted = skill === "writing" ? await db.writingSubmission.findMany(query) : await db.speakingSubmission.findMany(query);
        for (const item of items) item.recommendation = matchPrompt(skill,catalogue,submitted.map(s => s.promptId),assessments,false,locale);
        if (!confirmed) card.startingPoint = matchPrompt(skill,catalogue,submitted.map(s => s.promptId),assessments,true,locale);
      }
    }
    skills.push(card);
  }
  return {skills,priorities:topPriorities(all)};
}
