import { expect, test } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { FLEET } from "../../lib/fleet/vehicles";
import { CONSENTED_STATE } from "./helpers";

/** A complete trip, so /book opens on the car step. */
const READY_TRIP = `/en/book?from=Kurhaus&to=Hotel+Des+Indes&at=${new Date().getFullYear() + 1}-03-14T08:30&pax=2&bags=2`;

// Regression tests for the client's bug reports (Web issue / Mobile Responsive tabs). None needs the database.

test("the header stays fixed while scrolling", async ({ page }) => {
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo({ top: 3000, behavior: "instant" }));
  const top = await page.evaluate(() => Math.round(document.querySelector("header")!.getBoundingClientRect().top));
  expect(top).toBe(0);
});

test("refreshing returns to the top of the page", async ({ page }) => {
  await page.goto("/en");
  await page.evaluate(() => window.scrollTo({ top: 3000, behavior: "instant" }));
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(900);
  expect(await page.evaluate(() => Math.round(scrollY))).toBe(0);
});

test("switching language does not jump back to the last anchor", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("navigation", { name: en.nav.primaryLabel }).getByRole("link", { name: en.nav.experience }).click(); // leaves #experience in the URL
  await page.evaluate(() => window.scrollTo({ top: 5000, behavior: "instant" }));
  await page.getByRole("link", { name: en.switcher.ariaNl }).first().click();
  await page.waitForURL("**/nl");
  await page.waitForTimeout(900);
  expect(page.url()).not.toContain("#");
  const y = await page.evaluate(() => scrollY);
  expect(y).toBeGreaterThan(3500); // still far down the page, not at "The Experience"
});

test("the phone field offers many country codes, Netherlands first and selected", async ({ page }) => {
  await page.goto(READY_TRIP);
  await page.getByRole("button", { name: en.booking.skipCar }).click();
  const country = page.getByLabel(en.booking.phoneCountry).first();
  await expect(country).toHaveValue("31");
  expect(await country.locator("option").count()).toBeGreaterThan(30);
  await country.selectOption("44");
  await expect(country).toHaveValue("44");
});

// The concierge is a chat with a message bar and a few starter topics. Without an AI key configured (as in these tests) it
// answers from the questions on the page and hands anything else to the team on WhatsApp.
test("the concierge answers a typed question, hands an unknown one to WhatsApp, and leaves the booking bar alone", async ({ page }) => {
  await page.goto("/en");
  const box = page.locator("input[name=message]");
  await box.fill("How far in advance should I book?");
  await box.press("Enter");
  await expect(page.getByRole("log")).toContainText(en.conciergeSection.faq1A, { timeout: 8000 });
  await box.fill("qwerty zzzz");
  await box.press("Enter");
  await expect(page.getByRole("link", { name: en.conciergeSection.whatsappCta })).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#enquire").getByLabel(en.booking.from, { exact: true })).toHaveValue("");
});

test("a starter topic is sent into the chat as the visitor's own message and answered, and the topics then leave", async ({ page }) => {
  await page.goto("/en");
  const log = page.getByRole("log");
  // (inside the chat: a Services card is also called "Airport Transfers")
  const chip = log.getByRole("button", { name: en.conciergeSection.chipAirport });
  await chip.click();
  await expect(log).toContainText("Can you explain your airport transfer services", { timeout: 8000 });
  await expect(log.locator("> div")).toHaveCount(3, { timeout: 8000 }); // the greeting, the visitor's message, the answer
  await expect(chip).toHaveCount(0);
});

