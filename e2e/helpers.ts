import { expect, type Page } from "@playwright/test";

import type { ListeningItem, ReadingItem } from "../scripts/content/lesson-bank-data";

/** Registers a new learner through the form and leaves the page signed in. */
export async function registerLearner(page: Page): Promise<{ email: string; password: string; name: string }> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const learner = { email: `e2e-${stamp}@example.test`, password: `Pw-${stamp}`, name: "E2E Learner" };
  await page.goto("/register");
  await page.locator('input[name="name"]').fill(learner.name);
  await page.locator('input[name="email"]').fill(learner.email);
  await page.locator('input[name="password"]').fill(learner.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  return learner;
}

/** Checks the radio of a question whose value is exactly `value`. */
async function choose(page: Page, name: string, value: string) {
  // Only visible inputs: content streams into a hidden container first, and the
  // router keeps the previous page in the DOM, hidden, with the same field names.
  const radios = page.locator(`input[type="radio"][name="${name}"]:visible`);
  await radios.first().waitFor();
  const count = await radios.count();
  for (let i = 0; i < count; i++) {
    if ((await radios.nth(i).getAttribute("value")) === value) {
      await radios.nth(i).check();
      return;
    }
  }
  throw new Error(`No option "${value}" for ${name}`);
}

/** Answers Reading questions from the lesson bank; indexes in `wrong` get a wrong answer. */
export async function answerReading(page: Page, lessonId: string, items: ReadingItem[], wrong: number[] = [], only?: number[]) {
  for (const [index, item] of items.entries()) {
    if (only && !only.includes(index)) continue;
    const name = `q_${lessonId}-q${index + 1}`;
    const miss = wrong.includes(index);
    if (item.type === "FILL_BLANK") {
      await page.locator(`input[name="${name}"]:visible`).fill(miss ? "zzz" : item.answer);
    } else if (item.type === "TRUE_FALSE") {
      const truth = item.answer.toLowerCase() === "true";
      await choose(page, name, String(miss ? !truth : truth));
    } else {
      await choose(page, name, miss ? item.options!.find((option) => option !== item.answer)! : item.answer);
    }
  }
}

/** Answers every Listening question correctly from the lesson bank. */
export async function answerListening(page: Page, lessonId: string, items: ListeningItem[]) {
  for (const [index, item] of items.entries()) {
    const id = `${lessonId}-q${index + 1}`;
    if (item.type === "MATCHING") {
      for (const [pairIndex, pair] of item.pairs!.entries()) {
        await page.locator(`select[name="m_${id}_${pairIndex}"]:visible`).selectOption(pair.right);
      }
    } else if (item.type === "FILL_BLANK") {
      await page.locator(`input[name="q_${id}"]:visible`).fill(item.answer!);
    } else if (item.type === "TRUE_FALSE") {
      await choose(page, `q_${id}`, item.answer!.toLowerCase());
    } else {
      await choose(page, `q_${id}`, item.answer!);
    }
  }
}

/** The score shown on a result page, as "right/total". */
export async function expectScore(page: Page, right: number, total: number) {
  await expect(page.locator("main")).toContainText(new RegExp(`${right}\\s*/\\s*${total}`));
}

/** The HTML the server sends for the current URL, fetched afresh with the page's session. */
export async function serverHtml(page: Page): Promise<string> {
  return (await page.request.get(page.url())).text();
}
