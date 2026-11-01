import { expect, test, type Page } from "@playwright/test";

/**
 * The footer's service links open their own card in the services section, and the floating arrows move a whole
 * section (lined up beneath the header) at a time, smoothly and exactly.
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

/** Where the page sits when each section of the home page (and the footer) is right under the header, as the arrows work it out. */
const stopsOf = (page: Page) =>
  page.evaluate(() => {
    const offset = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
    const blocks = [...(document.querySelector("main")?.children ?? []), document.querySelector("footer")!];
    const max = Math.floor(document.documentElement.scrollHeight - window.innerHeight);
    return blocks.map((b) => Math.min(Math.max(0, Math.round(b.getBoundingClientRect().top + window.scrollY - offset)), max));
  });
const yOf = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const next = (page: Page) => page.getByRole("button", { name: "Next section" });
const prev = (page: Page) => page.getByRole("button", { name: "Previous section" });

for (const size of [
  { name: "a phone", width: 390, height: 844 },
  { name: "a desktop", width: 1280, height: 800 },
]) {
  test(`on ${size.name} the arrows move to the top of the next and previous section, even pressed in a run`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.goto("/en");
    // Part way down the services section
    const stops = await stopsOf(page);
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), stops[4] + 300);
    await expect(next(page)).toBeVisible();

    await next(page).click();
    await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[5]);
    await prev(page).click();
    await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[4]);
    // From the top of a section, up goes to the one before it
    await prev(page).click();
    await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[3]);

    // Two quick presses move on two sections from where the first was heading, not from where it had got to
    await next(page).click();
    await next(page).click();
    await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[5]);
    await prev(page).click();
    await prev(page).click();
    await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[3]);
  });
}

test("at the end of the page the down arrow is off, and up goes back to the top of the last section", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await expect(prev(page)).toBeEnabled();
  await expect(next(page)).toBeDisabled();
  const stops = await stopsOf(page);
  const end = await yOf(page);
  // The footer is the last stop (the end of the page when it is shorter than a screen); up goes to the stop before the end
  const before = [...stops].reverse().find((top) => top < end - 2)!;
  await prev(page).click();
  await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(before);
  // Pressing down from just above the end stops at the end rather than overshooting (a pixel of slack: the page's height is fractional)
  await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), end - 100);
  await next(page).click();
  await expect.poll(async () => Math.abs((await yOf(page)) - end), { timeout: 5000 }).toBeLessThanOrEqual(1);
});

test("for visitors who ask for less motion the section changes at once", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 }, storageState: (await import("./helpers")).CONSENTED_STATE });
  const page = await context.newPage();
  await page.goto("/en");
  const stops = await stopsOf(page);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), stops[4] + 300);
  await next(page).click();
  expect(await yOf(page)).toBe(stops[5]);
  await context.close();
});

test("pressed with a finger or the keyboard, a quick run of presses still lands on whole sections", async ({ browser }) => {
  const { CONSENTED_STATE } = await import("./helpers");
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 }, storageState: CONSENTED_STATE });
  const page = await context.newPage();
  await page.goto("/en");
  const stops = await stopsOf(page);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), stops[4]);
  await expect(next(page)).toBeVisible();

  // A finger's touch arrives just before its click: it must not make the second press start from wherever the first had got to
  await next(page).tap();
  await next(page).tap();
  await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[6]);

  // The same from the keyboard (Enter fires a key press, then the click)
  await prev(page).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect.poll(() => yOf(page), { timeout: 5000 }).toBe(stops[4]);

  // But the visitor's own hand on the page takes over: a touch elsewhere stops a scroll in progress
  await next(page).tap();
  await page.touchscreen.tap(100, 400);
  const stopped = await yOf(page);
  await page.waitForTimeout(800);
  expect(await yOf(page)).toBe(stopped);
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
