import { expect, test, type Browser, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { guestKey } from "../../lib/quotes/guest-link";
import { newEmail, signedInPartner, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";
import { invoices, startFakeMoneybird } from "./fake-moneybird";
import { mollieCalls, refunds, startFakeMollie } from "./fake-mollie";

/**
 * Paying for an approved booking online (lib/mollie), against stand-ins for Mollie and Moneybird that this file starts.
 * The server under test must be pointed at both, so these only run when asked to:
 *
 *   MOLLIE_API_KEY=test_e2eabcdefghijklmnopqrstuvwx MOLLIE_API_URL=http://127.0.0.1:4598 E2E_FAKE_MOLLIE=4598 \
 *   MONEYBIRD_TOKEN=test MONEYBIRD_ADMINISTRATION_ID=123 MONEYBIRD_LEDGER_RIDES=L-RIDES MONEYBIRD_LEDGER_EXTRAS=L-EXTRAS \
 *   MONEYBIRD_API_URL=http://127.0.0.1:4597 E2E_FAKE_MONEYBIRD=4597 CRON_SECRET=e2e-cron-secret-0123456789 \
 *   npx playwright test payments
 *
 * Run it on its own (other specs' confirmed bookings would be invoiced too).
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const MOLLIE = Number(process.env.E2E_FAKE_MOLLIE ?? 0);
const MONEYBIRD = Number(process.env.E2E_FAKE_MONEYBIRD ?? 0);
test.skip(!MOLLIE || !MONEYBIRD, "Set E2E_FAKE_MOLLIE and E2E_FAKE_MONEYBIRD (see the top of this file) to run the payment tests");
test.describe.configure({ mode: "serial" });
test.slow();
const g = en.guestBooking;
const t = en.admin.payments;
const CRON = process.env.CRON_SECRET ?? "";

let stopMollie: (() => Promise<void>) | undefined;
let stopMoneybird: (() => Promise<void>) | undefined;

// The client's example: a 2-hour Audi with all four add-ons, €457.52
const PRICE = {
  version: "2027-01",
  segment: "public",
  exact: true,
  legs: [{ leg: "outward", at: "2031-04-14T08:30", day: "weekday", hours: 2, lines: [{ key: "audi", count: 1, rate: 9500, amount: 19000 }] }],
  rides: 19000,
  vat: 1710,
  fee: 1250,
  feeVat: 263,
  extras: [
    { key: "champagne", count: 1, unit: 7800, amount: 7800, vatRate: 0.21, vat: 1638 },
    { key: "chocolates", option: "classic", count: 1, unit: 4200, amount: 4200, vatRate: 0.21, vat: 882 },
    { key: "flowers", count: 1, unit: 6600, amount: 6600, vatRate: 0.09, vat: 594 },
    { key: "newspapers", count: 1, unit: 1500, amount: 1500, vatRate: 0.21, vat: 315 },
  ],
  extrasVat: 3429,
  total: 45752,
};
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeRef = () => `EE-${Array.from({ length: 6 }, () => REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)]).join("")}`;

let seeded = 0;
async function seed(opts: { contactId?: string | null; email?: string } = {}) {
  const db = sql();
  try {
    const reference = makeRef();
    const email = opts.email ?? newEmail("pay");
    // Each on its own day in April 2031: the same car at the same time would be refused on approval
    const pickup = `2031-04-${String(1 + (seeded++ % 28)).padStart(2, "0")}T08:30`;
    const [row] = await db`
      insert into quote_requests (reference, status, service, collection, destination, duration_hours, pickup_at, name, email, phone, quoted_amount, price_estimate, vehicle, vehicles, corporate_contact_id, source, locale)
      values (${reference}, 'new', 'hourly', 'Schiphol Airport', null, 2, ${pickup}::text::timestamp, 'Anouk Jansen', ${email}, '+31 6 1234 5678',
              '457.52', ${db.json(PRICE)}, 'audi', ${db.json([{ key: "audi", count: 1 }])}, ${opts.contactId ?? null}, ${opts.contactId ? "portal" : "website"}, 'en')
      returning id`;
    await db`insert into request_events (request_id, event) values (${row.id}, 'received')`;
    return { id: row.id as string, reference, email };
  } finally {
    await db.end();
  }
}

type PayRow = { id: string; status: string; amount_cents: number; mollie_id: string | null; moneybird_registered_at: Date | null; refunded_cents: number };
async function payRows(requestId: string): Promise<PayRow[]> {
  const db = sql();
  try {
    return (await db`select id, status, amount_cents, mollie_id, moneybird_registered_at, refunded_cents from payments where request_id = ${requestId} order by created_at`) as unknown as PayRow[];
  } finally {
    await db.end();
  }
}
async function invoiceOf(requestId: string, kind = "invoice") {
  const db = sql();
  try {
    const [row] = await db`select number, moneybird_id from moneybird_invoices where request_id = ${requestId} and kind = ${kind} order by created_at desc limit 1`;
    return row as { number: string | null; moneybird_id: string | null } | undefined;
  } finally {
    await db.end();
  }
}

async function clean() {
  const db = sql();
  try {
    await db`delete from payments where request_id in (select id from quote_requests where email like 'pay-%@e2e.ecramexecs.test') or request_id is null`;
    await db`delete from moneybird_invoices where request_id in (select id from quote_requests where email like 'pay-%@e2e.ecramexecs.test') or request_id is null`;
    await db`delete from quote_requests where email like 'pay-%@e2e.ecramexecs.test'`;
    await db`delete from corporate_contacts where email like 'pay-%@e2e.ecramexecs.test'`;
    await db`delete from app_settings where key = 'moneybird_since'`;
  } finally {
    await db.end();
  }
}
test.beforeAll(async () => {
  stopMollie = await startFakeMollie(MOLLIE);
  stopMoneybird = await startFakeMoneybird(MONEYBIRD);
  await clean();
});
test.afterAll(async () => {
  await clean();
  await stopMollie?.();
  await stopMoneybird?.();
});

let adminPage: Page;
async function signIn(browser: Browser) {
  if (adminPage) return adminPage;
  const context = await browser.newContext();
  adminPage = await context.newPage();
  await adminPage.goto("/admin/login");
  await fillAdminLogin(adminPage);
  await expect(adminPage).toHaveURL(/\/admin(?!\/login)/);
  return adminPage;
}
const setStatus = (page: Page, id: string, status: string, sendMail = true) =>
  page.request.post(`/api/admin/requests/${id}/authorise`, { data: { status, sendMail } });

/** A website booking, approved, with its Moneybird invoice made. */
async function approved(browser: Browser, opts: { contactId?: string; email?: string } = {}) {
  const admin = await signIn(browser);
  const booking = await seed(opts);
  expect((await setStatus(admin, booking.id, "confirmed")).ok()).toBe(true);
  await expect.poll(async () => (await invoiceOf(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  return { admin, booking };
}
const guestPage = (b: { id: string; reference: string }) => `/en/booking?ref=${b.reference}&k=${guestKey(b.id)}`;
const payNow = (page: Page) => page.getByRole("button", { name: /^Pay .+ now$/ });
/** On the stand-in's payment page (once it is there): Pay, Fail or Cancel. */
async function atMollie(page: Page, choice: "Pay" | "Fail" | "Cancel") {
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/checkout\/tr_\w+$/);
  await page.getByRole("link", { name: choice, exact: true }).click();
}

// ---------------------------------------------------------------------------------------------------------------------
test("a guest pays on Mollie's page, comes back to \"Paid\", and the invoice is paid in Moneybird", async ({ browser, page }) => {
  const { admin, booking } = await approved(browser);
  await page.goto(guestPage(booking));
  await expect(page.getByText(/^Pay .+457.+ now$/)).toBeVisible();
  await payNow(page).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/checkout\/tr_/);
  await atMollie(page, "Pay");

  await expect(page).toHaveURL(/\/en\/booking\?ref=/);
  await expect(page.getByText(/^Paid on .+\. Thank you\.$/)).toBeVisible();
  const [row] = await payRows(booking.id);
  expect(row).toMatchObject({ status: "paid", amount_cents: 45752 });
  expect(row.moneybird_registered_at).not.toBeNull();
  // Recorded on the Moneybird invoice once, with Mollie's id, and the invoice is settled
  const inv = invoices.get((await invoiceOf(booking.id))!.moneybird_id!)!;
  expect(inv.payments?.filter((p) => p.transaction_identifier === row.mollie_id)).toHaveLength(1);
  expect(inv.total_unpaid).toBe("0.00");
  // Mollie was asked with our row's id as the idempotency key, and nothing personal in the metadata
  const created = mollieCalls.find((c) => c.method === "POST" && c.path === "/payments" && (c.body as { metadata?: { requestId?: string } }).metadata?.requestId === booking.id)!;
  expect(created.key).toBe(row.id);
  expect(Object.keys((created.body as { metadata: object }).metadata)).toEqual(["requestId"]);

  // Paying again is not offered; the admin card shows it, and the booking cannot be deleted
  await page.reload();
  await expect(page.getByRole("button", { name: /^Pay / })).toHaveCount(0);
  await admin.goto(`/admin/requests/${booking.id}`);
  await expect(admin.getByText(t.title)).toBeVisible();
  await expect(admin.getByText(t.deleteBlocked).or(admin.getByText(en.admin.moneybird.deleteBlocked))).toBeVisible();
});

test("the webhook alone marks a payment paid, and an id that is not ours is ignored", async ({ browser, page, request }) => {
  const { booking } = await approved(browser);
  await page.goto(guestPage(booking));
  await payNow(page).click();
  await expect(page).toHaveURL(/\/checkout\/tr_/);
  const [row] = await payRows(booking.id);
  expect(row.status).toBe("open");
  // Paid at Mollie; the customer never comes back
  await fetch(`http://127.0.0.1:${MOLLIE}/__status/${row.mollie_id}/paid`, { method: "POST" });
  expect((await request.post("/api/mollie/webhook", { form: { id: "tr_notours123" } })).status()).toBe(200);
  expect((await request.post("/api/mollie/webhook", { form: { id: "not-an-id" } })).status()).toBe(200);
  expect((await request.post("/api/mollie/webhook", { form: { id: row.mollie_id! } })).status()).toBe(200);
  await expect.poll(async () => (await payRows(booking.id))[0].status, { timeout: 20_000 }).toBe("paid");
});

test("a failed payment can be tried again, and leaving the payment page open reuses the same payment", async ({ browser, page }) => {
  const { booking } = await approved(browser);
  await page.goto(guestPage(booking));
  await payNow(page).click();
  await atMollie(page, "Fail");
  await expect(page.getByText(g.payNotCompleted)).toBeVisible();

  // Opening the payment page twice without paying: one payment, the same one
  await payNow(page).click();
  await expect(page).toHaveURL(/\/checkout\/tr_/);
  const opened = page.url();
  await page.goto(guestPage(booking));
  await payNow(page).click();
  await expect(page).toHaveURL(opened);
  const rows = await payRows(booking.id);
  expect(rows.map((r) => r.status)).toEqual(["failed", "open"]);

  await atMollie(page, "Pay");
  await expect(page.getByText(/^Paid on /)).toBeVisible();
});

test("a partner pays from the portal; another partner cannot see the booking", async ({ browser, page, context }) => {
  const { email, contactId } = await signedInPartner(page, context, "pay-partner");
  const db = sql();
  try {
    await db`update corporate_contacts set billing_street = 'Herengracht 1', billing_postcode = '1015 BA', billing_city = 'Amsterdam' where id = ${contactId}`;
  } finally {
    await db.end();
  }
  const { booking } = await approved(browser, { contactId, email: email.replace("pay-partner-", "pay-") });
  await page.goto(`/en/corporate-partner/account/booking?ref=${booking.reference}`);
  await payNow(page).click();
  await atMollie(page, "Pay");
  await expect(page).toHaveURL(/corporate-partner\/account\/booking\?ref=EE-/);
  await expect(page.getByText(/^Paid on /)).toBeVisible();

  // Someone else's account: the booking does not exist for them
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signedInPartner(otherPage, other, "pay-other");
  await otherPage.goto(`/en/corporate-partner/account/booking?ref=${booking.reference}`);
  await expect(otherPage.getByText(en.portal.bookingNotFound)).toBeVisible();
  await other.close();
});

test("a paid booking that is cancelled is credited, then refunded through Mollie, and the credit is settled", async ({ browser, page }) => {
  const { admin, booking } = await approved(browser);
  await page.goto(guestPage(booking));
  await payNow(page).click();
  await atMollie(page, "Pay");
  await expect(page.getByText(/^Paid on /)).toBeVisible();

  await setStatus(admin, booking.id, "cancelled", false);
  await admin.goto(`/admin/requests/${booking.id}`);
  await admin.getByRole("button", { name: en.admin.moneybird.creditButton }).click();
  await expect.poll(async () => (await invoiceOf(booking.id, "credit"))?.number ?? null, { timeout: 20_000 }).not.toBeNull();

  await admin.reload();
  await expect(admin.getByLabel(/Amount to refund/)).toHaveValue("457,52");
  await admin.getByRole("button", { name: t.refundButton }).click();
  // Under way at Mollie: shown on the card (nothing is left to refund, so the form steps aside)
  await expect(admin.getByText(/^Refund €\s?457,52: pending$/)).toBeVisible();
  const refund = [...refunds.values()].at(-1)!;
  expect(refund.amount.value).toBe("457.52");

  // Mollie carries it out; checking again records it on the credit invoice, which is then settled
  await fetch(`http://127.0.0.1:${MOLLIE}/__refund/${refund.id}/refunded`, { method: "POST" });
  await admin.getByRole("button", { name: t.check }).click();
  await expect.poll(async () => (await payRows(booking.id))[0].refunded_cents, { timeout: 20_000 }).toBe(45752);
  const credit = invoices.get((await invoiceOf(booking.id, "credit"))!.moneybird_id!)!;
  await expect.poll(() => credit.payments?.some((p) => p.transaction_identifier === refund.id) ?? false, { timeout: 20_000 }).toBe(true);
  expect(credit.total_unpaid).toBe("0.00");
});

test("a payment still being processed is followed by the sweep until it is paid", async ({ browser, page, request }) => {
  const { booking } = await approved(browser);
  await page.goto(guestPage(booking));
  await payNow(page).click();
  await expect(page).toHaveURL(/\/checkout\/tr_/);
  const [row] = await payRows(booking.id);
  await fetch(`http://127.0.0.1:${MOLLIE}/__status/${row.mollie_id}/pending`, { method: "POST" });
  const sweep = () => request.post("/api/cron/payments", { headers: { Authorization: `Bearer ${CRON}` } });
  expect((await request.post("/api/cron/payments")).status()).toBe(401);
  expect((await sweep()).ok()).toBe(true);
  expect((await payRows(booking.id))[0].status).toBe("pending");
  await page.goto(guestPage(booking));
  await expect(page.getByText(g.payInProgress)).toBeVisible();

  await fetch(`http://127.0.0.1:${MOLLIE}/__status/${row.mollie_id}/paid`, { method: "POST" });
  expect((await sweep()).ok()).toBe(true);
  expect((await payRows(booking.id))[0].status).toBe("paid");
});
