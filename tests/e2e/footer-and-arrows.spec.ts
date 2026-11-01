import { expect, test, type Page } from "@playwright/test";

/**
 * The footer's service links open their own card in the services section, and the floating arrows turn the page one
 * screen (beneath the header) at a time, smoothly and exactly.
 */
const card = (page: Page, key: string) => page.locator(`#service-${key}`);
const opened = (page: Page, key: string) => expect(card(page, key).getByRole("button").first()).toHaveAttribute("aria-expanded", "true");

test("each footer service link has a place of its own, and opens its card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  const footer = page.locator("footer");
  const services = footer.getByRole("navigation", { name: "SERVICES" });
  const hrefs = await services.getByRole("link").evaluateAll((links) => links.map((l) => l.getAttribute("href")));
  // Airport, business, corporate, private, bespoke and the reservation link: six links, six different places
  expect(hrefs).toEqual(["/en#service-airport", "/en#service-business", "/en#corporate", "/en#service-private", "/en#service-bespoke", "/en#enquire"]);
  expect(new Set(hrefs).size).toBe(hrefs.length);

  for (const [name, key] of [
    ["Airport Transfers", "airport"],
    ["Business Travel", "business"],
    ["Private Occasions", "private"],
    ["Bespoke Journeys", "bespoke"],
  ] as const) {
    await footer.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#service-${key}$`));
    await opened(page, key);
    await expect(card(page, key)).toBeInViewport();
  }

  // The reservation link still goes to the booking bar
  await footer.getByRole("link", { name: "Reserve Your Chauffeur" }).click();
  await expect(page).toHaveURL(/#enquire$/);
  await expect(page.locator("#enquire")).toBeInViewport();
});

test("a link to a service card from another page, or typed into the address bar, opens that card", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/drive-with-us");
  await page.locator("footer").getByRole("link", { name: "Business Travel", exact: true }).click();
  await expect(page).toHaveURL(/\/en#service-business$/);
  await opened(page, "business");
  await expect(card(page, "business")).toBeInViewport();

  await page.goto("/en#service-private");
  await opened(page, "private");
  await expect(card(page, "private")).toBeInViewport();
});

for (const size of [
  { name: "a phone", width: 390, height: 844 },
  { name: "a desktop", width: 1280, height: 800 },
]) {
  test(`on ${size.name} the arrows turn the page by exactly one screen below the header, even pressed in a run`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/en");
    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
    const next = page.getByRole("button", { name: "Scroll down one page" });
    const prev = page.getByRole("button", { name: "Scroll up one page" });
    await expect(next).toBeVisible();

    const y = () => page.evaluate(() => Math.round(window.scrollY));
    const pageHeight = () => page.evaluate(() => window.innerHeight - (document.querySelector("header")?.getBoundingClientRect().height ?? 0));
    const start = await y();
    const step = Math.round(await pageHeight());

    await next.click();
    await expect.poll(y, { timeout: 5000 }).toBe(start + step);
    await prev.click();
    await expect.poll(y, { timeout: 5000 }).toBe(start);

    // Two quick presses add two pages to where the first was heading, not to where it had got to. (Two, not more: on a phone the
    // arrows are hidden while the chat section is on screen, so that they never cover it.)
    await next.click();
    await next.click();
    await expect.poll(y, { timeout: 5000 }).toBe(start + 2 * step);
    await prev.click();
    await prev.click();
    await expect.poll(y, { timeout: 5000 }).toBe(start);
  });
}

test("at the end of the page the down arrow is off, and up turns back one page from the very end", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  const next = page.getByRole("button", { name: "Scroll down one page" });
  const prev = page.getByRole("button", { name: "Scroll up one page" });
  await expect(prev).toBeEnabled();
  await expect(next).toBeDisabled();
  const y = () => page.evaluate(() => Math.round(window.scrollY));
  const end = await y();
  const step = Math.round(await page.evaluate(() => window.innerHeight - (document.querySelector("header")?.getBoundingClientRect().height ?? 0)));
  await prev.click();
  await expect.poll(async () => Math.abs((await y()) - (end - step)), { timeout: 5000 }).toBeLessThanOrEqual(1);
  // Pressing down from near the end stops at the end rather than overshooting (a pixel of slack: the page's height is fractional)
  await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), end - 100);
  await next.click();
  await expect.poll(async () => Math.abs((await y()) - end), { timeout: 5000 }).toBeLessThanOrEqual(1);
});

test("for visitors who ask for less motion the page turns at once", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, storageState: (await import("./helpers")).CONSENTED_STATE });
  const page = await context.newPage();
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
  const y = () => page.evaluate(() => Math.round(window.scrollY));
  const step = Math.round(await page.evaluate(() => window.innerHeight - (document.querySelector("header")?.getBoundingClientRect().height ?? 0)));
  await page.getByRole("button", { name: "Scroll down one page" }).click();
  expect(await y()).toBe(1500 + step);
  await context.close();
});

test("pressed with a finger or the keyboard, a quick run of presses still lands on whole pages", async ({ browser }) => {
  const { CONSENTED_STATE } = await import("./helpers");
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, storageState: CONSENTED_STATE });
  const page = await context.newPage();
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
  const y = () => page.evaluate(() => Math.round(window.scrollY));
  const step = Math.round(await page.evaluate(() => window.innerHeight - (document.querySelector("header")?.getBoundingClientRect().height ?? 0)));
  const next = page.getByRole("button", { name: "Scroll down one page" });
  const prev = page.getByRole("button", { name: "Scroll up one page" });
  await expect(next).toBeVisible();

  // A finger's touch arrives just before its click: it must not make the second press start from wherever the first had got to
  await next.tap();
  await next.tap();
  await expect.poll(y, { timeout: 5000 }).toBe(1500 + 2 * step);

  // The same from the keyboard (Enter fires a key press, then the click)
  await prev.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect.poll(y, { timeout: 5000 }).toBe(1500);

  // But the visitor's own hand on the page takes over: a touch elsewhere stops a page turn in progress
  await next.tap();
  await page.touchscreen.tap(100, 400);
  const stopped = await y();
  await page.waitForTimeout(800);
  expect(await y()).toBe(stopped);
  await context.close();
});

test("a link opened in a new tab does not unfold its card in this one", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  const link = page.locator("footer").getByRole("link", { name: "Airport Transfers", exact: true });
  await link.click({ modifiers: ["Control"] });
  await page.waitForTimeout(300);
  await expect(card(page, "airport").getByRole("button").first()).toHaveAttribute("aria-expanded", "false");
});
