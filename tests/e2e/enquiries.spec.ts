import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { newEmail, PASSWORD, seedBooking, seedContact, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";

/**
 * Enquiry management: the enquiries that come through the website, in a standard and a corporate queue, each with the time
 * left to answer and the response figures. The target is an hour for both (lib/admin/sla.ts).
 */
const e = en.admin.enquiries;

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: en.admin.dashboard.title })).toBeVisible();
}
async function open(page: Page) {
  await page.goto("/admin/enquiries");
  await expect(page.getByRole("heading", { name: e.title })).toBeVisible();
}
/** Moves an enquiry's arrival back in time, to try the countdown and the late ones without waiting. */
async function arrivedMinutesAgo(id: string, minutes: number) {
  const db = sql();
  await db`update quote_requests set created_at = now() - make_interval(mins => ${minutes}) where id = ${id}`;
  await db.end();
}
const queue = (page: Page, which: "standard" | "corporate") => page.locator(`[data-queue="${which}"]`);
const seconds = (text: string) => {
  const [h, m, s] = text.replace("−", "").split(":").map(Number);
  return h * 3600 + m * 60 + s;
};
async function answer(page: Page, id: string, status = "contacted") {
  await page.goto(`/admin/requests/${id}`);
  await page.selectOption("#req-status", status);
  await page.getByRole("button", { name: en.admin.common.save }).click();
  // The save is done when the database says so (the form's own "Saved" note comes and goes with the refresh)
  await expect
    .poll(async () => {
      const db = sql();
      try {
        const [row] = await db`select status from quote_requests where id = ${id}`;
        return row?.status;
      } finally {
        await db.end();
      }
    })
    .toBe(status);
}

// A queue lists its 25 most urgent: enquiries other specs left waiting would push these tests' rows out of sight. Specs run one at a time, so they are put aside first.
test.beforeEach(async () => {
  const db = sql();
  await db`update quote_requests set status = 'cancelled' where status = 'new' and source in ('website', 'website-bespoke', 'website-corporate', 'portal')`;
  await db.end();
});

test("the menu lists Enquiries between the dashboard and the requests", async ({ page }) => {
  await signIn(page);
  const menu = page.getByRole("navigation", { name: en.admin.nav.sectionsLabel });
  const labels = await menu.getByRole("link").allInnerTexts();
  expect(labels[0]).toContain(en.admin.nav.dashboard);
  expect(labels[1]).toContain(en.admin.nav.enquiries);
  expect(labels[2]).toContain(en.admin.nav.requests);
  await menu.getByRole("link", { name: new RegExp(`^${en.admin.nav.enquiries}`) }).click();
  await expect(page).toHaveURL(/\/admin\/enquiries$/);
  await expect(menu.getByRole("link", { name: new RegExp(`^${en.admin.nav.enquiries}`) })).toHaveAttribute("aria-current", "page");
});