test("the concierge endpoint takes short messages only, builds its own knowledge, and limits how often one visitor can ask", async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  const ask = (data: object) => api.post("/api/concierge", { data });

  expect((await ask({ message: "x".repeat(501) })).status()).toBe(400);
  expect((await ask({ message: "" })).status()).toBe(400);
  expect((await ask({})).status()).toBe(400);

  // Questions and answers come from the dictionary in the visitor's language, not from the request
  const reply = await (await ask({ message: "How far in advance should I book?", locale: "en", faqs: [["How far in advance should I book?", "INJECTED"]] })).json();
  expect(reply.reply).toBe(en.conciergeSection.faq1A);

  // One visitor gets 20 questions in ten minutes
  let refused = 0;
  for (let i = 0; i < 25; i++) if ((await ask({ message: `question ${i}` })).status() === 429) refused++;
  expect(refused).toBeGreaterThanOrEqual(4);
  await api.dispose();
});

// The Fleet section was removed at the client's request: a vehicle is now chosen in the booking flow's car step, which
// shows each car's photos and questions in a pop-up.
test("every vehicle shows its own questions, not the same one repeated", async ({ page }) => {
  await page.goto(READY_TRIP);
  const dialog = page.getByRole("dialog");
  for (const v of FLEET) {
    await page.getByRole("button", { name: en.booking.carDetails.replace("{car}", v.name) }).click();
    await expect(dialog).toBeVisible();
    // A vehicle with confirmed figures answers about passengers, range, features and luggage; one without still answers
    // how long it can be booked for
    expect(await dialog.locator("details").count(), v.key).toBeGreaterThan(v.specs ? 1 : 0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});

test("every fleet photo exists and is served", async ({ request }) => {
  const broken: string[] = [];
  for (const src of new Set(FLEET.flatMap((v) => v.images))) {
    const response = await request.get(src);
    if (!response.ok()) broken.push(`${response.status()} ${src}`);
  }
  expect(FLEET.flatMap((v) => v.images).length).toBeGreaterThan(20);
  expect(broken).toEqual([]);
});

test("header and hero buttons glide to their section instead of jumping", async ({ page }) => {
  await page.goto("/en");
  const positions: number[] = [];
  await page.getByRole("link", { name: en.nav.services }).first().click();
  for (let i = 0; i < 12; i++) {
    positions.push(await page.evaluate(() => Math.round(scrollY)));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
  const end = await page.evaluate(() => Math.round(scrollY));
  // At least one stop on the way: a jump goes from the top straight to the end and never shows an in-between position
  // (a headless browser can stall mid-glide, so this checks for any, not a count)
  expect(positions.filter((y) => y > 0 && y < end).length).toBeGreaterThanOrEqual(1);
  const sectionTop = await page.evaluate(() => Math.round(document.querySelector("#services")!.getBoundingClientRect().top));
  expect(Math.abs(sectionTop - 88)).toBeLessThan(6);
});

test("with reduced motion requested, the same buttons jump straight there", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", storageState: CONSENTED_STATE });
  const page = await context.newPage();
  await page.goto("/en");
  await page.getByRole("link", { name: en.nav.services }).first().click();
  await page.waitForTimeout(150);
  const sectionTop = await page.evaluate(() => Math.round(document.querySelector("#services")!.getBoundingClientRect().top));
  expect(Math.abs(sectionTop - 88)).toBeLessThan(6);
  await context.close();
});

test("a vehicle gallery's counter follows the arrows, even if a scroll event reports the old position", async ({ page }) => {
  await page.goto(READY_TRIP);
  await page.getByRole("button", { name: en.booking.carDetails.replace("{car}", "Mercedes-Benz VLE 300") }).click();
  const dialog = page.getByRole("dialog");
  const gallery = dialog.locator("[aria-roledescription=carousel]");
  await expect(gallery).toBeVisible();
  const counter = () =>
    gallery.evaluate((g) => [...g.querySelectorAll("span")].find((s) => /^\d+ \/ \d+$/.test(s.textContent!.trim()))?.textContent?.trim());
  // Some browsers report a scroll event at the position being left as a glide begins; that used to reset the counter
  await gallery.evaluate((g) => {
    const track = g.children[0] as HTMLElement;
    const original = track.scrollTo.bind(track);
    track.scrollTo = ((options: ScrollToOptions) => {
      original(options);
      setTimeout(() => track.dispatchEvent(new Event("scroll")), 0);
    }) as typeof track.scrollTo;
  });
  expect(await counter()).toMatch(/^1 \/ \d+$/);
  await dialog.getByRole("button", { name: /Next photo/ }).click();
  await page.waitForTimeout(250);
  expect(await counter()).toMatch(/^2 \/ \d+$/);
  await page.waitForTimeout(1200);
  expect(await counter()).toMatch(/^2 \/ \d+$/);
  await dialog.getByRole("button", { name: /Previous photo/ }).click();
  await page.waitForTimeout(1200);
  expect(await counter()).toMatch(/^1 \/ \d+$/);
});

test("the home page follows the client's section order and lacks the removed sections", async ({ page }) => {
  await page.goto("/en");
  // The booking bar is in the hero (#enquire, which every "Request a quote" link points to), and Who we serve follows it
  const order = await page.evaluate(() => [...document.querySelectorAll("main > section[id]")].map((s) => s.id));
  expect(order.slice(0, 2)).toEqual(["top", "corporate"]);
  await expect(page.locator("#top #enquire")).toBeAttached();
  // The Fleet, Bespoke and Sustainability sections are gone, and nothing links to them
  for (const id of ["fleet", "bespoke", "sustainability"]) expect(order).not.toContain(id);
  await expect(page.locator("body")).not.toContainText("SUSTAINABILITY & ESG");
  await expect(page.locator('a[href$="#fleet"]')).toHaveCount(0);
  // No vehicle carries a "100% electric" label, in either language
  for (const path of ["/en", "/nl"]) {
    await page.goto(path);
    await expect(page.locator("body")).not.toContainText(/100% ELEKTRISCH|100% ELECTRIC/i);
  }
});

test("the header lists Corporate, The Experience, Destinations, Services in that order", async ({ page }) => {
  for (const [path, d] of [["/en", en], ["/nl", nl]] as const) {
    await page.goto(path);
    const links = page.getByRole("navigation", { name: d.nav.primaryLabel }).getByRole("link");
    await expect(links).toHaveText([d.nav.corporate, d.nav.experience, d.nav.destinations, d.nav.services]);
    // Every link leads to a section that is on the page
    for (const href of await links.evaluateAll((els) => els.map((e) => e.getAttribute("href")))) {
      await expect(page.locator(href!)).toBeAttached();
    }
  }
});

test("the hero's second button is Corporate Login and opens the sign-in page", async ({ page }) => {
  await page.goto("/en");
  const button = page.locator("#top").getByRole("link", { name: en.hero.corporateLogin });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/login$/);
});

test("running text writes Ecram Execs with a capital E only", async ({ page }) => {
  for (const [path, d] of [["/en", en], ["/nl", nl]] as const) {
    await page.goto(path);
    const heading = page.locator("#netherlands h2");
    await expect(heading).toContainText("Ecram Execs");
    await expect(heading).not.toContainText("ECRAM");
    expect(d.destinationsSection.heading).not.toMatch(/ECRAM/);
  }
});

test("no dashes interrupt the Who We Serve heading (the audience cards themselves are covered by audience.spec.ts)", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#corporate h2")).toHaveText("Trusted by those for whom every minute and every impression counts.");
  await expect(page.locator("#corporate article")).toHaveCount(6);
});

test("the Corporate Partner heading is centred on the page", async ({ page }) => {
  await page.goto("/en/corporate-partner");
  const centre = async (selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return Math.round(r.left + r.width / 2);
    });
  const middle = await page.evaluate(() => Math.round(document.documentElement.clientWidth / 2));
  expect(Math.abs((await centre("main h1")) - middle)).toBeLessThan(4);
  expect(await page.locator("main h1").evaluate((el) => getComputedStyle(el).textAlign)).toBe("center");
});
