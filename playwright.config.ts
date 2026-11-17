import { defineConfig } from "@playwright/test";

/**
 * Browser tests (see e2e/run.mjs, which prepares the database and the build and
 * sets the environment this config inherits). Uses the installed Google Chrome,
 * so no browser download is needed locally or on GitHub's runners.
 */
const PORT = 3210;

export default defineConfig({
  testDir: "e2e",
  // One signed-in learner is shared by the specs, and the app's limits are per process.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
