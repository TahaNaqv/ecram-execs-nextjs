import { expect, test } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";

// Regression tests for the client's bug reports (Web issue / Mobile Responsive tabs). None needs the database.

test("the header stays fixed while scrolling", async ({ page }) => {
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo(0, 3000));
  const top = await page.evaluate(() => Math.round(document.querySelector("header")!.getBoundingClientRect().top));
  expect(top).toBe(0);
});

test("refreshing returns to the top of the page", async ({ page }) => {
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => Math.round(scrollY))).toBe(0);
});

test("switching language does not jump back to the last anchor", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: en.hero.watchArrival }).click(); // leaves #experience in the URL
  await page.evaluate(() => window.scrollTo(0, 5000));
  await page.getByRole("link", { name: en.switcher.ariaNl }).first().click();
  await page.waitForURL("**/nl");
  await page.waitForTimeout(900);
  expect(page.url()).not.toContain("#");
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(3500); // still far down the page, not at "The Experience"
});

test("the phone field offers many country codes, Netherlands first and selected", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#q-phoneCountry")).toHaveValue("31");
  expect(await page.locator("#q-phoneCountry option").count()).toBeGreaterThan(30);
  await page.selectOption("#q-phoneCountry", "44");
  await expect(page.locator("#q-phoneCountry")).toHaveValue("44");
});

test("the concierge answers a question in the chat and leaves the quote form alone", async ({ page }) => {
  await page.goto("/en");
  const box = page.locator("input[name=message]");
  await box.fill("How far in advance should I book?");
  await box.press("Enter");
  await expect(page.getByRole("log")).toContainText(en.conciergeSection.faq1A, { timeout: 5000 });
  await box.fill("qwerty zzzz");
  await box.press("Enter");
  await expect(page.getByRole("log")).toContainText(en.conciergeSection.noAnswer, { timeout: 5000 });
  await expect(page.locator("#q-notes")).toHaveValue("");
});

test("every vehicle shows its own questions, not the same one repeated", async ({ page }) => {
  await page.goto("/en");
  const counts = await page.evaluate(() => [...document.querySelectorAll("#fleet > div > ul > li")].map((li) => li.querySelectorAll("details").length));
  expect(counts).toHaveLength(5);
  for (const n of counts) expect(n).toBeGreaterThan(1);
});
