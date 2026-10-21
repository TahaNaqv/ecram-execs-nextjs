import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { CONSENTED_STATE } from "./helpers";

// The Services section: a picture and a title per service, which unfolds into its details when pressed. (It replaces the plain
// text cards of the first QA round, whose same-hash scroll bug, W12, is covered here through the booking button inside.)
const s = en.servicesSection;
const TITLES = [s.airportTitle, s.businessTitle, s.corporateTitle, s.privateTitle, s.hotelsTitle, s.bespokeTitle];

const section = (page: Page) => page.locator("#services");
const trigger = (page: Page, title: string) => section(page).getByRole("button", { name: title, exact: true });
const details = (page: Page, title: string) => section(page).getByRole("region", { name: title, exact: true });

async function toServices(page: Page) {
  await page.goto("/en");
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = "auto";
    document.getElementById("services")!.scrollIntoView();
  });
}

test("every service shows its own picture and title, with the details folded away", async ({ page, request }) => {
  await toServices(page);
  await expect(section(page).locator("article")).toHaveCount(6);
  for (const title of TITLES) {
    await expect(trigger(page, title)).toHaveAttribute("aria-expanded", "false");
    // Folded details take no room and cannot be reached: nothing to read, nothing to tab to
    await expect(details(page, title)).toHaveAttribute("inert", "");
    expect(await details(page, title).evaluate((el) => (el as HTMLElement).inert === true && el.getBoundingClientRect().height === 0), title).toBe(true);
  }
  // Six real pictures, each loaded and each different
  const sources = await section(page).locator("article img").evaluateAll((imgs) => imgs.map((img) => decodeURIComponent((img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src)));
  expect(new Set(sources.map((src) => /service-[a-z]+\.jpg/.exec(src)?.[0])).size).toBe(6);
  for (const name of ["airport", "business", "corporate", "private", "hotels", "bespoke"]) expect((await request.get(`/assets/service-${name}.jpg`)).status()).toBe(200);
  await page.waitForFunction(() => [...document.querySelectorAll("#services article img")].every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0));
});

test("pressing a service unfolds its details with an animation, and pressing again, another service or Escape folds it", async ({ page }) => {
  await toServices(page);
  const airport = trigger(page, s.airportTitle);
  const region = details(page, s.airportTitle);
  const height = () => region.evaluate((el) => el.getBoundingClientRect().height);
  expect(await height()).toBe(0);

  await airport.click();
  await expect(airport).toHaveAttribute("aria-expanded", "true");
  // It is animated: a transition on the row height is running (not timing samples, which a slow machine would miss), and the
  // height then settles at the details' own height
  await expect
    .poll(() => region.evaluate((el) => el.getAnimations().some((a) => a instanceof CSSTransition && a.transitionProperty === "grid-template-rows")), { timeout: 3000 })
    .toBe(true);
  await expect.poll(height, { timeout: 5000 }).toBeGreaterThan(150);

  // The details are there to read, with a way to book
  await expect(region).toContainText(s.airportText);
  for (const point of [s.airportP1, s.airportP2, s.airportP3]) await expect(region).toContainText(point);
  await expect(region.getByRole("link", { name: en.common.requestQuote })).toBeVisible();

  // Pressing another opens that one and folds this one: one at a time
  const business = trigger(page, s.businessTitle);
  await business.click();
  await expect(business).toHaveAttribute("aria-expanded", "true");
  await expect(airport).toHaveAttribute("aria-expanded", "false");
  await expect.poll(height, { timeout: 5000 }).toBe(0);

  // Escape folds it and puts the focus back on its title
  await page.keyboard.press("Escape");
  await expect(business).toHaveAttribute("aria-expanded", "false");
  await expect(business).toBeFocused();

  // Pressing the same one again folds it as well; Enter works from the keyboard
  await airport.focus();
  await page.keyboard.press("Enter");
  await expect(airport).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Enter");
  await expect(airport).toHaveAttribute("aria-expanded", "false");
});

test("the booking button inside a service scrolls to the form every time, and Corporate Accounts leads to the Corporate Partner page", async ({ page }) => {
  await toServices(page);
  await trigger(page, s.privateTitle).click();
  const book = details(page, s.privateTitle).getByRole("link", { name: en.common.requestQuote });
  // W12 of the second QA round: the second press must work as well as the first
  for (const attempt of [1, 2, 3]) {
    await page.evaluate(() => document.getElementById("services")!.scrollIntoView());
    await book.click();
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById("enquire")!.getBoundingClientRect().top)), { message: `press ${attempt}`, timeout: 5000 }).toBeLessThan(200);
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById("enquire")!.getBoundingClientRect().top)), { timeout: 5000 }).toBeGreaterThan(-50);
  }

  await toServices(page);
  await trigger(page, s.corporateTitle).click();
  const corporate = details(page, s.corporateTitle).getByRole("link", { name: en.whoWeServe.cta });
  await expect(corporate).toHaveAttribute("href", "/en/corporate-partner");
  await corporate.click();
  await expect(page).toHaveURL(/\/en\/corporate-partner$/);
});

test("the services read in Dutch for a Dutch visitor", async ({ page }) => {
  await page.goto("/nl");
  const n = nl.servicesSection;
  const region = page.locator("#services");
  await region.getByRole("button", { name: n.hotelsTitle, exact: true }).click();
  const panel = region.getByRole("region", { name: n.hotelsTitle, exact: true });
  for (const text of [n.hotelsText, n.hotelsP1, n.hotelsP2, n.hotelsP3]) await expect(panel).toContainText(text);
  await expect(panel.getByRole("link", { name: nl.common.requestQuote })).toBeVisible();
});

test("with reduced motion requested the details open at once, without the animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  // (every context made by hand needs the cookie banner answered: see CONSENTED_STATE)
  await context.addCookies(CONSENTED_STATE.cookies);
  await toServices(page);
  await trigger(page, s.bespokeTitle).click();
  // No transition: the full height is there straight away
  const height = await details(page, s.bespokeTitle).evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeGreaterThan(150);
  await context.close();
});

test("on the narrowest phone a service unfolds within the screen", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await toServices(page);
  await trigger(page, s.corporateTitle).click();
  await expect(details(page, s.corporateTitle).getByRole("link", { name: en.whoWeServe.cta })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const box = (await details(page, s.corporateTitle).getByRole("link", { name: en.whoWeServe.cta }).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});
