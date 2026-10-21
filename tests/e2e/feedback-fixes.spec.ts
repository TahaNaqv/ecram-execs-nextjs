import { expect, test } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { FLEET } from "../../lib/fleet/vehicles";
import { CONSENTED_STATE } from "./helpers";

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
  await page.goto("/en");
  await expect(page.locator("#q-phoneCountry")).toHaveValue("31");
  expect(await page.locator("#q-phoneCountry option").count()).toBeGreaterThan(30);
  await page.selectOption("#q-phoneCountry", "44");
  await expect(page.locator("#q-phoneCountry")).toHaveValue("44");
});

// The concierge is a chat with a message bar and a few starter topics. Without an AI key configured (as in these tests) it
// answers from the questions on the page and hands anything else to the team on WhatsApp.
test("the concierge answers a typed question, hands an unknown one to WhatsApp, and leaves the quote form alone", async ({ page }) => {
  await page.goto("/en");
  const box = page.locator("input[name=message]");
  await box.fill("How far in advance should I book?");
  await box.press("Enter");
  await expect(page.getByRole("log")).toContainText(en.conciergeSection.faq1A, { timeout: 8000 });
  await box.fill("qwerty zzzz");
  await box.press("Enter");
  await expect(page.getByRole("link", { name: en.conciergeSection.whatsappCta })).toBeVisible({ timeout: 8000 });
  await expect(page.locator("#q-notes")).toHaveValue("");
});

test("a starter topic is sent into the chat as the visitor's own message and answered, and the topics then leave", async ({ page }) => {
  await page.goto("/en");
  const log = page.getByRole("log");
  const chip = page.getByRole("button", { name: en.conciergeSection.chipAirport });
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

// The Fleet section was removed at the client's request: a vehicle is now chosen in the booking form, which shows its photos
// beside the form and its questions in a pop-up.
test("every vehicle shows its own questions, not the same one repeated", async ({ page }) => {
  await page.goto("/en");
  const select = page.locator("#q-vehicle");
  await select.scrollIntoViewIfNeeded();
  const keys = await select.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value).filter((v) => v && v !== "advise"));
  expect(keys).toHaveLength(FLEET.length);
  for (const key of keys) {
    await select.selectOption(key);
    await page.getByRole("button", { name: en.quoteForm.toggleQuestions }).click();
    const count = await page.locator("details").count();
    // A vehicle with confirmed figures answers about passengers, range, features and luggage; one without (the EQS has no
    // photographs or figures yet) still answers how long it can be booked for
    expect(count, key).toBeGreaterThan(FLEET.find((v) => v.key === key)?.specs ? 1 : 0);
    await page.getByRole("button", { name: "✕" }).click();
    await expect(page.locator("details")).toHaveCount(0);
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
  await page.goto("/en");
  await page.locator("#q-vehicle").scrollIntoViewIfNeeded();
  await page.locator("#q-vehicle").selectOption("mercedes_vle_300");
  const gallery = page.locator("#enquire [aria-roledescription=carousel]");
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
  await page.locator("#enquire").getByRole("button", { name: /Next photo/ }).click();
  await page.waitForTimeout(250);
  expect(await counter()).toMatch(/^2 \/ \d+$/);
  await page.waitForTimeout(1200);
  expect(await counter()).toMatch(/^2 \/ \d+$/);
  await page.locator("#enquire").getByRole("button", { name: /Previous photo/ }).click();
  await page.waitForTimeout(1200);
  expect(await counter()).toMatch(/^1 \/ \d+$/);
});

test("the home page follows the client's section order and lacks the removed sections", async ({ page }) => {
  await page.goto("/en");
  // Who we serve now sits straight after the booking form
  const order = await page.evaluate(() => [...document.querySelectorAll("main > section[id]")].map((s) => s.id));
  expect(order.slice(0, 3)).toEqual(["top", "enquire", "corporate"]);
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

test("each audience card reveals its picture on hover and no dashes interrupt the heading", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("#corporate h2")).toHaveText("Trusted by those for whom every minute, and every impression, counts.");
  const cards = page.locator("#corporate ul > li");
  await expect(cards).toHaveCount(6);
  const photo = (i: number) => cards.nth(i).locator("img");
  for (let i = 0; i < 6; i++) await expect(photo(i)).toHaveCount(1);
  const opacity = (i: number) => cards.nth(i).locator("div[aria-hidden=true]").evaluate((el) => getComputedStyle(el).opacity);

  await cards.first().scrollIntoViewIfNeeded();
  expect(await opacity(0)).toBe("0");
  await cards.first().hover();
  await expect.poll(() => opacity(0)).toBe("1");
  expect(await opacity(1)).toBe("0"); // only the card under the pointer
  await cards.nth(3).hover();
  await expect.poll(() => opacity(3)).toBe("1");
  await expect.poll(() => opacity(0)).toBe("0");
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
