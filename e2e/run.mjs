/**
 * Browser tests: prepares a disposable database, builds the app and runs Playwright.
 *
 *   E2E_DATABASE_URL=postgresql://user:pass@localhost:5432/db npm run test:e2e
 *   npm run test:e2e -- --no-build          reuse the last production build
 *   npm run test:e2e -- e2e/lessons.spec.ts  pass arguments on to Playwright
 *
 * The database must be LOCAL (localhost or 127.0.0.1): the tests register users
 * and submit work, so this refuses any other host and never reads DATABASE_URL
 * from `.env`. Migrations and the create-only seeds are applied first; AI,
 * speech and conversation providers are switched off.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const url = process.env.E2E_DATABASE_URL;
if (!url) {
  console.error("Set E2E_DATABASE_URL to a local, disposable Postgres database.");
  process.exit(1);
}
let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("E2E_DATABASE_URL is not a valid URL.");
  process.exit(1);
}
if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
  console.error(`Refusing to run browser tests against "${host}": only a local database is allowed.`);
  process.exit(1);
}

const env = {
  ...process.env,
  DATABASE_URL: url,
  DIRECT_URL: url,
  AUTH_SECRET: process.env.E2E_AUTH_SECRET ?? randomBytes(32).toString("hex"),
  // Explicit empty values win over `.env`, so no provider can be reached.
  AI_ASSESSMENT_ENABLED: "false",
  SPEAKING_AI_ASSESSMENT_ENABLED: "false",
  SPEAKING_STT_ENABLED: "false",
  SPEAKING_AUDIO_STORAGE_ENABLED: "false",
  CONVERSATION_ENABLED: "false",
  AI_API_KEY: "",
  GROQ_API_KEY: "",
  AI_BASE_URL: "",
  AI_MODEL: "",
  AI_FREE_TEST_MODE: "",
  AI_DIAGNOSTICS_LOG: "",
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, { env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    console.error(`${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

const args = process.argv.slice(2);
const build = !args.includes("--no-build");
const playwrightArgs = args.filter((arg) => arg !== "--no-build");

run("migrations", "npx", ["prisma", "migrate", "deploy"]);
run("seed: reading", "npx", ["tsx", "prisma/seed.ts"]);
run("seed: listening", "npx", ["tsx", "scripts/seed-listening.ts"]);
run("seed: writing", "npx", ["tsx", "scripts/seed-writing.ts", "--apply"]);
run("seed: speaking", "npx", ["tsx", "scripts/seed-speaking.ts", "--apply"]);
run("seed: lesson bank", "npx", ["tsx", "scripts/seed-lesson-bank.ts", "--apply"]);
run("seed: levels", "npx", ["tsx", "scripts/seed-lesson-bank.ts", "--labels"]);
run("seed: audio", "npx", ["tsx", "scripts/seed-lesson-bank.ts", "--audio"]);
if (build) run("build", "npx", ["next", "build"]);
run("browser tests", "npx", ["playwright", "test", ...playwrightArgs]);
