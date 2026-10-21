import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { CONSENTED_STATE } from "./helpers";

// Who We Serve: a picture and a title per audience, which unfolds into its description when pressed (the same cards as the services,
// see services.spec.ts, here with text only).
const w = en.whoWeServe;
const AUDIENCES = [
  [w.segmentExecutives, w.segmentExecutivesText, "executives"],
  [w.segmentCorporate, w.segmentCorporateText, "corporate"],
  [w.segmentPrivate, w.segmentPrivateText, "private"],
  [w.segmentHotels, w.segmentHotelsText, "hotels"],
  [w.segmentInternational, w.segmentInternationalText, "international"],
  [w.segmentEvents, w.segmentEventsText, "events"],
] as const;

const section = (page: Page) => page.locator("#corporate");
const trigger = (page: Page, title: string) => section(page).getByRole("button", { name: title, exact: true });
const details = (page: Page, title: string) => section(page).getByRole("region", { name: title, exact: true });

async function toSection(page: Page, path = "/en") {
  await page.goto(path);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.getElementById("corporate")!.scrollIntoView();
  });
}

test("every audience shows its own picture and title, with the description folded away", async ({ page, request }) => {
  await toSection(page);
  await expect(section(page).locator("article")).toHaveCount(6);
  for (const [title] of AUDIENCES) {
    await expect(trigger(page, title)).toHaveAttribute("aria-expanded", "false");
    await expect(details(page, title)).toHaveAttribute("inert", "");
    expect(await details(page, title).evaluate((el) => (el as HTMLElement).inert === true && el.getBoundingClientRect().height === 0), title).toBe(true);
  }
  // Six real pictures made for this section, each loaded and each different (the old ones appeared only under a mouse pointer)
  const sources = await section(page).locator("article img").evaluateAll((imgs) => imgs.map((img) => decodeURIComponent((img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src)));
  expect(new Set(sources.map((src) => /serve-[a-z]+-v2\.jpg/.exec(src)?.[0])).size).toBe(6);
  for (const [, , name] of AUDIENCES) expect((await request.get(`/assets/serve-${name}-v2.jpg`)).status()).toBe(200);
  await page.waitForFunction(() => [...document.querySelectorAll("#corporate article img")].every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0));
});

test("pressing an audience unfolds its description with an animation, and pressing again, another audience or Escape folds it", async ({ page }) => {
  await toSection(page);
  const [title, text] = AUDIENCES[0];
  const executives = trigger(page, title);
  const region = details(page, title);
  const height = () => region.evaluate((el) => el.getBoundingClientRect().height);
  expect(await height()).toBe(0);

  await executives.click();
  await expect(executives).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(() => region.evaluate((el) => el.getAnimations().some((a) => a instanceof CSSTransition && a.transitionProperty === "grid-template-rows")), { timeout: 3000 })
    .toBe(true);
  await expect.poll(height, { timeout: 5000 }).toBeGreaterThan(40);
  await expect(region).toContainText(text);
  // Text only: no points and no button inside
  await expect(region.getByRole("link")).toHaveCount(0);
  await expect(region.locator("li")).toHaveCount(0);

  const hotels = trigger(page, AUDIENCES[3][0]);
  await hotels.click();
  await expect(hotels).toHaveAttribute("aria-expanded", "true");
  await expect(executives).toHaveAttribute("aria-expanded", "false");
  await expect.poll(height, { timeout: 5000 }).toBe(0);

  await page.keyboard.press("Escape");
  await expect(hotels).toHaveAttribute("aria-expanded", "false");
  await expect(hotels).toBeFocused();

  await executives.focus();
  await page.keyboard.press("Enter");
  await expect(executives).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(executives).toHaveAttribute("aria-expanded", "false");
});

test("the audiences read in Dutch for a Dutch visitor", async ({ page }) => {
  await page.goto("/nl");
  const n = nl.whoWeServe;
  const region = page.locator("#corporate");
  await region.getByRole("button", { name: n.segmentEvents, exact: true }).click();
  await expect(region.getByRole("region", { name: n.segmentEvents, exact: true })).toContainText(n.segmentEventsText);
  await expect(region.getByRole("button", { name: n.segmentInternational, exact: true })).toBeVisible();
});

test("on a wide screen the heading stays beside the cards while they are read", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await toSection(page);
  const heading = section(page).locator("h2");
  const cards = section(page).locator("article");
  const last = cards.last();
  await last.scrollIntoViewIfNeeded();
  // The last row of cards is on screen, and so is the heading, which started far above it
  const [h, c] = await Promise.all([heading.boundingBox(), last.boundingBox()]);
  expect(c!.y).toBeLessThan(900);
  expect(h!.y).toBeGreaterThan(0);
  expect(h!.y + h!.height).toBeLessThan(900);
});

test("with reduced motion requested the description opens at once, without the animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await context.addCookies(CONSENTED_STATE.cookies);
  await toSection(page);
  await trigger(page, AUDIENCES[4][0]).click();
  const height = await details(page, AUDIENCES[4][0]).evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(40);
  await context.close();
});

test("on the narrowest phone, in Dutch, every audience fits and unfolds within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await toSection(page, "/nl");
  const n = nl.whoWeServe;
  await trigger(page, n.segmentEvents).click();
  const panel = details(page, n.segmentEvents);
  await expect(panel).toContainText(n.segmentEventsText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const box = (await panel.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  // One card per row: the titles never wrap into the + button
  const cards = await section(page).locator("article").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  for (const width of cards) expect(width).toBeGreaterThan(250);
});