test("enquiries from the website split into the standard and the corporate queue; what is not an enquiry is left out", async ({ page }) => {
  test.slow();
  const partnerEmail = newEmail("queue-partner");
  const contactId = await seedContact(partnerEmail, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  const standard = await seedBooking({ contactId: null, email: newEmail("queue-std"), status: "new", source: "website" });
  const bespoke = await seedBooking({ contactId: null, email: newEmail("queue-bespoke"), status: "new", source: "website-bespoke" });
  const portal = await seedBooking({ contactId, email: partnerEmail, status: "new", source: "portal" });
  const partnerOnWebsite = await seedBooking({ contactId, email: partnerEmail, status: "new", source: "website" });
  const keyedIn = await seedBooking({ contactId: null, email: newEmail("queue-admin"), status: "new", source: "admin" });
  const answered = await seedBooking({ contactId: null, email: newEmail("queue-done"), status: "contacted", source: "website" });
  await signIn(page);
  await open(page);

  const std = queue(page, "standard");
  const corp = queue(page, "corporate");
  await expect(std).toContainText(e.standardTitle);
  await expect(corp).toContainText(e.corporateTitle);
  await expect(corp).toContainText(e.corporateTag);
  for (const r of [standard, bespoke]) {
    await expect(std.locator(`[data-enquiry="${r.reference}"]`)).toBeVisible();
    await expect(corp.locator(`[data-enquiry="${r.reference}"]`)).toHaveCount(0);
  }
  for (const r of [portal, partnerOnWebsite]) {
    await expect(corp.locator(`[data-enquiry="${r.reference}"]`)).toBeVisible();
    await expect(std.locator(`[data-enquiry="${r.reference}"]`)).toHaveCount(0);
  }
  // The corporate queue names the company, the standard one the client
  await expect(corp.locator(`[data-enquiry="${portal.reference}"]`)).toContainText("Orion Holdings B.V.");
  await expect(std.locator(`[data-enquiry="${standard.reference}"]`)).toContainText("Anouk Jansen");
  // A booking the team keyed in, and one already answered, are not waiting enquiries
  for (const r of [keyedIn, answered]) await expect(page.locator(`[data-enquiry="${r.reference}"]`)).toHaveCount(0);
  // A row leads to the request
  await std.locator(`[data-enquiry="${standard.reference}"]`).getByRole("link", { name: standard.reference }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/requests/${standard.id}$`));
});

test("the time left counts down, and a late enquiry is marked overdue and raises the alert", async ({ page }) => {
  test.slow();
  const fresh = await seedBooking({ contactId: null, email: newEmail("sla-fresh"), status: "new" });
  const late = await seedBooking({ contactId: null, email: newEmail("sla-late"), status: "new" });
  await arrivedMinutesAgo(fresh.id, 10);
  await arrivedMinutesAgo(late.id, 75);
  await signIn(page);
  await open(page);

  // Ten minutes in, fifty are left; the clock moves
  const timer = queue(page, "standard").locator(`[data-enquiry="${fresh.reference}"] [role=timer]`);
  const first = seconds(await timer.locator("span").first().innerText());
  expect(first).toBeGreaterThan(49 * 60 - 20);
  expect(first).toBeLessThan(50 * 60 + 5);
  await page.waitForTimeout(2200);
  expect(seconds(await timer.locator("span").first().innerText())).toBeLessThan(first);
  await expect(timer).toHaveAttribute("data-late", "false");

  // Seventy-five minutes in, it is fifteen minutes late
  const overdue = queue(page, "standard").locator(`[data-enquiry="${late.reference}"] [role=timer]`);
  await expect(overdue).toHaveAttribute("data-late", "true");
  await expect(overdue).toContainText(e.overdue);
  await expect(overdue).toContainText("−00:1");
  // The most urgent comes first
  const order = await queue(page, "standard").locator("[data-enquiry]").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-enquiry")));
  expect(order.indexOf(late.reference)).toBeLessThan(order.indexOf(fresh.reference));
  // The strip at the foot says so
  const alert = page.locator("[data-alert]");
  await expect(alert).toHaveAttribute("data-alert", "bad");
  await expect(alert).toContainText(e.alertOverdue);
  await expect(alert).toContainText(e.alertOverdueText.replace("{queue}", e.queueStandardShort).replace("{count}", "1"));
});

test("answering an enquiry takes it out of the queue; the answer time and whether it was in time are kept", async ({ page }) => {
  test.slow();
  const quick = await seedBooking({ contactId: null, email: newEmail("sla-quick"), status: "new" });
  const slow = await seedBooking({ contactId: null, email: newEmail("sla-slow"), status: "new" });
  await arrivedMinutesAgo(slow.id, 90);
  await signIn(page);
  await open(page);
  await expect(queue(page, "standard").locator(`[data-enquiry="${quick.reference}"]`)).toBeVisible();
  await expect(queue(page, "standard").locator(`[data-enquiry="${slow.reference}"]`)).toBeVisible();

  await answer(page, quick.id);
  await answer(page, slow.id, "quoted");
  await open(page);
  const std = queue(page, "standard");
  await expect(std.locator(`[data-enquiry="${quick.reference}"]`)).toHaveCount(0);
  await expect(std.locator(`[data-enquiry="${slow.reference}"]`)).toHaveCount(0);
  // Both are listed as answered: one in time, one late
  await expect(std.locator(`[data-answered="${quick.reference}"]`)).toContainText(e.onTime);
  await expect(std.locator(`[data-answered="${slow.reference}"]`)).toContainText(e.late);
  await expect(std.locator(`[data-answered="${slow.reference}"]`)).toContainText("1 h "); // about an hour and a half
  // The figures now have something to say
  await expect(std.locator("[data-stat=average]")).not.toHaveText("—");
  const compliance = await std.locator("[data-stat=compliance]").innerText();
  expect(compliance).toMatch(/^\d+%$/);
  expect(Number.parseInt(compliance)).toBeLessThan(100); // the late one counts against it
});

test("an enquiry put back to New is waiting again and not also answered; closing one unanswered does not count as an answer", async ({ page }) => {
  test.slow();
  const back = await seedBooking({ contactId: null, email: newEmail("sla-back"), status: "new" });
  const closed = await seedBooking({ contactId: null, email: newEmail("sla-closed"), status: "new" });
  await arrivedMinutesAgo(back.id, 30);
  await arrivedMinutesAgo(closed.id, 30);
  await signIn(page);
  await answer(page, back.id, "contacted");
  await answer(page, back.id, "new");
  await answer(page, closed.id, "cancelled");
  await open(page);

  const std = queue(page, "standard");
  await expect(std.locator(`[data-enquiry="${back.reference}"]`)).toHaveCount(1);
  await expect(std.locator(`[data-answered="${back.reference}"]`)).toHaveCount(0);
  await expect(std.locator("[data-stat=new]")).toHaveText("1");
  // Cancelling is not an answer: not waiting, and not among the answered (the latest answers lead that list, so it would show first)
  await expect(page.locator(`[data-enquiry="${closed.reference}"], [data-answered="${closed.reference}"]`)).toHaveCount(0);
});

test("a portal enquiry stays in the corporate queue after the partner link is cleared", async ({ page }) => {
  const email = newEmail("queue-detached");
  const contactId = await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  const booking = await seedBooking({ contactId, email, status: "new", source: "portal" });
  const db = sql();
  await db`update quote_requests set corporate_contact_id = null where id = ${booking.id}`;
  await db.end();
  await signIn(page);
  await open(page);
  await expect(queue(page, "corporate").locator(`[data-enquiry="${booking.reference}"]`)).toBeVisible();
  await expect(queue(page, "standard").locator(`[data-enquiry="${booking.reference}"]`)).toHaveCount(0);
});

test("the page reads in Dutch for a Dutch admin, and fits a phone", async ({ page }) => {
  test.slow();
  const waiting = await seedBooking({ contactId: null, email: newEmail("sla-nl"), status: "new" });
  await signIn(page);
  await page.getByRole("form", { name: en.admin.common.language }).getByRole("button", { name: "nl" }).click();
  try {
    // The switch is done when Dutch shows as the chosen language (the dashboard's title is the same in both); only then is it safe to move on
    await expect(page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "nl" })).toBeDisabled();
    await page.goto("/admin/enquiries");
    await expect(page.getByRole("heading", { name: nl.admin.enquiries.title })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`^${nl.admin.nav.enquiries}`) })).toBeVisible();
    await expect(queue(page, "standard")).toContainText(nl.admin.enquiries.standardTag);
    await expect(queue(page, "corporate")).toContainText(nl.admin.enquiries.corporateTag);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.reload();
    await expect(queue(page, "standard").locator(`[data-enquiry="${waiting.reference}"]`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  } finally {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "en" }).click();
    await expect(page.getByRole("heading", { name: en.admin.enquiries.title })).toBeVisible();
  }
});
