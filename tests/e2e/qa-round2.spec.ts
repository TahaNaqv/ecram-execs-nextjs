import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { FLEET } from "../../lib/fleet/vehicles";
import { bestMatch } from "../../lib/concierge/match";
import { faqsFrom } from "../../lib/concierge/faqs";
import { cleanPhoneInput, phoneLengthOk } from "../../lib/phone";
import { PASSWORD, newEmail, ownAddress, seedContact, logIn, t } from "./corporate-helpers";

// Regression tests for the second QA bug report (the "Escram exces Bugs" document: email bugs E1-E3, website bugs W1-W14).
// What the emails say is in emails.spec.ts; the rest is here.

/** The date and time in the Netherlands, as the picker should show them when it is opened. */
function amsterdamNow() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

/** Picks a vehicle and waits for the panel beside the form; chosen again until it takes, in case the page was not interactive yet. */
async function chooseVehicle(page: Page, key: string) {
  await expect(async () => {
    await page.locator("#q-vehicle").selectOption(key);
    await expect(page.getByText(en.quoteForm.selectedVehicle)).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
}

test("W1: the vehicle list names every model, and the Mercedes-Benz EQS is on it", async ({ page }) => {
  await page.goto("/en");
  const names = await page.locator("#q-vehicle option").allTextContents();
  expect(names).toContain("Audi e-tron GT");
  expect(names).toContain("Mercedes-Benz EQS");
  expect(names).toContain("Range Rover EV");
  expect(names).not.toContain("Audi");
  expect(names).not.toContain("Range Rover");
  expect(FLEET.map((v) => v.name)).toEqual(expect.arrayContaining(["Audi e-tron GT", "Mercedes-Benz EQS"]));

  // A vehicle without photographs still shows its name beside the form, without a broken gallery
  await chooseVehicle(page, "mercedes_eqs");
  await expect(page.getByRole("heading", { name: "Mercedes-Benz EQS" })).toBeVisible();
  await expect(page.getByRole("group", { name: /Mercedes-Benz EQS/ })).toHaveCount(0);
});

test("W3: beside the form, the vehicle panel is as tall as the form and stays where it is while the page scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  await chooseVehicle(page, "audi");
  const form = page.locator("form").filter({ has: page.locator("#q-vehicle") });
  const panel = form.locator("> div > div").first();
  const fields = form.locator("> div > div").nth(1);
  await expect(panel.getByText(en.quoteForm.selectedVehicle)).toBeVisible();
  const [panelBox, fieldsBox] = await Promise.all([panel.boundingBox(), fields.boundingBox()]);
  expect(Math.abs(panelBox!.height - fieldsBox!.height)).toBeLessThan(3);
  expect(Math.abs(panelBox!.y - fieldsBox!.y)).toBeLessThan(3);
  expect(await panel.evaluate((el) => getComputedStyle(el).position)).not.toBe("sticky");
  // The photograph takes the room the panel has, rather than a fixed little strip
  const photo = panel.locator("[aria-roledescription=carousel]");
  expect((await photo.boundingBox())!.height).toBeGreaterThan(180);
});

test("W3: on a phone the vehicle panel is no wider than the form, so nothing is cut off at the edge", async ({ page }) => {
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/en");
    await chooseVehicle(page, "audi");
    const form = page.locator("form").filter({ has: page.locator("#q-vehicle") });
    const [formBox, panelBox] = await Promise.all([form.boundingBox(), form.locator("> div > div").first().boundingBox()]);
    expect(panelBox!.x + panelBox!.width, `${width}px`).toBeLessThanOrEqual(formBox!.x + formBox!.width + 0.5);
    expect(panelBox!.x + panelBox!.width, `${width}px`).toBeLessThanOrEqual(width);
  }
});

