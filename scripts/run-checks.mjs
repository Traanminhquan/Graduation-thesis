/**
 * Runs every offline check script (scripts/check-*.ts) and reports a summary.
 *
 *   npm test                 run all
 *   npm test -- weakness     run the scripts whose name contains "weakness"
 *
 * The checks use mocks only. Database and provider credentials are blanked for
 * the child processes so a check can never reach a real service by accident.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const filters = process.argv.slice(2);
const scripts = readdirSync(here)
  .filter((name) => /^check-.*\.ts$/.test(name))
  .filter((name) => filters.length === 0 || filters.some((filter) => name.includes(filter)))
  .sort();

if (scripts.length === 0) {
  console.error("No check script matches.");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: "", AI_API_KEY: "", GROQ_API_KEY: "" };
const tsx = path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs");
const failed = [];

for (const script of scripts) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [tsx, path.join(here, script)], { env, encoding: "utf8" });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status === 0) {
    console.log(`ok    ${script} (${seconds}s)`);
  } else {
    failed.push(script);
    console.log(`FAIL  ${script} (${seconds}s)`);
    console.log(`${result.stdout ?? ""}${result.stderr ?? ""}`.trim().split("\n").slice(-25).join("\n"));
  }
}

console.log(`\n${scripts.length - failed.length} of ${scripts.length} check scripts passed.`);
if (failed.length > 0) {
  console.log(`Failed: ${failed.join(", ")}`);
  process.exit(1);
}
