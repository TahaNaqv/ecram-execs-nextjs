import { expect, test, type Browser, type Page } from "@playwright/test";
import postgres from "postgres";
import en from "../../lib/i18n/dictionaries/en.json";
import { guestKey, verifyGuestKey } from "../../lib/quotes/guest-link";
import { chooseCar, confirmedReference, fillDetails, fillJourney, nextYear } from "./booking-helpers";
import { fillAdminLogin } from "./helpers";

/**
 * Every booking is reviewed by hand before payment (the client, 8 Nov 2026). The visitor waits on their booking's private
 * page; the booking manager approves it, or discusses it with them there first (and may change the cars).
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const g = en.guestBooking;
const r = en.admin.review;
const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function clean() {
  const db = sql();
  try {
    await db`delete from quote_requests where email like 'review-%@e2e.ecramexecs.test'`;
  } finally {
    await db.end();
  }
}
test.beforeAll(clean);
test.afterAll(clean);

async function row(reference: string) {
  const db = sql();
  try {
    const [found] = await db`select id, status, vehicle, vehicles, vehicle_count from quote_requests where reference = ${reference}`;
    return found as { id: string; status: string; vehicle: string | null; vehicles: { key: string; count: number }[] | null; vehicle_count: number };
  } finally {
    await db.end();
  }
}

/** Books as a website visitor and lands on the booking's page: its reference and the page's address. */
async function book(page: Page, name: string) {
  const email = `review-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.ecramexecs.test`;
  await page.goto("/en");
  await fillJourney(page, { from: "Schiphol Airport, Arrivals 2", to: "Hotel Des Indes, The Hague", at: nextYear("14-03", "08:30"), flight: "KL1234", pax: 2, bags: 1 });
  await chooseCar(page, "Mercedes-Benz VLE 300");
  // A private occasion: a business trip asks for the company and its KvK number
  await fillDetails(page, { name, email, phone: "6 1234 5678", purpose: "private" });
  const reference = await confirmedReference(page, `Thank you, ${name.split(" ")[0]}`);
  return { reference, url: page.url() };
}

async function admin(browser: Browser, reference: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page).toHaveURL(/\/admin(?!\/login)/);
  const { id } = await row(reference);
  await page.goto(`/admin/requests/${id}`);
  return { page, close: () => context.close() };
}

test("the link's key belongs to its booking, and to no other", () => {
  const id = "0b0c9c1e-8a51-4c54-9e0a-6b1f2f4c0d11";
  const key = guestKey(id);
  expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(verifyGuestKey(id, key)).toBe(true);
  expect(verifyGuestKey("1b0c9c1e-8a51-4c54-9e0a-6b1f2f4c0d11", key)).toBe(false);
  expect(verifyGuestKey(id, key.slice(0, 31) + (key.endsWith("A") ? "B" : "A"))).toBe(false);
  expect(verifyGuestKey(id, undefined)).toBe(false);
});

test("a sent booking waits on its own page, and moves on by itself when the booking manager approves it", async ({ page, browser }) => {
  test.slow();
  const { reference, url } = await book(page, "Jan de Vries");
  await expect(page.getByText(g.reviewChecking)).toBeVisible();
  await expect(page.getByText(g.reviewKeepOpen)).toBeVisible();
  expect((await row(reference)).status).toBe("new");

  // The link opens it again after a reload; a wrong key, or the reference alone, opens nothing
  await page.reload();
  await expect(page.getByRole("heading", { name: /being reviewed/ })).toBeVisible();
  const stranger = await page.context().newPage();
  await stranger.goto(url.replace(/k=[^&]+/, "k=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
  await expect(stranger.getByText(g.notFound)).toBeVisible();
  expect((await stranger.request.get(`/api/booking/state?ref=${reference}&k=wrong`)).status()).toBe(404);
  await stranger.close();

  const team = await admin(browser, reference);
  await team.page.getByRole("button", { name: r.approve }).click();
  // Approved: the booking is confirmed (the route also emails the customer, which can take a moment)
  await expect.poll(async () => (await row(reference)).status, { timeout: 30_000 }).toBe("confirmed");
  await team.close();

  // The visitor's open page follows within a poll, without a reload
  await expect(page.getByRole("heading", { name: g.approvedHeading })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(g.paymentFollows)).toBeVisible();
});

test("the booking manager discusses a booking, changes its cars, and approves it", async ({ page, browser }) => {
  test.slow();
  const { reference } = await book(page, "Uma Visser");
  const team = await admin(browser, reference);

  // Discuss further: a message to the customer, and the booking is in discussion
  await team.page.getByRole("button", { name: r.discuss }).click();
  await team.page.getByLabel(r.discussLabel).fill("We cannot offer the Mercedes at that time. Would an Audi suit you?");
  await team.page.getByRole("button", { name: r.discussSend }).click();
  await expect(team.page.getByText(r.discussSent)).toBeVisible();
  await expect.poll(async () => (await row(reference)).status).toBe("contacted");

  // The visitor's page turns to the conversation, and they answer there
  await expect(page.getByRole("heading", { name: g.discussHeading })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Would an Audi suit you?")).toBeVisible();
  await page.getByLabel(g.replyLabel).fill("Yes, an Audi is fine.");
  await page.getByRole("button", { name: g.send, exact: true }).click();
  await expect(page.getByText("Yes, an Audi is fine.").last()).toBeVisible();

  // The team sees the answer, changes the cars, and approves
  await team.page.reload();
  await expect(team.page.getByText("Yes, an Audi is fine.")).toBeVisible();
  await team.page.getByRole("button", { name: r.carsFewer.replace("{car}", "Mercedes-Benz VLE 300") }).click();
  await team.page.getByRole("button", { name: r.carsMore.replace("{car}", "Audi e-tron GT") }).click();
  await team.page.getByRole("button", { name: r.carsSave }).click();
  await expect(team.page.getByText(r.carsSaved)).toBeVisible();
  const changed = await row(reference);
  expect(changed.vehicle).toBe("audi");
  expect(changed.vehicles).toEqual([{ key: "audi", count: 1 }]);

  await team.page.getByRole("button", { name: r.approve }).click();
  await expect.poll(async () => (await row(reference)).status, { timeout: 30_000 }).toBe("confirmed");
  await team.close();
  await expect(page.getByRole("heading", { name: g.approvedHeading })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Audi e-tron GT")).toBeVisible();
});