test("W11: only a stop with a place typed in is counted, and empty ones are dropped when the list closes", async ({ page }) => {
  await page.goto("/en");
  const toggle = page.getByRole("button", { name: en.quoteForm.addStop, exact: true });
  await toggle.click();
  // An empty field was added, but it is not a stop yet
  const box = page.getByPlaceholder("Stop 2", { exact: false });
  await expect(box).toBeVisible();
  await expect(page.getByRole("button", { name: /^Stops \(/ })).toHaveCount(0);
  await page.getByRole("button", { name: en.quoteForm.addStopover }).click();
  await expect(page.getByPlaceholder("Stop 3", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Stops \(/ })).toHaveCount(0);

  await box.fill("Utrecht Centraal");
  await expect(page.getByRole("button", { name: /Stops \(1\/5\)/ })).toBeVisible();

  // Closing the list drops the empty one: one stop is submitted, and one remains when it is opened again
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Stop 3", { exact: false })).toHaveCount(0);
  await expect(page.locator("input[name=destinations]")).toHaveCount(1);
  await expect(page.locator("input[name=destinations]")).toHaveValue("Utrecht Centraal");
  await page.getByRole("button", { name: /Stops \(1\/5\)/ }).click();
  await expect(page.locator("input[placeholder^='Stop ']")).toHaveCount(1);
});

test("W10: the time lists open on the time it is now in the Netherlands, in every form that has the picker", async ({ page }) => {
  const d = en.dateTimePicker;
  await page.goto("/en");
  await page.locator("#q-pickupAt").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: d.open }).click();
  const dialog = page.getByRole("dialog", { name: d.dialog });
  const shown = async () => Number(await dialog.getByLabel(d.hour).inputValue()) * 60 + Number(await dialog.getByLabel(d.minute).inputValue());
  const near = (minutes: number) => Math.min(Math.abs(minutes - amsterdamNow()), 1440 - Math.abs(minutes - amsterdamNow()));
  expect(near(await shown())).toBeLessThanOrEqual(2);

  // Picking a day keeps that time, and Clear goes back to the current time
  await dialog.locator("button[data-day]:not(:disabled)").last().click();
  expect(near(await shown())).toBeLessThanOrEqual(2);
  await dialog.getByLabel(d.hour).selectOption("23");
  await dialog.getByRole("button", { name: d.clear }).click();
  expect(near(await shown())).toBeLessThanOrEqual(2);
});

test("W10: reopening the picker after choosing a day never changes the time the form submits", async ({ page }) => {
  const d = en.dateTimePicker;
  const start = Date.now();
  await page.clock.setFixedTime(start); // the page's clock, which the test then moves on by hand
  await page.goto("/en");
  const hidden = page.locator("input[name=pickupAt]");
  const field = page.locator("#q-pickupAt");
  await field.scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: d.open }).click();
  const dialog = page.getByRole("dialog", { name: d.dialog });
  await dialog.locator("button[data-day]:not(:disabled)").last().click();
  await dialog.getByRole("button", { name: d.done }).click();
  const shownTime = (await field.inputValue()).slice(-5);
  await page.clock.setFixedTime(start + 5 * 60_000); // five minutes later
  await page.getByRole("button", { name: d.open }).click();
  await dialog.getByRole("button", { name: d.done }).click();
  await expect(hidden).toHaveValue(new RegExp(`T${shownTime}$`));
  await expect(field).toHaveValue(new RegExp(`${shownTime}$`));
});

