import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { CONSENT_COOKIE, COOKIE_ROWS, parseConsent } from "../../lib/consent";

// The cookie banner starts from a browser that has not answered it (every other spec starts answered: see CONSENTED_STATE).
test.use({ storageState: { cookies: [], origins: [] } });

const c = en.cookieConsent;

const banner = (page: Page, copy = c) => page.getByRole("region", { name: copy.bannerTitle });
const dialog = (page: Page, copy = c) => page.getByRole("dialog", { name: copy.prefsTitle });
const storedChoice = async (page: Page) => parseConsent((await page.context().cookies()).find((k) => k.name === CONSENT_COOKIE)?.value);

test("a first visit shows the banner in the visitor's language, with accept and reject looking exactly alike", async ({ page }) => {
  await page.goto("/en");
  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText(c.bannerText);
  const reject = banner(page).getByRole("button", { name: c.rejectAll });
  const accept = banner(page).getByRole("button", { name: c.acceptAll });
  await expect(banner(page).getByRole("button", { name: c.preferences })).toBeVisible();
  await expect(banner(page).getByRole("link", { name: c.policyLink })).toHaveAttribute("href", "/en/privacy#cookies");

  // Neither choice is made easier to press than the other: same size, same colours
  const [r, a] = await Promise.all([reject.boundingBox(), accept.boundingBox()]);
  expect(Math.abs(r!.width - a!.width)).toBeLessThan(2);
  expect(r!.height).toBe(a!.height);
  const look = (button: typeof reject) => button.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.borderColor, s.fontSize].join("|"); });
  expect(await look(reject)).toBe(await look(accept));

  // Nothing is stored and nothing optional is set before a choice
  expect(await storedChoice(page)).toBeNull();
  const names = (await page.context().cookies()).map((k) => k.name);
  expect(names.filter((n) => n !== "NEXT_LOCALE")).toEqual([]);

  await page.goto("/nl");
  await expect(banner(page, nl.cookieConsent)).toBeVisible();
  await expect(banner(page, nl.cookieConsent)).toContainText(nl.cookieConsent.bannerText);
  await expect(banner(page, nl.cookieConsent).getByRole("button", { name: nl.cookieConsent.rejectAll })).toBeVisible();
});

test("rejecting stores a refusal, hides the banner and is remembered on the next page and visit", async ({ page }) => {
  await page.goto("/en");
  await banner(page).getByRole("button", { name: c.rejectAll }).click();
  await expect(banner(page)).toBeHidden();
  expect(await storedChoice(page)).toMatchObject({ analytics: false, marketing: false });
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(banner(page)).toHaveCount(0);
  await page.goto("/nl");
  await expect(banner(page, nl.cookieConsent)).toHaveCount(0);
});

test("accepting stores consent for twelve months as a first-party cookie, also set by the server (Safari caps a cookie written by script at a week)", async ({ page }) => {
  await page.goto("/en");
  const persisted = page.waitForResponse((r) => r.request().method() === "POST");
  await banner(page).getByRole("button", { name: c.acceptAll }).click();
  const setCookie = (await (await persisted).allHeaders())["set-cookie"] ?? "";
  expect(setCookie).toContain(`${CONSENT_COOKIE}=`);
  expect(setCookie).toMatch(/Max-Age=31536000/i);
  expect(setCookie).toMatch(/SameSite=lax/i);
  expect(setCookie).not.toMatch(/HttpOnly/i);
  await expect(banner(page)).toBeHidden();
  expect(await storedChoice(page)).toMatchObject({ analytics: true, marketing: true });
  const cookie = (await page.context().cookies()).find((k) => k.name === CONSENT_COOKIE)!;
  const days = (cookie.expires - Date.now() / 1000) / 86_400;
  expect(days).toBeGreaterThan(363);
  expect(days).toBeLessThanOrEqual(366);
  expect(cookie.path).toBe("/");
  expect(cookie.sameSite).toBe("Lax");
});

