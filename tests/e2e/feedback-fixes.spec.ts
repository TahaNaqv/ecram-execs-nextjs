import { expect, test } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

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

test("choosing a concierge question sends it into the chat, the concierge answers, and the question leaves the list", async ({ page }) => {
  const c = en.conciergeSection as Record<string, string>;
  await page.goto("/en");
  const list = page.getByRole("list", { name: c.faqLabel });
  const log = page.getByRole("log");
  const questions = list.getByRole("button");
  const before = await questions.count();
  expect(before).toBe(13);

  await list.getByRole("button", { name: c.faq1Q }).click();
  // It is sent as the visitor's own message, and answered with that question's answer
  await expect(log).toContainText(c.faq1Q);
  await expect(log).toContainText(c.faq1A, { timeout: 5000 });
  await expect(list.getByRole("button", { name: c.faq1Q })).toHaveCount(0);
  await expect(questions).toHaveCount(before - 1);
  // Focus moved on to the next question rather than being lost with the one that left
  await expect(questions.first()).toBeFocused();

  // A question typed in the bar is answered from the closest one, and that one leaves the list too
  const box = page.locator("input[name=message]");
  await box.fill(c.faq3Q.toLowerCase().replace("?", ""));
  await box.press("Enter");
  await expect(log).toContainText(c.faq3A, { timeout: 5000 });
  await expect(list.getByRole("button", { name: c.faq3Q, exact: true })).toHaveCount(0);
  await expect(questions).toHaveCount(before - 2);
});

test("once every concierge question has been asked, the list is gone and the conversation remains", async ({ page }) => {
  test.slow();
  const c = en.conciergeSection as Record<string, string>;
  await page.goto("/en");
  const list = page.getByRole("list", { name: c.faqLabel });
  const log = page.getByRole("log");
  for (let i = 1; i <= 13; i++) {
    await list.getByRole("button", { name: c[`faq${i}Q`], exact: true }).click();
    await expect(log).toContainText(c[`faq${i}A`], { timeout: 5000 });
  }
  await expect(list).toHaveCount(0);
  await expect(log).toContainText(c.faq13A);
  // The message bar is still there for anything else
  await expect(page.locator("input[name=message]")).toBeVisible();
});

test("every vehicle shows its own questions, not the same one repeated", async ({ page }) => {
  await page.goto("/en");
  const counts = await page.evaluate(() => [...document.querySelectorAll("#fleet > div > ul > li")].map((li) => li.querySelectorAll("details").length));
  expect(counts).toHaveLength(5);
  for (const n of counts) expect(n).toBeGreaterThan(1);
});

test("every fleet photo exists and is served", async ({ page, request }) => {
  await page.goto("/en");
  // next/image gives each slide an optimiser URL; a photo that is missing on disk makes that URL fail
  const sources = await page.locator("#fleet img").evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).getAttribute("src")!));
  expect(sources.length).toBeGreaterThan(20);
  const broken: string[] = [];
  for (const src of new Set(sources)) {
    const response = await request.get(src);
    if (!response.ok()) broken.push(`${response.status()} ${decodeURIComponent(new URL(src, "http://x").searchParams.get("url") ?? src)}`);
  }
  expect(broken).toEqual([]);
});

test("header and hero buttons glide to their section instead of jumping", async ({ page }) => {
  await page.goto("/en");
  const positions: number[] = [];
  await page.getByRole("link", { name: en.nav.fleet }).first().click();
  for (let i = 0; i < 12; i++) {
    positions.push(await page.evaluate(() => Math.round(scrollY)));
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1200);
  const end = await page.evaluate(() => Math.round(scrollY));
  // At least one stop on the way: a jump goes from the top straight to the end and never shows an in-between position
  // (a headless browser can stall mid-glide, so this checks for any, not a count)
  expect(positions.filter((y) => y > 0 && y < end).length).toBeGreaterThanOrEqual(1);
  const fleetTop = await page.evaluate(() => Math.round(document.querySelector("#fleet")!.getBoundingClientRect().top));
  expect(Math.abs(fleetTop - 88)).toBeLessThan(6);
});

test("with reduced motion requested, the same buttons jump straight there", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/en");
  await page.getByRole("link", { name: en.nav.fleet }).first().click();
  await page.waitForTimeout(150);
  const fleetTop = await page.evaluate(() => Math.round(document.querySelector("#fleet")!.getBoundingClientRect().top));
  expect(Math.abs(fleetTop - 88)).toBeLessThan(6);
  await context.close();
});

test("a vehicle gallery's counter follows the arrows, even if a scroll event reports the old position", async ({ page }) => {
  await page.goto("/en");
  const card = page.locator("#fleet li").first();
  await card.scrollIntoViewIfNeeded();
  const counter = () =>
    card.evaluate((li) => [...li.querySelector("[aria-roledescription=carousel]")!.querySelectorAll("span")].find((s) => /^\d+ \/ \d+$/.test(s.textContent!.trim()))?.textContent?.trim());
  // Some browsers report a scroll event at the position being left as a glide begins; that used to reset the counter
  await card.evaluate((li) => {
    const track = li.querySelector("[aria-roledescription=carousel]")!.children[0] as HTMLElement;
    const original = track.scrollTo.bind(track);
    track.scrollTo = ((options: ScrollToOptions) => {
      original(options);
      setTimeout(() => track.dispatchEvent(new Event("scroll")), 0);
    }) as typeof track.scrollTo;
  });
  expect(await counter()).toMatch(/^1 \/ \d+$/);
  await card.getByRole("button", { name: /Next photo/ }).click();
  await page.waitForTimeout(250);
  expect(await counter()).toMatch(/^2 \/ \d+$/);
  await page.waitForTimeout(1200);
  expect(await counter()).toMatch(/^2 \/ \d+$/);
  await card.getByRole("button", { name: /Previous photo/ }).click();
  await page.waitForTimeout(1200);
  expect(await counter()).toMatch(/^1 \/ \d+$/);
});

test("the home page follows the client's section order and lacks the removed sections", async ({ page }) => {
  await page.goto("/en");
  // Who we serve now sits straight after the booking form, ahead of the fleet
  const order = await page.evaluate(() =>
    [...document.querySelectorAll("main > section[id]")].map((s) => s.id),
  );
  expect(order.slice(0, 3)).toEqual(["top", "enquire", "corporate"]);
  expect(order.indexOf("corporate")).toBeLessThan(order.indexOf("fleet"));
  for (const id of ["bespoke", "sustainability"]) expect(order).not.toContain(id);
  await expect(page.locator("body")).not.toContainText("SUSTAINABILITY & ESG");
  // No photograph is left at the end of the fleet; the picture of the rear seats is gone
  await expect(page.locator('#fleet img[src*="fleet-interior"]')).toHaveCount(0);
  // The cars carry no "100% electric" label, in either language
  for (const path of ["/en", "/nl"]) {
    await page.goto(path);
    await expect(page.locator("#fleet li h3")).toHaveCount(5);
    await expect(page.locator("#fleet")).not.toContainText(/100% ELEKTRISCH|100% ELECTRIC/i);
  }
});

test("the header lists Corporate, Fleet, The Experience, Destinations, Services in that order", async ({ page }) => {
  for (const [path, d] of [["/en", en], ["/nl", nl]] as const) {
    await page.goto(path);
    const links = page.getByRole("navigation", { name: d.nav.primaryLabel }).getByRole("link");
    await expect(links).toHaveText([d.nav.corporate, d.nav.fleet, d.nav.experience, d.nav.destinations, d.nav.services]);
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