test("W13: a phone box takes digits only, stops at the country's limit, and copes with a pasted +31", async ({ page }) => {
  await page.goto("/en");
  const phone = page.locator("#q-phone");
  await phone.scrollIntoViewIfNeeded();
  await phone.fill("06 12-34 56 78 99 00 abc");
  await expect(phone).toHaveValue("0612345678"); // ten digits for the Netherlands, nothing else
  // A number pasted with its country code keeps all of its digits
  await phone.fill("+31 6 12345678");
  await expect(phone).toHaveValue("612345678");
  await phone.fill("0031 6 12345678");
  await expect(phone).toHaveValue("612345678");
  // A country code typed without the plus is taken off too when the number would otherwise be too long
  await phone.fill("31612345678");
  await expect(phone).toHaveValue("612345678");
  // Another country's number pasted whole is left as written (the server says why it is refused), not cut short into a different number
  await phone.fill("+44 7911 123456");
  await expect(phone).toHaveValue("+44 7911 123456");
  // Another country, another limit; changing country trims what no longer fits
  await page.selectOption("#q-phoneCountry", "49");
  await phone.fill("1234567890123456789");
  await expect(phone).toHaveValue("123456789012345");
  await page.selectOption("#q-phoneCountry", "44");
  await expect(phone).toHaveValue("12345678901");

  // The same rules on the server's side
  expect(phoneLengthOk("31", "6 1234 5678")).toBe(true);
  expect(phoneLengthOk("31", "6 1234 56789 0")).toBe(false);
  expect(phoneLengthOk("31", "12345")).toBe(false);
  expect(phoneLengthOk("44", "07911 123456")).toBe(true);
  expect(phoneLengthOk("49", "151 12345678")).toBe(true);
  expect(cleanPhoneInput("+44 7911 123456", "44")).toBe("7911123456");
  expect(cleanPhoneInput("12125550100", "1")).toBe("2125550100");
  expect(cleanPhoneInput("+44 7911 123456", "31")).toBe("+44 7911 123456");
});

test("W12: a Services card still takes the visitor to the booking form the second time", async ({ page }) => {
  await page.goto("/en");
  const card = page.locator("#services a.card").first();
  for (const attempt of [1, 2, 3]) {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = "auto";
      document.getElementById("services")!.scrollIntoView();
    });
    await card.scrollIntoViewIfNeeded();
    await card.click({ position: { x: 100, y: 60 } });
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById("enquire")!.getBoundingClientRect().top)), { message: `click ${attempt}`, timeout: 5000 }).toBeLessThan(200);
    await expect.poll(() => page.evaluate(() => Math.round(document.getElementById("enquire")!.getBoundingClientRect().top)), { timeout: 5000 }).toBeGreaterThan(-50);
  }
});

test("W6, W7: the login button is as wide as the fields, and the links sit close under it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/en/corporate-partner/login");
  const form = page.locator("form").filter({ has: page.locator("#c-password") });
  const fields = form.locator("> div").first();
  const button = page.getByRole("button", { name: t.loginCta, exact: true });
  const forgot = page.getByRole("link", { name: t.forgotLink });
  await expect(button).toBeVisible(); // the form streams in behind a Suspense boundary
  await expect(forgot).toBeVisible();
  const [f, b, l] = await Promise.all([fields.boundingBox(), button.boundingBox(), forgot.boundingBox()]);
  expect(Math.abs(f!.width - b!.width)).toBeLessThan(2);
  expect(Math.abs(f!.x - b!.x)).toBeLessThan(2);
  expect(l!.y - (b!.y + b!.height)).toBeLessThan(32);
  // W9: the whole form is on screen without scrolling, on a laptop-sized window
  const signup = page.getByRole("link", { name: t.signupLink });
  const s = await signup.boundingBox();
  expect(s!.y + s!.height).toBeLessThan(800);
});

test("W8: the show/hide button on a password stays and works every time", async ({ page }) => {
  await page.goto("/en/corporate-partner/login");
  const input = page.locator("#c-password");
  await input.fill("a long enough password");
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: t.showPassword }).click();
    await expect(input).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: t.hidePassword }).click();
    await expect(input).toHaveAttribute("type", "password");
  }
});

