import { expect, test, type Page } from "@playwright/test";

import { listeningLessons, readingLessons } from "../scripts/content/lesson-bank-data";
import { answerListening, answerReading, expectScore, registerLearner, serverHtml } from "./helpers";

const reading = readingLessons.find((lesson) => lesson.id === "seed-reading-43")!;
const listening = listeningLessons.find((lesson) => lesson.id === "seed-listening-43")!;

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  await registerLearner(page);
});

test.afterAll(async () => {
  await page.close();
});

test("Reading: two mistakes are scored, then retried without the other questions", async () => {
  await page.goto(`/reading/${reading.id}`);
  await answerReading(page, reading.id, reading.questions, [0, 2]);
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page).toHaveURL(/\/result\//);
  await expectScore(page, reading.questions.length - 2, reading.questions.length);

  await page.getByRole("link", { name: "Làm lại các câu sai" }).click();
  await expect(page).toHaveURL(/\/retry$/);
  await page.getByRole("button", { name: "Kiểm tra" }).waitFor();
  const names = await page.locator('input[name^="q_"]:visible').evaluateAll((inputs) => [...new Set(inputs.map((input) => (input as HTMLInputElement).name))]);
  expect(names.sort()).toEqual([`q_${reading.id}-q1`, `q_${reading.id}-q3`]);
  // Nothing about the answers is on the page before checking.
  expect(await serverHtml(page)).not.toContain(reading.questions[0].explanation);

  await answerReading(page, reading.id, reading.questions, [], [0, 2]);
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  await expect(page.getByText(reading.questions[0].explanation).locator("visible=true")).toBeVisible();
  await expect(page.getByRole("link", { name: "Quay lại kết quả" }).last()).toBeVisible();
});

test("Listening: matching answers are not in the page, and a correct sheet scores full marks", async () => {
  await page.goto(`/listening/${listening.id}`);
  const matching = listening.questions.find((question) => question.type === "MATCHING")!;
  const html = await serverHtml(page);
  expect(html).toContain(matching.pairs![0].left);
  expect(html).not.toContain("matchingPairs");
  expect(html).not.toMatch(/"left":/);
  expect(html).not.toContain(listening.transcript.slice(0, 60));
  await expect(page.locator("audio")).toHaveAttribute("src", `/audio/listening/${listening.id}.mp3`);

  await answerListening(page, listening.id, listening.questions);
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page).toHaveURL(/\/result\//);
  await expectScore(page, listening.questions.length, listening.questions.length);
  await expect(page.getByRole("link", { name: "Làm lại các câu sai" })).toHaveCount(0);
});

test("Writing: a response is submitted and gets the basic check", async () => {
  await page.goto("/writing/seed-writing-1");
  const text = Array.from({ length: 14 }, () => "I am sorry that I missed the meeting.").join(" ");
  await page.locator("textarea:visible").fill(text);
  await page.getByRole("button", { name: "Nộp bài" }).click();
  await expect(page).toHaveURL(/\/result\//);
  await expect(page.getByRole("heading", { name: "Kiểm tra cơ bản" })).toBeVisible();
});

test("Progress lists the work just done", async () => {
  await page.goto("/progress");
  await expect(page.locator("main")).toContainText(reading.title);
  await expect(page.locator("main")).toContainText(listening.title);
});
