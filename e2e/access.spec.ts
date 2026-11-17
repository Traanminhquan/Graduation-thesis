import { expect, test } from "@playwright/test";

import { registerLearner } from "./helpers";

test("signed-in areas send an anonymous visitor to the login page", async ({ page }) => {
  for (const path of ["/reading", "/progress", "/profile", "/listening/seed-listening-1"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("language-prefixed paths lead to the same place as the plain path", async ({ page, request }) => {
  const response = await request.get("/vi/reading/seed-reading-1", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/\/reading\/seed-reading-1$/);
  await page.goto("/en/login");
  await expect(page).toHaveURL(/\/login$/);
});

test("unknown pages show the not-found page, and robots.txt is served", async ({ page, request }) => {
  const missing = await page.goto("/no-such-page");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Trang này không tồn tại");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /api/");
});

test("the auth routes refuse a request from another origin", async ({ request }) => {
  const foreign = await request.post("/api/auth/login", {
    headers: { origin: "http://evil.example" },
    data: { email: "nobody@example.test", password: "x" },
  });
  expect(foreign.status()).toBe(403);
});

test("register, log out, log in again, switch the language", async ({ page }) => {
  const learner = await registerLearner(page);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.locator('input[name="email"]').fill(learner.email);
  await page.locator('input[name="password"]').fill(learner.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();

  await page.goto("/reading");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đọc");
  await page.getByRole("button", { name: "Switch the interface to English" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reading");
  await expect(page).toHaveURL(/\/reading$/);
  await page.getByRole("button", { name: "Chuyển giao diện sang tiếng Việt" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Đọc");
});