test("W5: someone who is signed in still gets the sign-up form, with a note about what it does", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("signedin");
  await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);

  await page.goto("/en/corporate-partner/login");
  await page.getByRole("link", { name: t.signupLink }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/signup$/);
  await expect(page.getByText(t.signedInSignupNote)).toBeVisible();
  // (the login page we came from stays in the DOM, hidden, so only the visible one counts)
  await expect(page.locator("#c-email:visible")).toBeVisible();
  await expect(page.getByRole("button", { name: t.sendCode })).toBeVisible();
});

test("W4: the concierge answers what it can in the visitor's language, and says what it can help with when it cannot", async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  const ask = async (message: string, locale: "en" | "nl" = "en") => (await (await api.post("/api/concierge", { data: { message, locale } })).json()) as { reply: string; handoff: boolean };
  const c = en.conciergeSection;

  const faqs = faqsFrom(c);
  expect(bestMatch("How can I book a car?", faqs)?.answer).toBe(c.faq14A);
  expect(bestMatch("what are your prices", faqs)?.answer).toBe(c.faq15A);
  expect(bestMatch("how do I reach you by phone", faqs)?.answer).toBe(c.faq16A);
  expect(bestMatch("are the cars electric?", faqs)?.answer).toBe(c.faq10A);

  expect(await ask("How much does it cost?")).toEqual({ reply: c.faq15A, handoff: false });
  expect(await ask("Hello!")).toEqual({ reply: c.welcome, handoff: false });
  // Something it cannot answer is said plainly, with what it can help with, and goes to the team
  const unknown = await ask("suggest me food places");
  expect(unknown).toEqual({ reply: c.fallbackScope, handoff: true });
  // In Dutch for a Dutch visitor
  expect(await ask("tell me weather places", "nl")).toEqual({ reply: nl.conciergeSection.fallbackScope, handoff: true });
  expect((await ask("Hoeveel kost een rit?", "nl")).reply).toBe(nl.conciergeSection.faq15A);
  await api.dispose();
});

test("the privacy policy names the processors the site actually uses, in both languages, and not the ones it left", async ({ page }) => {
  for (const [path, copy] of [["/en/privacy", en.privacy], ["/nl/privacy", nl.privacy]] as const) {
    await page.goto(path);
    const main = page.locator("main");
    await expect(main).toContainText(copy.s4Hosting);
    await expect(main).toContainText(copy.s4Resend);
    await expect(main).toContainText(copy.s4Anthropic);
    await expect(main).toContainText(copy.s4p3);
    await expect(main).toContainText(copy.s2p4);
    // The Corporate Partner section describes the account, the bookings and how long they are kept
    for (const part of [copy.s8p1, copy.s8p2, copy.s8p3, copy.s8p4]) await expect(main).toContainText(part);
    await expect(main).not.toContainText(/Vercel|Supabase/);
  }
});

test("the showreel is the client's new cut: served with ranges, 51 seconds long, and it plays from the poster", async ({ page, request }) => {
  // The files exist and the video can be fetched in pieces (a browser starts playing before it has all of it)
  const partial = await request.get("/assets/brand-film-v3.mp4", { headers: { range: "bytes=0-1023" } });
  expect([200, 206]).toContain(partial.status());
  expect(partial.headers()["content-type"]).toContain("video/mp4");
  const poster = await request.get("/assets/brand-film-poster-v3.jpg");
  expect(poster.status()).toBe(200);
  expect(poster.headers()["content-type"]).toContain("image/jpeg");
  // The old cut is gone
  expect((await request.get("/assets/brand-film-v2.mp4")).status()).toBe(404);

  await page.goto("/en");
  const video = page.locator("video[src='/assets/brand-film-v3.mp4']");
  await expect(video).toHaveAttribute("poster", "/assets/brand-film-poster-v3.jpg");
  await video.scrollIntoViewIfNeeded();
  // The poster says how long the film is
  await expect(page.getByText("00:51", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: en.film.play }).click();
  await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5);
  const duration = await video.evaluate((el: HTMLVideoElement) => el.duration);
  expect(duration).toBeGreaterThan(50);
  expect(duration).toBeLessThan(52);
});
