/** Offline only: seed sources are parsed, never imported or executed. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { speakingPrompts2, writingPrompts2 } from "../content/lesson-bank-prompts-2";

/** A lesson-bank file (scripts/content), a seed script (scripts) or a repository path, from scripts/checks. */
function sourceUrl(name: string): URL {
  return new URL(name.startsWith("lesson-bank-") ? `../content/${name}` : `../${name}`, import.meta.url);
}

const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const normalise = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const existingTitles = new Set<string>();
for (const file of [
  "lesson-bank-data.ts", "lesson-bank-more-prompts.ts",
  "lesson-bank-more-reading-listening.ts", "seed-writing.ts", "seed-speaking.ts",
  "seed-listening.ts", "../prisma/seed.ts", "../src/lib/conversation/scenarios.ts",
]) {
  const source = ts.createSourceFile(file, readFileSync(sourceUrl(file), "utf8"), ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)
      && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
      && node.name.text === "title" && ts.isStringLiteralLike(node.initializer)) {
      existingTitles.add(normalise(node.initializer.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
assert.ok(existingTitles.size >= 50, "existing titles must be discovered");
const titles = new Set<string>();
const noMarkup = /[<>*#`]|\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u20E3]|\[[^\]]*\]\([^)]*\)|(?:^|\n)\s*(?:[-+] |\d+[.)] )/u;
const forbidden = /\b(?:fictional|imaginary|invented|made-up|adult)\b/iu;
for (const [skill, prompts] of [["writing", writingPrompts2], ["speaking", speakingPrompts2]] as const) {
  assert.deepEqual(prompts.map(({ id }) => id).sort(),
    Array.from({ length: 12 }, (_, index) => `seed-${skill}-${index + 13}`).sort());
  for (const level of levels) {
    assert.equal(prompts.filter(({ difficulty }) => difficulty === level).length, 4, `${skill}: ${level}`);
  }
  for (const prompt of prompts) {
    assert.ok(levels.includes(prompt.difficulty), `${prompt.id}: level`);
    const title = normalise(prompt.title);
    assert.ok(title && !titles.has(title) && !existingTitles.has(title), `${prompt.id}: unique title`);
    titles.add(title);
    for (const value of Object.values(prompt)) {
      if (typeof value === "string") {
        assert.doesNotMatch(value, forbidden, `${prompt.id}: forbidden word`);
        assert.doesNotMatch(value, noMarkup, `${prompt.id}: plain text`);
      }
    }
    const count = prompt.promptText.trim().split(/\s+/u).length;
    assert.ok(count >= 40 && count <= 160, `${prompt.id}: ${count} words`);
    const paragraphs = prompt.promptText.split("\n\n");
    assert.ok(paragraphs.length >= 2 && paragraphs.every((text) => text.trim()), `${prompt.id}: paragraphs`);
  }
}
const ranges = { BEGINNER: [60, 120], INTERMEDIATE: [120, 180], ADVANCED: [180, 260] } as const;
const textTypes = ["email", "review", "story", "report", "article", "letter of complaint", "proposal", "essay"];
const typeCounts = new Map<string, number>();
for (const prompt of writingPrompts2) {
  assert.deepEqual([prompt.minWords, prompt.maxWords], ranges[prompt.difficulty], `${prompt.id}: word range`);
  // Classify the explicit instruction, not incidental mentions in the setting.
  const instruction = prompt.promptText.split("\n\n")[0].match(/\bWrite (?:an?|a short) (email|review|story|report|article|letter of complaint|proposal|essay)\b/u);
  assert.ok(instruction && textTypes.includes(instruction[1]), `${prompt.id}: explicit writing type`);
  const type = instruction[1];
  typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  assert.ok(typeCounts.get(type)! <= 3, `${type}: no more than three prompts`);
}
const durations = { BEGINNER: 60, INTERMEDIATE: 90, ADVANCED: 120 } as const;
for (const prompt of speakingPrompts2) {
  assert.ok(Number.isInteger(prompt.preparationSeconds) && prompt.preparationSeconds >= 15 && prompt.preparationSeconds <= 60, `${prompt.id}: preparation`);
  assert.equal(prompt.speakingSeconds, durations[prompt.difficulty], `${prompt.id}: speaking duration`);
}
console.log("PASS prompts 2: 24 exact ids, four per level per skill, unique titles, ranges, timings, length, paragraphs, plain text, forbidden words and writing type limits (offline)");
