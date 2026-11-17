/** Offline validation: seed sources are parsed, never executed. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

import type { Cefr, Level } from "../content/lesson-bank-data";
import { speakingPrompts3, writingPrompts3 } from "../content/lesson-bank-prompts-3";

/** A lesson-bank file (scripts/content), a seed script (scripts) or a repository path, from scripts/checks. */
function sourceUrl(name: string): URL {
  return new URL(name.startsWith("lesson-bank-") ? `../content/${name}` : `../${name}`, import.meta.url);
}

const normalise = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const existingTitles = new Set<string>();
for (const name of [
  "lesson-bank-data.ts", "lesson-bank-more-prompts.ts", "lesson-bank-more-reading-listening.ts",
  "lesson-bank-reading-2.ts", "lesson-bank-listening-2.ts", "lesson-bank-prompts-2.ts",
  "seed-writing.ts", "seed-speaking.ts", "seed-listening.ts",
  "../prisma/seed.ts", "../src/lib/conversation/scenarios.ts",
]) {
  const source = ts.createSourceFile(name, readFileSync(sourceUrl(name), "utf8"), ts.ScriptTarget.Latest, true);
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
assert.ok(existingTitles.size >= 100, "existing titles must be discovered");

const levels: Record<Cefr, Level> = {
  A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED",
};
const spread: Record<Cefr, number> = { A1: 2, A2: 2, B1: 2, B2: 2, C1: 1 };
const ranges: Record<Cefr, readonly [number, number]> = {
  A1: [40, 80], A2: [60, 120], B1: [120, 180], B2: [180, 260], C1: [220, 300],
};
const durations: Record<Cefr, number> = { A1: 45, A2: 60, B1: 90, B2: 120, C1: 120 };
const titles = new Set<string>();
const plainText = /[<>*#`]|\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u20E3]|\[[^\]]*\]\([^)]*\)|(?:^|\n)\s*(?:[-+] |\d+[.)] )/u;
const forbidden = /fictional|imaginary|invented|made-up|adult/iu;

for (const [skill, prompts] of [["writing", writingPrompts3], ["speaking", speakingPrompts3]] as const) {
  assert.deepEqual(prompts.map(({ id }) => id).sort(),
    Array.from({ length: 9 }, (_, index) => `seed-${skill}-${index + 25}`).sort(), `${skill}: exact ids`);
  for (const cefr of Object.keys(spread) as Cefr[]) {
    assert.equal(prompts.filter((prompt) => prompt.cefr === cefr).length, spread[cefr], `${skill}: ${cefr} spread`);
  }
  for (const prompt of prompts) {
    assert.ok(prompt.cefr && Object.hasOwn(levels, prompt.cefr), `${prompt.id}: CEFR`);
    assert.equal(prompt.difficulty, levels[prompt.cefr], `${prompt.id}: difficulty`);
    const title = normalise(prompt.title);
    assert.ok(title && !existingTitles.has(title) && !titles.has(title), `${prompt.id}: unique title`);
    titles.add(title);
    for (const [field, value] of Object.entries(prompt)) {
      if (typeof value === "string") {
        assert.ok(value.trim(), `${prompt.id}: nonempty ${field}`);
        assert.doesNotMatch(value, forbidden, `${prompt.id}: forbidden word in ${field}`);
        assert.doesNotMatch(value, plainText, `${prompt.id}: markup in ${field}`);
      }
    }
    const count = prompt.promptText.trim().split(/\s+/u).length;
    const minimum = skill === "writing" && prompt.cefr === "A1" ? 30 : 40;
    assert.ok(count >= minimum && count <= 160, `${prompt.id}: ${count} words`);
    const paragraphs = prompt.promptText.split("\n\n");
    assert.ok(paragraphs.length >= 2 && paragraphs.every((paragraph) => paragraph.trim()), `${prompt.id}: paragraphs`);
    assert.match(prompt.promptText, /\byou(?:r)?\b/iu, `${prompt.id}: direct address`);
    assert.match(paragraphs.at(-1)!, /^Use [^\n]+[.]$/u, `${prompt.id}: language hint`);
  }
}

const textTypes = new Map<string, number>();
for (const prompt of writingPrompts3) {
  assert.deepEqual([prompt.minWords, prompt.maxWords], ranges[prompt.cefr!], `${prompt.id}: word range`);
  const firstParagraph = prompt.promptText.split("\n\n")[0];
  const type = firstParagraph.match(/\bWrite an? (email|review|report|story|article|letter of complaint|proposal|essay)\b/u)?.[1];
  assert.ok(type, `${prompt.id}: writing text type in first paragraph`);
  assert.match(firstParagraph, /\b(?:to|for) (?:a |your |its |the )/u, `${prompt.id}: reader`);
  textTypes.set(type, (textTypes.get(type) ?? 0) + 1);
}
for (const [type, count] of textTypes) assert.ok(count <= 3, `${type}: used ${count} times`);

const taskTypes = new Map<string, number>();
for (const prompt of speakingPrompts3) {
  assert.ok(Number.isInteger(prompt.preparationSeconds) && prompt.preparationSeconds >= 15 && prompt.preparationSeconds <= 60,
    `${prompt.id}: preparation time`);
  assert.equal(prompt.speakingSeconds, durations[prompt.cefr!], `${prompt.id}: speaking time`);
  const opening = prompt.promptText.split("\n\n")[0];
  assert.equal(opening.match(/[.!?](?:\s|$)/gu)?.length, 1, `${prompt.id}: one task sentence`);
  const type = opening.match(/^(Describe|Compare|Tell a story|Tell a friend how|Argue|Solve a problem)\b/u)?.[1];
  assert.ok(type, `${prompt.id}: speaking task type`);
  taskTypes.set(type, (taskTypes.get(type) ?? 0) + 1);
}
for (const [type, count] of taskTypes) assert.ok(count <= 3, `${type}: used ${count} times`);

console.log("PASS prompts-3: 18 exact ids, CEFR spreads, matching difficulties, unique titles, ranges, timings, plain text and varied task types (offline)");
