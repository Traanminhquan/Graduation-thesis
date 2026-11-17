import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * Browser tests (see e2e/run.mjs, which prepares the database and the build and
 * sets the environment this config inherits).
 *
 * By default only the installed Google Chrome runs, so no browser download is
 * needed locally or on GitHub's runners. `E2E_BROWSERS=all` adds Chrome at a
 * 390 px phone width, Firefox and WebKit (the engine of Safari); those two need
 * `npx playwright install firefox webkit` once.
 */
const PORT = 3210;

const all: Project[] = [
  { name: "chrome", use: { channel: "chrome" } },
  { name: "chrome-390", use: { channel: "chrome", viewport: { width: 390, height: 844 }, isMobile: false } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
];
const wanted = (process.env.E2E_BROWSERS ?? "chrome").split(",").map((name) => name.trim());
const projects = wanted.includes("all") ? all : all.filter((project) => wanted.includes(project.name!));

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
    locale: "vi-VN",
    trace: "retain-on-failure",
  },
  projects,
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
