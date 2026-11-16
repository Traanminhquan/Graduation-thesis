/** Offline validation: inspect seed source text without executing seed modules. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

import { speakingPrompts4, writingPrompts4 } from "./lesson-bank-prompts-4";

const normalise = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const existingTitles = new Set<string>();
const sources = [
  ...readdirSync(new URL("./", import.meta.url))
    .filter((name) => /^lesson-bank-.*\.ts$/u.test(name) && name !== "lesson-bank-prompts-4.ts"),
  "seed-writing.ts", "seed-speaking.ts", "seed-listening.ts",
  "../prisma/seed.ts", "../src/lib/conversation/scenarios.ts",
];
for (const name of sources) {
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
assert.ok(existingTitles.size >= 100, "discover existing titles across all content batches");

const levels = ["A1", "A2", "B1", "B2", "C1"] as const;
const difficulties = { A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED" } as const;
const ranges = { A1: [40, 80], A2: [60, 120], B1: [120, 180], B2: [180, 260], C1: [220, 300] } as const;
const seconds = { A1: 45, A2: 60, B1: 90, B2: 120, C1: 120 } as const;
const titles = new Set<string>();
const forbidden = /fictional|imaginary|invented|made-up|adult/iu;
const markup = /[<>*#`]|\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u20E3]|\[[^\]]+\]\([^)]*\)|(?:^|\n)\s*(?:[-+] |\d+[.)] )/u;

for (const [skill, prompts] of [["writing", writingPrompts4], ["speaking", speakingPrompts4]] as const) {
  assert.deepEqual(prompts.map(({ id }) => id).sort(),
    Array.from({ length: 9 }, (_, index) => `seed-${skill}-${index + 34}`).sort());
  for (const level of levels) {
    assert.equal(prompts.filter(({ cefr }) => cefr === level).length, level === "C1" ? 1 : 2, `${skill}: ${level} spread`);
  }
  for (const prompt of prompts) {
    const cefr = prompt.cefr;
    assert.ok(cefr && levels.includes(cefr), `${prompt.id}: CEFR required`);
    assert.equal(prompt.difficulty, difficulties[cefr], `${prompt.id}: difficulty`);
    const title = normalise(prompt.title);
    assert.ok(title && !existingTitles.has(title) && !titles.has(title), `${prompt.id}: unique title`);
    titles.add(title);
    for (const [key, value] of Object.entries(prompt)) {
      if (typeof value === "string") {
        assert.ok(value.trim(), `${prompt.id}: nonempty ${key}`);
        assert.doesNotMatch(value, forbidden, `${prompt.id}: forbidden word in ${key}`);
        assert.doesNotMatch(value, markup, `${prompt.id}: markup in ${key}`);
      }
    }
    const count = prompt.promptText.trim().split(/\s+/u).length;
    assert.ok(count >= (skill === "writing" && cefr === "A1" ? 30 : 40) && count <= 160, `${prompt.id}: ${count} words`);
    const paragraphs = prompt.promptText.split("\n\n");
    assert.ok(paragraphs.length >= 2 && paragraphs.every((paragraph) => paragraph.trim()), `${prompt.id}: paragraphs`);
    assert.match(prompt.promptText, /\byou(?:r)?\b/iu, `${prompt.id}: direct address`);
    assert.match(paragraphs.at(-1)!, /^Use [^.?!]+[.]$/u, `${prompt.id}: one-sentence language hint`);
  }
}

const textTypes = new Map<string, number>();
for (const prompt of writingPrompts4) {
  assert.ok(prompt.cefr);
  assert.deepEqual([prompt.minWords, prompt.maxWords], ranges[prompt.cefr], `${prompt.id}: word range`);
  const opening = prompt.promptText.split("\n\n")[0];
  const type = opening.match(/Write (?:an? )?(email|review|report|story|article|letter of complaint|proposal|essay)\b/iu)?.[1].toLowerCase();
  assert.ok(type, `${prompt.id}: explicit Writing type in first paragraph`);
  assert.match(opening, /\b(?:to|for) (?:your|other|the|its)\b/iu, `${prompt.id}: reader in first paragraph`);
  textTypes.set(type, (textTypes.get(type) ?? 0) + 1);
}
for (const [type, count] of textTypes) assert.ok(count <= 3, `${type}: no more than three Writing tasks`);

const taskTypes = new Map<string, number>();
for (const prompt of speakingPrompts4) {
  assert.ok(prompt.cefr);
  assert.ok(Number.isInteger(prompt.preparationSeconds) && prompt.preparationSeconds >= 15 && prompt.preparationSeconds <= 60, `${prompt.id}: preparation`);
  assert.equal(prompt.speakingSeconds, seconds[prompt.cefr], `${prompt.id}: speaking duration`);
  const opening = prompt.promptText.split("\n\n")[0];
  assert.match(opening, /^[^.?!]+[.]$/u, `${prompt.id}: one-sentence task`);
  const type = opening.match(/^(Describe|Tell a friend how|Tell a story|Compare|Solve|Argue|Resolve)\b/u)?.[1];
  assert.ok(type, `${prompt.id}: recognised Speaking task`);
  const category = type === "Resolve" ? "Solve" : type;
  taskTypes.set(category, (taskTypes.get(category) ?? 0) + 1);
}
assert.equal(taskTypes.size, 6, "include all six Speaking task types");
for (const [type, count] of taskTypes) assert.ok(count <= 3, `${type}: no more than three Speaking tasks`);

console.log("PASS batch 4 prompts: 18 exact ids, CEFR spread, matching difficulties, unique titles, ranges, timings, plain text and varied task types (offline)");
