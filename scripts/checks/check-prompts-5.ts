/** Offline validation: parse existing sources without executing seed modules. */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

import type { Cefr } from "../content/lesson-bank-data";
import { speakingPrompts5, writingPrompts5 } from "../content/lesson-bank-prompts-5";

/** A lesson-bank file (scripts/content), a seed script (scripts) or a repository path, from scripts/checks. */
function sourceUrl(name: string): URL {
  return new URL(name.startsWith("lesson-bank-") ? `../content/${name}` : `../${name}`, import.meta.url);
}

const normalise = (text: string) => text.normalize("NFKC").trim().toLowerCase();
const existingTitles = new Set<string>();
const sources = [
  ...readdirSync(new URL("../content/", import.meta.url)).filter((name) =>
    /^lesson-bank-.*\.ts$/u.test(name) && name !== "lesson-bank-prompts-5.ts"),
  "seed-writing.ts", "seed-speaking.ts", "seed-listening.ts",
  "../prisma/seed.ts", "../src/lib/conversation/scenarios.ts",
];
for (const name of sources) {
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

const difficulties = { A1: "BEGINNER", A2: "BEGINNER", B1: "INTERMEDIATE", B2: "ADVANCED", C1: "ADVANCED" } as const;
const spread = { A1: 2, A2: 2, B1: 2, B2: 1, C1: 1 } as const;
const ranges = { A1: [40, 80], A2: [60, 120], B1: [120, 180], B2: [180, 260], C1: [220, 300] } as const;
const durations = { A1: 45, A2: 60, B1: 90, B2: 120, C1: 120 } as const;
const forbidden = /fictional|imaginary|invented|made-up|adult/iu;
const markup = /[<>*#`]|\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u20E3]/u;
const titles = new Set<string>();
for (const [skill, prompts] of [["writing", writingPrompts5], ["speaking", speakingPrompts5]] as const) {
  assert.deepEqual(prompts.map(({ id }) => id).sort(),
    Array.from({ length: 8 }, (_, index) => `seed-${skill}-${index + 43}`).sort());
  for (const cefr of Object.keys(spread) as Cefr[]) {
    assert.equal(prompts.filter((prompt) => prompt.cefr === cefr).length, spread[cefr], `${skill}: ${cefr} spread`);
  }
  for (const prompt of prompts) {
    assert.ok(prompt.cefr && Object.hasOwn(difficulties, prompt.cefr), `${prompt.id}: CEFR label`);
    assert.equal(prompt.difficulty, difficulties[prompt.cefr], `${prompt.id}: difficulty`);
    const title = normalise(prompt.title);
    assert.ok(title && !titles.has(title) && !existingTitles.has(title), `${prompt.id}: unique title`);
    titles.add(title);
    for (const [field, value] of Object.entries(prompt)) {
      if (typeof value === "string") {
        assert.ok(value.trim(), `${prompt.id}: nonempty ${field}`);
        assert.doesNotMatch(value, forbidden, `${prompt.id}: forbidden word in ${field}`);
        assert.doesNotMatch(value, markup, `${prompt.id}: markup in ${field}`);
      }
    }
    const count = prompt.promptText.trim().split(/\s+/u).length;
    assert.ok(count >= (prompt.cefr === "A1" ? 30 : 40) && count <= 160, `${prompt.id}: ${count} words`);
    const paragraphs = prompt.promptText.split("\n\n");
    assert.ok(paragraphs.length >= 2 && paragraphs.every((text) => text.trim()), `${prompt.id}: paragraphs`);
    assert.match(paragraphs.at(-1)!, /^Use [^.!?]+\.$/u, `${prompt.id}: one-sentence language hint`);
  }
}

const writingTypes = new Map<string, number>();
for (const prompt of writingPrompts5) {
  assert.ok(prompt.cefr);
  assert.deepEqual([prompt.minWords, prompt.maxWords], ranges[prompt.cefr], `${prompt.id}: word range`);
  const opening = prompt.promptText.split("\n\n")[0];
  const type = opening.match(/Write (?:an? )?(email|review|story|report|article|letter of complaint|proposal|essay)\b/u)?.[1];
  assert.ok(type, `${prompt.id}: recognised writing type in opening`);
  assert.match(opening, /\b(?:to|for) (?:your|a|the|other)\b/u, `${prompt.id}: reader in opening`);
  writingTypes.set(type, (writingTypes.get(type) ?? 0) + 1);
  const points = prompt.promptText.split("\n\n")[1].match(/[^.!?]+[.!?]/gu) ?? [];
  assert.ok(points.length >= 2 && points.length <= 4, `${prompt.id}: two to four content points`);
}
assert.ok([...writingTypes.values()].every((count) => count <= 3), "writing type appears at most three times");

const speakingTypes = new Map<string, number>();
for (const prompt of speakingPrompts5) {
  assert.ok(prompt.cefr);
  assert.ok(Number.isInteger(prompt.preparationSeconds) && prompt.preparationSeconds >= 15 && prompt.preparationSeconds <= 60,
    `${prompt.id}: preparation duration`);
  assert.equal(prompt.speakingSeconds, durations[prompt.cefr], `${prompt.id}: speaking duration`);
  const paragraphs = prompt.promptText.split("\n\n");
  assert.equal((paragraphs[0].match(/[.!?]/gu) ?? []).length, 1, `${prompt.id}: one task sentence`);
  const type = paragraphs[0].match(/^(Describe|Tell a friend how|Tell a story|Compare|Solve|Argue)\b/u)?.[1];
  assert.ok(type, `${prompt.id}: recognised speaking task`);
  speakingTypes.set(type, (speakingTypes.get(type) ?? 0) + 1);
  const points = paragraphs[1].match(/[^.!?]+[.!?]/gu) ?? [];
  assert.ok(points.length >= 2 && points.length <= 3, `${prompt.id}: two or three talking points`);
}
assert.ok([...speakingTypes.values()].every((count) => count <= 3), "speaking task appears at most three times");
console.log("PASS batch 5 prompts: sixteen exact ids, CEFR spread, matching difficulties, unique titles, ranges, timings, plain text and task variety (offline)");