test("the preferences dialog lists the cookies, defaults everything optional to off and saves a per-category choice", async ({ page }) => {
  await page.goto("/en");
  await banner(page).getByRole("button", { name: c.preferences }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(c.necessaryTitle);
  await expect(dialog(page)).toContainText(c.alwaysOn);
  for (const [name] of COOKIE_ROWS) await expect(dialog(page).getByRole("rowheader", { name })).toBeVisible();

  const analytics = dialog(page).getByRole("switch", { name: c.analyticsTitle });
  const marketing = dialog(page).getByRole("switch", { name: c.marketingTitle });
  await expect(analytics).not.toBeChecked();
  await expect(marketing).not.toBeChecked();
  await analytics.check({ force: true }); // the switch is drawn over the real checkbox
  await dialog(page).getByRole("button", { name: c.save }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(banner(page)).toBeHidden();
  expect(await storedChoice(page)).toMatchObject({ analytics: true, marketing: false });
});

test("the footer's Cookie settings reopens the choice at any time, and closing without saving changes nothing", async ({ page }) => {
  await page.goto("/en");
  await banner(page).getByRole("button", { name: c.acceptAll }).click();
  await expect(banner(page)).toBeHidden();

  await page.getByRole("button", { name: c.settingsLink }).click();
  await expect(dialog(page)).toBeVisible();
  // It shows the choice that is stored
  await expect(dialog(page).getByRole("switch", { name: c.analyticsTitle })).toBeChecked();
  await dialog(page).getByRole("switch", { name: c.analyticsTitle }).uncheck({ force: true });
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  expect(await storedChoice(page)).toMatchObject({ analytics: true, marketing: true });

  // Withdrawing is as easy as giving: reject everything from the same dialog
  await page.getByRole("button", { name: c.settingsLink }).click();
  await dialog(page).getByRole("button", { name: c.rejectAll }).click();
  await expect(dialog(page)).toBeHidden();
  expect(await storedChoice(page)).toMatchObject({ analytics: false, marketing: false });
});

test("a choice stored for an older set of categories, or a damaged one, is asked about again", async ({ page, context }) => {
  await context.addCookies([{ name: CONSENT_COOKIE, value: encodeURIComponent(JSON.stringify({ v: 0, at: "2020-01-01", analytics: true, marketing: true })), domain: "localhost", path: "/" }]);
  await page.goto("/en");
  await expect(banner(page)).toBeVisible();
  await context.addCookies([{ name: CONSENT_COOKIE, value: "%7Bnot-json", domain: "localhost", path: "/" }]);
  await page.reload();
  await expect(banner(page)).toBeVisible();
});

test("the banner comes before the page in the tab order, and answers from the keyboard", async ({ page }) => {
  await page.goto("/en");
  await expect(banner(page)).toBeVisible();
  // First in the document, so a keyboard visitor meets the choice before tabbing through the whole page
  const first = await page.evaluate((name) => {
    const region = document.querySelector(`[role=region][aria-label="${name}"]`)!;
    const main = document.querySelector("main")!;
    return !!(region.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, c.bannerTitle);
  expect(first).toBe(true);

  await banner(page).getByRole("button", { name: c.rejectAll }).focus();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toBeHidden();
  expect(await storedChoice(page)).toMatchObject({ analytics: false });
});

test("the cookie policy section of the privacy page lists the same cookies, and the banner does not appear in the admin panel", async ({ page }) => {
  await page.goto("/en/privacy#cookies");
  const section = page.locator("#cookies");
  await expect(section).toContainText(en.privacy.s3p1);
  for (const [name] of COOKIE_ROWS) await expect(section.getByRole("rowheader", { name })).toBeVisible();

  await page.goto("/admin/login");
  await expect(page.getByRole("region", { name: c.bannerTitle })).toHaveCount(0);
});

test("the dialog opens on its title, and the privacy page has its own Cookie settings button", async ({ page }) => {
  await page.goto("/en/privacy");
  await banner(page).getByRole("button", { name: c.rejectAll }).click();
  await page.locator("#cookies").getByRole("button", { name: c.settingsLink }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("heading", { name: c.prefsTitle })).toBeFocused();
});

test("withdrawing a category that was on reloads the page, so a script already running does not outlive the consent", async ({ page }) => {
  await page.goto("/en");
  await banner(page).getByRole("button", { name: c.acceptAll }).click();
  await expect(banner(page)).toBeHidden();
  await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true));

  // Reject while only declining things that are already declined: no reload
  await page.getByRole("button", { name: c.settingsLink }).click();
  await dialog(page).getByRole("switch", { name: c.analyticsTitle }).uncheck({ force: true });
  await dialog(page).getByRole("switch", { name: c.marketingTitle }).uncheck({ force: true });
  const reloaded = page.waitForEvent("load");
  await dialog(page).getByRole("button", { name: c.save }).click();
  await reloaded;
  expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBeUndefined();
  expect(await storedChoice(page)).toMatchObject({ analytics: false, marketing: false });

  // Turning something on does not reload: nothing needs stopping
  await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true));
  await page.getByRole("button", { name: c.settingsLink }).click();
  await dialog(page).getByRole("button", { name: c.acceptAll }).click();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(async () => (await storedChoice(page))?.analytics).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true);
});

test("the floating buttons are lifted above the banner while it is open, and drop back after the choice", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  await expect(banner(page)).toBeVisible();
  // The section arrows appear once the page is scrolled
  await page.mouse.wheel(0, 1500);
  const arrows = page.locator(".section-nav.is-visible");
  await expect(arrows).toBeVisible();
  const bannerTop = (await banner(page).boundingBox())!.y;
  await expect.poll(async () => { const a = await arrows.boundingBox(); return a!.y + a!.height; }).toBeLessThanOrEqual(bannerTop + 1);
  const lifted = (await arrows.boundingBox())!.y;
  await banner(page).getByRole("button", { name: c.rejectAll }).click();
  await expect.poll(async () => (await arrows.boundingBox())!.y).toBeGreaterThan(lifted + 50);
});

test("on the narrowest phone, in Dutch, the banner fits and its buttons are not cut off", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/nl");
  const bar = banner(page, nl.cookieConsent);
  await expect(bar).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  for (const name of [nl.cookieConsent.rejectAll, nl.cookieConsent.acceptAll, nl.cookieConsent.preferences]) {
    const box = (await bar.getByRole("button", { name }).boundingBox())!;
    expect(box.x, name).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, name).toBeLessThanOrEqual(320);
  }
});
