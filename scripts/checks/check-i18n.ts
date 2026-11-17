/**
 * Offline i18n check: npx tsx scripts/checks/check-i18n.ts
 * - visiblePath strips only a leading /vi or /en segment;
 * - every table in src/i18n/messages has the same keys and value kinds in both
 *   languages, no empty strings, and Vietnamese text that differs from English
 *   for most entries (a table left in English is a mistake).
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { visiblePath } from "../../src/i18n/config";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures += 1;
  if (!ok) console.log(`FAIL ${label}${detail ? ` (${detail})` : ""}`);
}

for (const [input, expected] of [
  ["/vi/reading", "/reading"], ["/en/reading/x", "/reading/x"], ["/vi", "/"], ["/en", "/"],
  ["/reading", "/reading"], ["/", "/"], ["/video", "/video"], ["/enrol", "/enrol"],
] as const) {
  check(`visiblePath(${input})`, visiblePath(input) === expected, visiblePath(input));
}

type Node = unknown;
function compare(en: Node, vi: Node, at: string, stats: { strings: number; same: number }) {
  if (typeof en === "string") {
    check(`${at}: string in vi`, typeof vi === "string");
    check(`${at}: not empty`, en.trim() !== "" && typeof vi === "string" && vi.trim() !== "");
    stats.strings += 1;
    if (en === vi) stats.same += 1;
    return;
  }
  if (typeof en === "function") {
    check(`${at}: function in vi`, typeof vi === "function");
    if (typeof vi === "function") check(`${at}: same arity`, en.length === vi.length);
    return;
  }
  if (Array.isArray(en)) {
    check(`${at}: array in vi`, Array.isArray(vi) && vi.length === en.length);
    if (Array.isArray(vi)) en.forEach((item, i) => compare(item, vi[i], `${at}[${i}]`, stats));
    return;
  }
  if (en && typeof en === "object") {
    const enKeys = Object.keys(en).sort();
    const viKeys = vi && typeof vi === "object" ? Object.keys(vi).sort() : [];
    check(`${at}: same keys`, enKeys.join() === viKeys.join(), `${enKeys.filter((k) => !viKeys.includes(k)).concat(viKeys.filter((k) => !enKeys.includes(k))).join(", ")}`);
    for (const key of enKeys) compare((en as Record<string, Node>)[key], (vi as Record<string, Node>)?.[key], `${at}.${key}`, stats);
    return;
  }
  check(`${at}: same value kind`, typeof en === typeof vi);
}

async function main() {
const dir = path.join(process.cwd(), "src", "i18n", "messages");
let tables = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
  const mod = (await import(pathToFileURL(path.join(dir, file)).href)) as Record<string, unknown>;
  for (const [name, value] of Object.entries(mod)) {
    const table = value as { en?: Node; vi?: Node };
    if (!table || typeof table !== "object" || !("en" in table) || !("vi" in table)) continue;
    tables += 1;
    const stats = { strings: 0, same: 0 };
    compare(table.en, table.vi, `${file}:${name}`, stats);
    // Names, codes and short labels may be identical; most entries must not be.
    check(`${file}:${name}: translated`, stats.strings === 0 || stats.same / stats.strings < 0.35, `${stats.same} of ${stats.strings} identical`);
  }
}
check("at least one message table", tables > 0);

console.log(failures === 0 ? `PASS i18n: visible paths, ${tables} message tables match in both languages` : `FAIL ${failures}`);
if (failures > 0) process.exitCode = 1;
}

void main();
