import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { newEmail, PASSWORD, seedBooking, seedContact, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";

/**
 * The admin dashboard: where signing in lands. Its figures are checked as differences (the figure before a booking is seeded
 * and after), because the test database holds other tests' data as well.
 */
const d = en.admin.dashboard;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: d.title })).toBeVisible();
}

/** Today's date in the Netherlands, as "YYYY-MM-DD" (pick-ups are Dutch wall-clock times, whatever zone this machine is in). */
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());

/** "€ 1.234,50" (the panel always prints Dutch money) as a number */
const euros = (text: string) => Number(text.replace(/[^\d,-]/g, "").replace(",", "."));

// A figure card: the box with the label, the value (second paragraph) and the hint
const card = (page: Page, label: string) => page.locator("div.rounded-xl").filter({ has: page.getByText(label, { exact: true }) }).first();
const figure = async (page: Page, label: string) => (await card(page, label).locator("p").nth(1).innerText()).trim();

test("signing in lands on the dashboard; the requests list is its own page in the menu", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  const menu = page.getByRole("navigation", { name: en.admin.nav.sectionsLabel });
  await expect(menu.getByRole("link", { name: en.admin.nav.dashboard })).toHaveAttribute("aria-current", "page");
  // Dashboard first, then the enquiry queues, then the requests
  const labels = await menu.getByRole("link").allInnerTexts();
  expect(labels[0]).toContain(en.admin.nav.dashboard);
  expect(labels[1]).toContain(en.admin.nav.enquiries);
  expect(labels[2]).toContain(en.admin.nav.requests);
  await menu.getByRole("link", { name: new RegExp(`^${en.admin.nav.requests}`) }).click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  await expect(page.getByRole("heading", { name: en.admin.requests.title })).toBeVisible();
  // The list's own filters stay on its page
  await page.getByRole("navigation", { name: en.admin.common.filterByStatus }).getByRole("link", { name: new RegExp(`^${en.admin.statuses.new}`) }).click();
  await expect(page).toHaveURL(/\/admin\/requests\?status=new/);
});

test("the four figures follow the vehicles, the day's bookings, the partner accounts and the month's bookings", async ({ page }) => {
  test.slow();
  const db = sql();
  const [vehicles] = await db`select count(*) filter (where status = 'available')::int as available, count(*)::int as total from vehicles`;
  await db.end();
  await signIn(page);
  await expect(page.getByText(`${vehicles.available}/${vehicles.total}`, { exact: true })).toBeVisible();

  const jobsBefore = Number(await figure(page, d.jobsLabel));
  const partnersBefore = Number(await figure(page, d.partnersLabel));
  const revenueBefore = euros(await figure(page, d.revenueLabel));

  // A confirmed booking later today, at a quoted 123 euros, and a partner account
  const email = newEmail("dash");
  const contactId = await seedContact(email, PASSWORD, "Dash Board", "Dash B.V.");
  const booking = await seedBooking({ contactId, email, status: "confirmed", pickupAt: `${today()}T23:59`, quotedAmount: "123.00" });
  await page.reload();
  await expect(page.getByRole("heading", { name: d.title })).toBeVisible();
  await expect.poll(async () => Number(await figure(page, d.jobsLabel))).toBe(jobsBefore + 1);
  expect(Number(await figure(page, d.partnersLabel))).toBe(partnersBefore + 1);
  expect(euros(await figure(page, d.revenueLabel))).toBeCloseTo(revenueBefore + 123, 2);
  expect(await card(page, d.jobsLabel).innerText()).toContain(d.jobsHint);

  // A booking that is not confirmed counts for nothing here
  await seedBooking({ contactId, email, status: "quoted", pickupAt: `${today()}T23:58`, quotedAmount: "999.00" });
  await page.reload();
  await expect.poll(async () => Number(await figure(page, d.jobsLabel))).toBe(jobsBefore + 1);
  expect(euros(await figure(page, d.revenueLabel))).toBeCloseTo(revenueBefore + 123, 2);

  // It shows in the next pick-ups and in the recent requests, and both lead to it
  const next = page.getByRole("link").filter({ hasText: booking.reference });
  await expect(next.first()).toBeVisible();
  await next.first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/requests/${booking.id}$`));
});

test("a vehicle that is switched off counts out, and a booked car shows its next booking", async ({ page }) => {
  const db = sql();
  const [car] = await db`select id, name from vehicles order by name limit 1`;
  const email = newEmail("dash-fleet");
  const booking = await seedBooking({ contactId: null, email, status: "confirmed", pickupAt: `${today()}T23:57` });
  await db`update quote_requests set vehicle = ${car.id} where id = ${booking.id}`;
  await db`update vehicles set status = 'unavailable' where id = ${car.id}`;
  try {
    await signIn(page);
    const row = page.locator("li").filter({ hasText: car.name }).filter({ hasText: d.switchedOff });
    await expect(row).toBeVisible();
    await expect(row).toContainText(d.nextBooking.replace("{when}", "").trim());
    await expect(row).toContainText("23:57");
  } finally {
    await db`update vehicles set status = 'available' where id = ${car.id}`;
    await db.end();
  }
});

test("the panels with no data source behind them say so, and the health list is honest about what it knows", async ({ page }) => {
  await signIn(page);
  // The map and the telemetry feed, as the mock-up has them, marked as not connected
  for (const title of [d.mapTitle, d.fleetTitle]) {
    const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: title }) });
    await expect(panel).toContainText(d.stateNotConnected);
  }
  await expect(page.getByText(d.mapNotConnected)).toBeVisible();
  await expect(page.getByText(d.fleetNotConnected)).toBeVisible();
  // Services the system has no link to are not shown as running
  for (const key of ["cdt", "mollie", "whatsappBusiness"]) {
    await expect(page.locator(`[data-health=${key}]`)).toHaveAttribute("data-state", "notConnected");
  }
  // The database is the one thing asked live, and it answers
  await expect(page.locator("[data-health=database]")).toHaveAttribute("data-state", "operational");
  await expect(page.locator("[data-health=database]")).toContainText(/\d+ ms/);
  // The rest report whether they are set up, never a value
  for (const key of ["email", "address", "concierge", "documents"]) {
    const state = await page.locator(`[data-health=${key}]`).getAttribute("data-state");
    expect(["configured", "missing", "down"]).toContain(state);
  }
  await expect(page.getByText(d.healthNote)).toBeVisible();
});

test("the dashboard reads in Dutch for a Dutch admin, and fits a phone", async ({ page }) => {
  await signIn(page);
  await page.getByRole("form", { name: en.admin.common.language }).getByRole("button", { name: "nl" }).click();
  try {
    await expect(page.getByRole("heading", { name: nl.admin.dashboard.title })).toBeVisible();
    await expect(page.getByText(nl.admin.dashboard.fleetLabel, { exact: true })).toBeVisible();
    await expect(page.getByText(nl.admin.dashboard.stateNotConnected).first()).toBeVisible();
    await expect(page.getByText(nl.admin.dashboard.svcMollie)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    await expect(page.getByRole("heading", { name: nl.admin.dashboard.title })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "en" }).click();
    await expect(page.getByRole("heading", { name: d.title })).toBeVisible();
  }
});
