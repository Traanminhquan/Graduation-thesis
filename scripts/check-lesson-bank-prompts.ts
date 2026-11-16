/** Offline prompt validation; seed files are read as text, never executed. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

import { moreSpeakingPrompts, moreWritingPrompts } from "./lesson-bank-more-prompts";

const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const existingTitles = new Set<string>();
const normalise = (title: string) => title.normalize("NFKC").trim().toLowerCase();

// Parse title properties so every bank title is covered without importing seeds
// (which construct database clients) or depending on their export structure.
for (const name of ["lesson-bank-data.ts", "seed-writing.ts", "seed-speaking.ts"]) {
  const source = ts.createSourceFile(name, readFileSync(new URL(name, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
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
assert.ok(existingTitles.size >= 18, "existing titles must be discovered");
const titles = new Set<string>();
for (const [skill, prompts] of [
  ["writing", moreWritingPrompts],
  ["speaking", moreSpeakingPrompts],
] as const) {
  assert.deepEqual(prompts.map((prompt) => prompt.id).sort(),
    Array.from({ length: 6 }, (_, index) => `seed-${skill}-${index + 7}`).sort());
  for (const level of levels) {
    assert.equal(prompts.filter((prompt) => prompt.difficulty === level).length, 2);
  }
  for (const prompt of prompts) {
    assert.ok(levels.includes(prompt.difficulty), `${prompt.id}: level`);
    const title = normalise(prompt.title);
    assert.ok(title.length > 0 && !titles.has(title) && !existingTitles.has(title), `${prompt.id}: unique title`);
    titles.add(title);
    const count = prompt.promptText.trim().split(/\s+/u).length;
    assert.ok(count >= 40 && count <= 160, `${prompt.id}: ${count} words`);
    const paragraphs = prompt.promptText.split("\n\n");
    assert.ok(paragraphs.length >= 2 && paragraphs.every((text) => text.trim().length > 0), `${prompt.id}: paragraphs`);
    assert.doesNotMatch(prompt.promptText, /[<>*#`]|\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u20E3]/u);
  }
}
const ranges = { BEGINNER: [60, 120], INTERMEDIATE: [120, 180], ADVANCED: [180, 260] } as const;
for (const prompt of moreWritingPrompts) {
  assert.deepEqual([prompt.minWords, prompt.maxWords], ranges[prompt.difficulty], `${prompt.id}: word range`);
}
const durations = { BEGINNER: 60, INTERMEDIATE: 90, ADVANCED: 120 } as const;
for (const prompt of moreSpeakingPrompts) {
  assert.ok(Number.isInteger(prompt.preparationSeconds) && prompt.preparationSeconds >= 15 && prompt.preparationSeconds <= 60);
  assert.equal(prompt.speakingSeconds, durations[prompt.difficulty], `${prompt.id}: speaking duration`);
}
console.log("PASS lesson bank prompts: twelve exact ids, two per level per skill, unique titles, word ranges, timings and plain text (offline)");
