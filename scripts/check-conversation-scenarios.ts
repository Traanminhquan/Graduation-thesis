/** Offline catalogue validation. No providers, environment files, or database. */
import assert from "node:assert/strict";

import { partnerName } from "../src/components/conversation/conversation-script";
import { getScenario, SCENARIOS } from "../src/lib/conversation/scenarios";

const levels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
const stringFields = [
  "id", "title", "difficulty", "topic", "learnerRole", "partnerRole",
  "partnerManner", "opening",
] as const;

function checkText(value: unknown, label: string): asserts value is string {
  assert.equal(typeof value, "string", `${label} must be a string`);
  const text = value as string;
  assert.ok(text.trim().length > 0, `${label} must not be blank`);
  assert.equal(text, text.trim(), `${label} must not have outer whitespace`);
  assert.doesNotMatch(text, /\b(?:fictional|imaginary|invented|made-up|adult)\b/iu,
    `${label} must not contain a forbidden word from the shared rules`);
  assert.doesNotMatch(text, /[<>*_`"\r\n\u0085\u2028\u2029]/u, `${label} must be plain text`);
  for (const character of text) {
    const point = character.codePointAt(0)!;
    assert.ok(point <= 0x2000 || point === 0x2019 || point === 0x2013,
      `${label} contains a forbidden character`);
  }
}

assert.ok(Array.isArray(SCENARIOS));
assert.equal(SCENARIOS.length, 20);
assert.ok(Object.isFrozen(SCENARIOS));
const ids = new Set<string>();

for (const scenario of SCENARIOS) {
  assert.ok(scenario !== null && typeof scenario === "object");
  assert.ok(Object.isFrozen(scenario), "scenario must be frozen");
  for (const field of stringFields) {
    assert.ok(Object.hasOwn(scenario, field), `missing ${field}`);
    checkText(scenario[field], `${scenario.id}.${field}`);
  }
  assert.match(scenario.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  assert.ok(!ids.has(scenario.id), `duplicate id: ${scenario.id}`);
  ids.add(scenario.id);
  assert.ok(levels.includes(scenario.difficulty));
  assert.ok(scenario.partnerRole.length <= 80);
  assert.ok(partnerName(scenario.partnerRole).split(/\s+/u).length <= 3,
    `${scenario.id}: partner margin name must have at most three words`);
  assert.ok(scenario.partnerManner.length <= 80);
  assert.ok(scenario.opening.split(/\s+/u).length <= 30);
  assert.ok(scenario.opening.endsWith("?"));
  const sentences = scenario.opening.match(/[^.!?]+[.!?]/gu) ?? [];
  assert.ok(sentences.length >= 1 && sentences.length <= 2,
    `${scenario.id}: opening must have one or two sentences`);

  for (const field of ["goals", "usefulPhrases"] as const) {
    assert.ok(Object.hasOwn(scenario, field), `missing ${field}`);
    assert.ok(Array.isArray(scenario[field]), `${field} must be an array`);
    assert.ok(Object.isFrozen(scenario[field]), `${field} must be frozen`);
    const values = scenario[field];
    assert.ok(field === "goals" ? values.length === 3 || values.length === 4 : values.length === 2);
    for (const value of values) {
      checkText(value, `${scenario.id}.${field}`);
      assert.ok(value.length <= (field === "goals" ? 70 : 40));
      if (field === "goals") assert.match(value, /^[A-Z]/);
    }
  }
  assert.strictEqual(getScenario(scenario.id), scenario);
}

for (const level of levels) {
  const minimum = level === "ADVANCED" ? 3 : 5;
  assert.ok(SCENARIOS.filter((scenario) => scenario.difficulty === level).length >= minimum,
    `${level} needs at least ${minimum} scenarios`);
}

// Exercise runtime inputs without widening the public string signature.
const lookup = getScenario as (id: unknown) => ReturnType<typeof getScenario>;
for (const id of ["unknown-scenario", "__proto__", "constructor", "", undefined, 42, null, {}, [SCENARIOS[0].id]]) {
  assert.equal(lookup(id), null);
}

console.log("PASS conversation scenarios: twenty entries, at least five BEGINNER and INTERMEDIATE and three ADVANCED, short partner names, forbidden words, writing rules, deep freeze, safe lookup (offline)");
