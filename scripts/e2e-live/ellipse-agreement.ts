/**
 * How well does the Writing assessment agree with human raters?
 * Scores a stratified sample of the ELLIPSE corpus (Crossley et al., 2023,
 * CC BY 4.0, github.com/scrosseye/ELLIPSE-Corpus) with exactly the prompt,
 * provider and validation the application uses, then reports Spearman
 * correlations against the human scores and between the two human raters.
 *
 *   npx tsx scripts/e2e-live/ellipse-agreement.ts --data <folder> --plan          sample + cost estimate, no call
 *   node --env-file=.env --import tsx scripts/e2e-live/ellipse-agreement.ts --data <folder> --run --confirm-paid --max-usd 0.5
 *   npx tsx scripts/e2e-live/ellipse-agreement.ts --data <folder> --analyze        results only, no call
 *
 * <folder> holds ELLIPSE_Final_github_train.csv and ellipsis_raw_rater_scores_anon_all_essay.csv.
 * Results are appended to <folder>/results.jsonl, so an interrupted run resumes.
 * Paid: DeepSeek, one call per essay, no retry; the run stops before the cap.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { MAX_TOKENS, deepSeekProvider, providerConfig } from "../../src/lib/ai/provider";
import { prices } from "../../src/lib/ai/cost";
import { validateAssessment } from "../../src/lib/ai/schema";
import { buildMessages } from "../../src/lib/writing/prompt";

const args = process.argv.slice(2);
const value = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dir = value("--data");
if (!dir) throw new Error("pass --data <folder>");
const SAMPLE = Number(value("--sample") ?? 150);
const SEED = Number(value("--seed") ?? 20261117);

// ---------------------------------------------------------------- CSV
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const key = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 300).toLowerCase();

// ---------------------------------------------------------------- sample
type Essay = { id: string; text: string; prompt: string; words: number; human: Record<string, number>; r1?: Record<string, number>; r2?: Record<string, number> };
const DIMS = ["Overall", "Cohesion", "Vocabulary", "Grammar"] as const;

function loadSample(): Essay[] {
  const train = parseCsv(readFileSync(path.join(dir!, "ELLIPSE_Final_github_train.csv"), "utf8"));
  const raw = parseCsv(readFileSync(path.join(dir!, "ellipsis_raw_rater_scores_anon_all_essay.csv"), "utf8"));
  const byText = new Map(raw.map((r) => [key(r.Text), r]));
  // Deterministic shuffle (mulberry32) so the same seed gives the same sample.
  let s = SEED >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const usable = train
    .map((r): Essay | null => {
      const words = Number(r.num_words);
      const match = byText.get(key(r.full_text));
      if (!match || words < 150 || words > 700) return null;
      const pick = (src: Record<string, string>, suffix: string) => Object.fromEntries(DIMS.map((d) => [d, Number(src[`${d}${suffix}`])]));
      const r1 = pick(match, "_1"); const r2 = pick(match, "_2");
      if (DIMS.some((d) => !Number.isFinite(r1[d]) || !Number.isFinite(r2[d]))) return null;
      return { id: r.text_id_kaggle, text: r.full_text, prompt: r.prompt, words, human: pick(r, ""), r1, r2 };
    })
    .filter((e): e is Essay => e !== null);
  // Spread across the Overall scale: six bands, equal draws (as far as each band allows).
  const bands = [[1, 2], [2.5, 2.5], [3, 3], [3.5, 3.5], [4, 4], [4.5, 5]];
  const per = Math.ceil(SAMPLE / bands.length);
  const out: Essay[] = [];
  for (const [lo, hi] of bands) {
    const pool = usable.filter((e) => e.human.Overall >= lo && e.human.Overall <= hi);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    out.push(...pool.slice(0, per));
  }
  console.log(`usable essays with both raters: ${usable.length}; sample ${out.length} (${bands.map(([lo, hi]) => `${lo}-${hi}: ${out.filter((e) => e.human.Overall >= lo && e.human.Overall <= hi).length}`).join(", ")})`);
  return out.slice(0, SAMPLE);
}

const submissionOf = (e: Essay) => ({ finalText: e.text, prompt: { promptText: `Write an essay on the topic: ${e.prompt}.`, minWords: null, maxWords: null } });

// ---------------------------------------------------------------- statistics
function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < order.length;) {
    let j = i; while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function pearson(a: number[], b: number[]): number {
  const n = a.length; const ma = a.reduce((x, y) => x + y, 0) / n; const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}
const spearman = (a: number[], b: number[]) => pearson(ranks(a), ranks(b));
function bootstrap(a: number[], b: number[], times = 2000): [number, number] {
  let s = 12345; const rand = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const out: number[] = [];
  for (let t = 0; t < times; t++) {
    const idx = a.map(() => Math.floor(rand() * a.length));
    const v = spearman(idx.map((i) => a[i]), idx.map((i) => b[i]));
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((x, y) => x - y);
  return [out[Math.floor(out.length * 0.025)], out[Math.floor(out.length * 0.975)]];
}

type Result = { id: string; ok: boolean; reason?: string; scores?: Record<string, number>; promptTokens?: number; completionTokens?: number; costUsd?: number; ms?: number };
// --results names the output file, so a re-run after a prompt change does not mix with earlier results.
const resultsPath = path.join(dir, value("--results") ?? "results.jsonl");
const readResults = (): Result[] => existsSync(resultsPath) ? readFileSync(resultsPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

// ---------------------------------------------------------------- modes
async function main() {
  const sample = loadSample();
  if (args.includes("--plan")) {
    const env = process.env;
    const price = env.AI_PRICE_INPUT_PER_MTOK_USD ? prices(env) : { input: 0.28, output: 0.42 };
    const inTok = sample.reduce((n, e) => n + JSON.stringify(buildMessages(submissionOf(e))).length / 4, 0);
    const outTok = sample.length * 700;
    console.log(`plan: ${sample.length} calls, about ${Math.round(inTok)} input and ${outTok} output tokens; at ${price.input}/${price.output} USD per million: about ${((inTok * price.input + outTok * price.output) / 1e6).toFixed(3)} USD`);
    return;
  }
  if (args.includes("--run")) {
    if (!args.includes("--confirm-paid")) throw new Error("--run calls a paid provider: add --confirm-paid");
    const cap = Number(value("--max-usd") ?? 0.5);
    const env = process.env;
    if (!env.AI_API_KEY) throw new Error("AI_API_KEY is not set");
    const { model } = providerConfig(env);
    const price = prices(env);
    const provider = deepSeekProvider(env);
    const done = new Set(readResults().map((r) => r.id));
    let spent = readResults().reduce((n, r) => n + (r.costUsd ?? 0), 0);
    for (const essay of sample) {
      if (done.has(essay.id)) continue;
      const worst = (JSON.stringify(buildMessages(submissionOf(essay))).length * price.input + MAX_TOKENS * price.output) / 1e6;
      if (spent + worst > cap) { console.log(`stopping: next call could pass the cap (${spent.toFixed(4)} spent of ${cap})`); break; }
      const started = Date.now();
      const result: Result = { id: essay.id, ok: false };
      try {
        const out = await provider({ model, messages: buildMessages(submissionOf(essay)), max_tokens: MAX_TOKENS }, AbortSignal.timeout(60000));
        result.promptTokens = out.promptTokens; result.completionTokens = out.completionTokens;
        result.costUsd = (out.promptTokens * price.input + out.completionTokens * price.output) / 1e6;
        if (out.finishReason === "length") result.reason = "truncated";
        else {
          const v = validateAssessment(out.text, essay.text);
          result.ok = true;
          result.scores = { grammar: v.grammarScore, vocabulary: v.vocabularyScore, coherence: v.coherenceScore, task: v.taskAchievementScore, overall: v.overallScore, corrections: v.corrections.length };
        }
      } catch (error) {
        result.reason = error instanceof Error ? error.message.slice(0, 120) : "failed";
      }
      result.ms = Date.now() - started;
      spent += result.costUsd ?? 0;
      appendFileSync(resultsPath, JSON.stringify(result) + "\n");
      console.log(`${essay.id} ${result.ok ? "ok" : `FAILED ${result.reason}`} ${result.ms} ms, total ${spent.toFixed(4)} USD`);
    }
    console.log(`run finished: ${spent.toFixed(4)} USD`);
  }
  if (args.includes("--analyze") || args.includes("--run")) {
    const results = new Map(readResults().filter((r) => r.ok).map((r) => [r.id, r]));
    const scored = sample.filter((e) => results.has(e.id));
    const failed = readResults().filter((r) => !r.ok);
    const pairs = [["grammar", "Grammar"], ["vocabulary", "Vocabulary"], ["coherence", "Cohesion"], ["overall", "Overall"]] as const;
    console.log(`\nscored ${scored.length} of ${sample.length}; failed ${failed.length}; cost ${readResults().reduce((n, r) => n + (r.costUsd ?? 0), 0).toFixed(4)} USD`);
    console.log("dimension | system vs human mean: rho [95% CI] | rater 1 vs rater 2: rho | exact / adjacent (<=1) agreement of raters");
    for (const [sys, hum] of pairs) {
      const a = scored.map((e) => results.get(e.id)!.scores![sys]);
      const b = scored.map((e) => e.human[hum]);
      const [lo, hi] = bootstrap(a, b);
      const r1 = scored.map((e) => e.r1![hum]); const r2 = scored.map((e) => e.r2![hum]);
      const exact = r1.filter((x, i) => x === r2[i]).length / r1.length;
      const adjacent = r1.filter((x, i) => Math.abs(x - r2[i]) <= 1).length / r1.length;
      console.log(`${hum} | ${spearman(a, b).toFixed(3)} [${lo.toFixed(3)}, ${hi.toFixed(3)}] | ${spearman(r1, r2).toFixed(3)} | ${(exact * 100).toFixed(1)}% / ${(adjacent * 100).toFixed(1)}%`);
    }
    const ms = readResults().filter((r) => r.ms).map((r) => r.ms!).sort((x, y) => x - y);
    if (ms.length) console.log(`latency median ${ms[Math.floor(ms.length / 2)]} ms; tokens per essay median in ${median(readResults(), "promptTokens")}, out ${median(readResults(), "completionTokens")}`);
  }
}
function median(rs: Result[], k: "promptTokens" | "completionTokens") { const v = rs.map((r) => r[k] ?? 0).filter(Boolean).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; }

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
