import { createServer, type IncomingMessage, type Server } from "node:http";
import { expect, test, type Browser, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { guestKey } from "../../lib/quotes/guest-link";
import { newEmail, seedContact, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";

/**
 * Approved bookings become Moneybird invoices (lib/moneybird), checked against a stand-in for Moneybird's API that this
 * file starts. The server under test must be pointed at it, so these only run when asked to:
 *
 *   MONEYBIRD_TOKEN=test MONEYBIRD_ADMINISTRATION_ID=123 MONEYBIRD_LEDGER_RIDES=L-RIDES MONEYBIRD_LEDGER_EXTRAS=L-EXTRAS \
 *   MONEYBIRD_API_URL=http://127.0.0.1:4597 CRON_SECRET=e2e-cron-secret-0123456789 E2E_FAKE_MONEYBIRD=4597 \
 *   npx playwright test moneybird
 *
 * Run it on its own: with Moneybird switched on, other specs' confirmed bookings would be invoiced too.
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const PORT = Number(process.env.E2E_FAKE_MONEYBIRD ?? 0);
test.skip(!PORT, "Set E2E_FAKE_MONEYBIRD (and the Moneybird variables, see the top of this file) to run the Moneybird tests");
test.describe.configure({ mode: "serial" });
// Several pages, the admin's sign-in and Moneybird's round trips per test, over the e2e database's tunnel
test.slow();
const t = en.admin.moneybird;
const CRON = process.env.CRON_SECRET ?? "";

// ---------------------------------------------------------------------------------------------------------------------
// The stand-in: just enough of Moneybird's API v2, kept in memory.
type Detail = { id: string; description: string; price: string; amount: string; tax_rate_id: string; ledger_account_id: string };
type Invoice = {
  id: string;
  contact_id: string;
  reference: string;
  state: string;
  invoice_id: string | null;
  prices_are_incl_tax: boolean;
  first_due_interval: number;
  details: Detail[];
  total_price_incl_tax: string;
  total_unpaid: string;
  url: string | null;
  payment_url: string | null;
  sent_at: string | null;
  original_sales_invoice_id: string | null;
  delivery?: string;
  email_address?: string;
};
type Contact = Record<string, unknown> & { id: string; customer_id: string };
const invoices = new Map<string, Invoice>();
const contacts = new Map<string, Contact>();
const calls: { method: string; path: string; body: unknown }[] = [];
let nextId = 1000;
let numbers = 0;
let failures = 0;
let server: Server;

const bodyOf = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
const money = (cents: number) => (cents / 100).toFixed(2);
const centsOfDetails = (details: Detail[]) => details.reduce((sum, d) => sum + Math.round(Number(d.price) * 100) * Number(d.amount), 0);
const recount = (inv: Invoice) => {
  const total = centsOfDetails(inv.details);
  inv.total_price_incl_tax = money(total);
  if (inv.state === "draft") inv.total_unpaid = money(total);
};

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://fake");
    const raw = await bodyOf(req);
    const body = raw ? JSON.parse(raw) : null;
    const send = (status: number, value?: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(value === undefined ? "" : JSON.stringify(value));
    // Test controls
    if (url.pathname === "/__fail") return ((failures = Number(url.searchParams.get("n") ?? 1)), send(200, {}));
    const pay = url.pathname.match(/^\/__pay\/(\d+)$/);
    if (pay) {
      const inv = invoices.get(pay[1]);
      if (inv) Object.assign(inv, { state: "paid", total_unpaid: "0.0" });
      return send(200, {});
    }
    if (req.headers.authorization !== "Bearer test") return send(401, { error: "Token is invalid" });
    const path = url.pathname.replace(/^\/123\//, "");
    calls.push({ method: req.method ?? "", path, body });
    if (failures > 0) {
      failures--;
      return send(503, { error: "Service unavailable" });
    }
    let m: RegExpMatchArray | null;
    if (req.method === "GET" && path === "tax_rates.json")
      return send(200, [
        { id: "900000000000000009", percentage: "9.0", tax_rate_type: "sales_invoice", active: true, country: null },
        { id: "900000000000000021", percentage: "21.0", tax_rate_type: "sales_invoice", active: true, country: null },
        { id: "900000000000000099", percentage: "21.0", tax_rate_type: "sales_invoice", active: true, country: "DE" },
      ]);
    if (req.method === "GET" && (m = path.match(/^contacts\/customer_id\/(.+)\.json$/))) {
      const found = [...contacts.values()].find((c) => c.customer_id === decodeURIComponent(m![1]));
      return found ? send(200, found) : send(404, { error: "record not found" });
    }
    if (req.method === "POST" && path === "contacts.json") {
      const contact = { ...body.contact, id: String(nextId++) } as Contact;
      contacts.set(contact.id, contact);
      return send(201, contact);
    }
    if (req.method === "PATCH" && (m = path.match(/^contacts\/(\d+)\.json$/))) {
      const contact = contacts.get(m[1]);
      if (!contact) return send(404, { error: "record not found" });
      Object.assign(contact, body.contact);
      return send(200, contact);
    }
    if (req.method === "GET" && (m = path.match(/^sales_invoices\/find_by_reference\/(.+)\.json$/))) {
      const found = [...invoices.values()].find((inv) => inv.reference === decodeURIComponent(m![1]) && !inv.original_sales_invoice_id);
      return found ? send(200, found) : send(404, { error: "record not found" });
    }
    if (req.method === "POST" && path === "sales_invoices.json") {
      const s = body.sales_invoice;
      const inv: Invoice = {
        id: String(nextId++),
        contact_id: s.contact_id,
        reference: s.reference,
        state: "draft",
        invoice_id: null,
        prices_are_incl_tax: s.prices_are_incl_tax,
        first_due_interval: s.first_due_interval,
        details: s.details_attributes.map((d: Omit<Detail, "id">) => ({ ...d, id: String(nextId++) })),
        total_price_incl_tax: "0",
        total_unpaid: "0",
        url: null,
        payment_url: null,
        sent_at: null,
        original_sales_invoice_id: null,
      };
      recount(inv);
      invoices.set(inv.id, inv);
      return send(201, inv);
    }
    if ((m = path.match(/^sales_invoices\/(\d+)\.json$/))) {
      const inv = invoices.get(m[1]);
      if (!inv) return send(404, { error: "record not found" });
      if (req.method === "GET") return send(200, inv);
      if (req.method === "DELETE") return (invoices.delete(inv.id), send(204));
      if (req.method === "PATCH") {
        for (const d of body.sales_invoice.details_attributes ?? []) {
          if (d._destroy) inv.details = inv.details.filter((x) => x.id !== d.id);
          else inv.details.push({ ...d, id: String(nextId++) });
        }
        recount(inv);
        return send(200, inv);
      }
    }
    if (req.method === "PATCH" && (m = path.match(/^sales_invoices\/(\d+)\/send_invoice\.json$/))) {
      const inv = invoices.get(m[1]);
      if (!inv) return send(404, { error: "record not found" });
      const sending = body.sales_invoice_sending;
      Object.assign(inv, {
        state: "open",
        invoice_id: `2026-${String(++numbers).padStart(4, "0")}`,
        sent_at: new Date().toISOString(),
        url: `http://127.0.0.1:${PORT}/external/${inv.id}`,
        payment_url: `http://127.0.0.1:${PORT}/pay/${inv.id}`,
        delivery: sending.delivery_method,
        email_address: sending.email_address,
      });
      return send(200, inv);
    }
    if (req.method === "PATCH" && (m = path.match(/^sales_invoices\/(\d+)\/duplicate_creditinvoice\.json$/))) {
      const original = invoices.get(m[1]);
      if (!original) return send(404, { error: "record not found" });
      const credit: Invoice = {
        ...original,
        id: String(nextId++),
        state: "draft",
        invoice_id: null,
        sent_at: null,
        url: null,
        payment_url: null,
        original_sales_invoice_id: original.id,
        details: original.details.map((d) => ({ ...d, id: String(nextId++), price: (-Number(d.price)).toFixed(2) })),
      };
      recount(credit);
      invoices.set(credit.id, credit);
      return send(200, credit);
    }
    if (req.method === "PATCH" && (m = path.match(/^sales_invoices\/(\d+)\/register_payment_creditinvoice\.json$/))) {
      const credit = invoices.get(m[1]);
      const original = credit?.original_sales_invoice_id ? invoices.get(credit.original_sales_invoice_id) : null;
      if (!credit || !original) return send(422, { error: "not a credit invoice" });
      const back = -Math.round(Number(credit.total_price_incl_tax) * 100);
      const left = Math.round(Number(original.total_unpaid) * 100) - back;
      Object.assign(original, { total_unpaid: money(left), state: left === 0 ? "paid" : original.state });
      Object.assign(credit, { total_unpaid: "0.0", state: "paid" });
      return send(200, credit);
    }
    send(404, { error: `no fake for ${req.method} ${path}` });
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
});

// ---------------------------------------------------------------------------------------------------------------------
// The bookings: the client's example (a 2-hour Audi with all four add-ons, €457.52).
const PRICE = {
  version: "2027-01",
  segment: "public",
  exact: true,
  legs: [{ leg: "outward", at: "2031-03-14T08:30", day: "weekday", hours: 2, lines: [{ key: "audi", count: 1, rate: 9500, amount: 19000 }] }],
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
    // Each on its own day: the same car at the same time would be refused on approval (the fleet clash check)
    const pickup = `2031-03-${String(1 + (seeded++ % 28)).padStart(2, "0")}T08:30`;
    const email = opts.email ?? newEmail("mb");
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

type Row = { kind: string; number: string | null; state: string; last_error: string | null; total_cents: number | null; unpaid_cents: number | null; fee_cents: number | null; delivery: string | null; moneybird_id: string | null };
async function rows(requestId: string): Promise<Row[]> {
  const db = sql();
  try {
    return (await db`select kind, number, state, last_error, total_cents, unpaid_cents, fee_cents, delivery, moneybird_id from moneybird_invoices where request_id = ${requestId} order by created_at`) as unknown as Row[];
  } finally {
    await db.end();
  }
}
const invoiceRow = async (id: string) => (await rows(id)).find((r) => r.kind === "invoice");

async function clean() {
  const db = sql();
  try {
    await db`delete from moneybird_invoices where request_id in (select id from quote_requests where email like 'mb-%@e2e.ecramexecs.test') or request_id is null`;
    await db`delete from quote_requests where email like 'mb-%@e2e.ecramexecs.test'`;
    await db`delete from corporate_contacts where email like 'mb-partner-%@e2e.ecramexecs.test'`;
    await db`delete from app_settings where key = 'moneybird_since'`;
  } finally {
    await db.end();
  }
}
test.beforeAll(clean);
test.afterAll(async () => {
  await clean();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
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

// ---------------------------------------------------------------------------------------------------------------------
test("approving a website booking makes, checks and emails its Moneybird invoice", async ({ browser, page }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  expect((await setStatus(admin, booking.id, "confirmed")).ok()).toBe(true);

  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).toMatch(/^2026-\d{4}$/);
  const row = (await invoiceRow(booking.id))!;
  expect(row).toMatchObject({ state: "open", total_cents: 45752, unpaid_cents: 45752, delivery: "Email", last_error: null });

  const inv = invoices.get(row.moneybird_id!)!;
  expect(inv.reference).toBe(booking.reference);
  expect(inv.prices_are_incl_tax).toBe(true);
  expect(inv.delivery).toBe("Email");
  expect(inv.email_address).toBe(booking.email);
  // Each line is its part plus its own VAT, at its own rate, on the right ledger account
  expect(inv.details.map((d) => [d.price, d.tax_rate_id, d.ledger_account_id])).toEqual([
    ["207.10", "900000000000000009", "L-RIDES"],
    ["94.38", "900000000000000021", "L-EXTRAS"],
    ["50.82", "900000000000000021", "L-EXTRAS"],
    ["71.94", "900000000000000009", "L-EXTRAS"],
    ["18.15", "900000000000000021", "L-EXTRAS"],
    ["15.13", "900000000000000021", "L-EXTRAS"],
  ]);
  expect(inv.details[0].description).toContain(booking.reference);
  expect(inv.details[0].description).toContain("Audi e-tron GT");
  // The guest is a Moneybird contact with their own email
  const contact = contacts.get(inv.contact_id)!;
  expect(contact).toMatchObject({ lastname: "Jansen", firstname: "Anouk", send_invoices_to_email: booking.email });
  expect(String(contact.customer_id)).toMatch(/^G-[0-9a-f]{10}$/);

  // The admin sees it; the booking can no longer be deleted, nor go back to being an open request
  await admin.goto(`/admin/requests/${booking.id}`);
  await expect(admin.getByText(`Invoice ${row.number}`, { exact: true })).toBeVisible();
  await expect(admin.getByText(t.deleteBlocked)).toBeVisible();
  const back = await setStatus(admin, booking.id, "new");
  expect(back.status()).toBe(409);

  // The guest's own page offers it, to view and pay
  await page.goto(`/en/booking?ref=${booking.reference}&k=${guestKey(booking.id)}`);
  await expect(page.getByText(`Invoice ${row.number} has been emailed to you.`)).toBeVisible();
  await expect(page.getByRole("link", { name: en.guestBooking.invoicePay })).toHaveAttribute("href", inv.payment_url!);

  // A second approval (a resent email) does not make a second invoice
  expect((await setStatus(admin, booking.id, "confirmed")).ok()).toBe(true);
  await admin.waitForTimeout(1500);
  expect((await rows(booking.id)).length).toBe(1);
});

test("approving without telling the customer numbers the invoice without emailing it", async ({ browser }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  expect((await setStatus(admin, booking.id, "confirmed", false)).ok()).toBe(true);
  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  const row = (await invoiceRow(booking.id))!;
  expect(row.delivery).toBe("Manual");
  expect(invoices.get(row.moneybird_id!)!.delivery).toBe("Manual");
});

test("a partner booking waits for the billing address, then is invoiced to the company", async ({ browser }) => {
  const admin = await signIn(browser);
  const partnerEmail = `mb-partner-${Date.now()}@e2e.ecramexecs.test`;
  const contactId = await seedContact(partnerEmail, undefined, "Anouk Jansen", "Orion Holdings B.V.");
  const booking = await seed({ contactId, email: partnerEmail.replace("mb-partner-", "mb-") });
  expect((await setStatus(admin, booking.id, "confirmed")).ok()).toBe(true);
  await expect.poll(async () => (await invoiceRow(booking.id))?.last_error ?? null, { timeout: 20_000 }).toBe("billing_missing");

  await admin.goto(`/admin/requests/${booking.id}`);
  await expect(admin.getByText(t.billingMissing)).toBeVisible();
  await admin.getByRole("link", { name: t.billingLink }).click();
  await admin.getByLabel(t.billingStreet).fill("Herengracht 1");
  await admin.getByLabel(t.billingPostcode).fill("1015 ba");
  await admin.getByLabel(t.billingCity).fill("Amsterdam");
  await admin.getByLabel(t.billingVat).fill("NL 0012.34567.B01");
  await admin.getByRole("button", { name: t.billingSave }).click();
  await expect(admin.getByText(t.billingSaved)).toBeVisible();

  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  const inv = invoices.get((await invoiceRow(booking.id))!.moneybird_id!)!;
  const company = contacts.get(inv.contact_id)!;
  expect(company).toMatchObject({ company_name: "Orion Holdings B.V.", address1: "Herengracht 1", zipcode: "1015 BA", city: "Amsterdam", tax_number: "NL001234567B01", send_invoices_to_email: partnerEmail });
  expect(String(company.customer_id)).toMatch(/^P-/);
  expect(inv.first_due_interval).toBe(30);
});

test("cancelling waits for the team's choice, then credits all but the cancellation fee", async ({ browser }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  await setStatus(admin, booking.id, "confirmed");
  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();

  expect((await setStatus(admin, booking.id, "cancelled", false)).ok()).toBe(true);
  await admin.waitForTimeout(1500);
  // Nothing is credited until the team chooses
  expect((await rows(booking.id)).filter((r) => r.kind === "credit")).toHaveLength(0);

  await admin.goto(`/admin/requests/${booking.id}`);
  await admin.getByLabel(t.creditFee).check();
  await admin.getByLabel(t.feeLabel).fill("50,00");
  await admin.getByRole("button", { name: t.creditButton }).click();

  await expect.poll(async () => (await rows(booking.id)).find((r) => r.kind === "credit")?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  const all = await rows(booking.id);
  const credit = all.find((r) => r.kind === "credit")!;
  const original = all.find((r) => r.kind === "invoice")!;
  expect(credit).toMatchObject({ total_cents: -40752, fee_cents: 5000, last_error: null });
  // Settled against the invoice: what is left open is the fee
  expect(original.unpaid_cents).toBe(5000);
  expect(calls.some((c) => c.path === `sales_invoices/${credit.moneybird_id}/register_payment_creditinvoice.json`)).toBe(true);
  // The credit's VAT follows what is given back: each rate's share less its part of the fee
  const cr = invoices.get(credit.moneybird_id!)!;
  expect(centsOfDetails(cr.details)).toBe(-40752);
  expect(new Set(cr.details.map((d) => d.tax_rate_id))).toEqual(new Set(["900000000000000009", "900000000000000021"]));
  await admin.reload();
  await expect(admin.getByText(`Credit invoice ${credit.number}`, { exact: true })).toBeVisible();
});

test("a Moneybird outage is kept on the booking and the team can try again", async ({ browser }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  await fetch(`http://127.0.0.1:${PORT}/__fail?n=6`, { method: "POST" });
  await setStatus(admin, booking.id, "confirmed");
  await expect.poll(async () => (await invoiceRow(booking.id))?.last_error ?? null, { timeout: 20_000 }).toContain("Moneybird 503");
  await admin.goto(`/admin/requests/${booking.id}`);
  await expect(admin.getByText(/Moneybird: Moneybird 503/)).toBeVisible();
  await fetch(`http://127.0.0.1:${PORT}/__fail?n=0`, { method: "POST" });
  await admin.getByRole("button", { name: t.retry }).click();
  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  // Only one invoice was made in Moneybird for it
  expect([...invoices.values()].filter((inv) => inv.reference === booking.reference)).toHaveLength(1);
});

test("the cron sweep reads a payment back, and refuses a call without the secret", async ({ browser, request }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  await setStatus(admin, booking.id, "confirmed");
  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  const row = (await invoiceRow(booking.id))!;
  await fetch(`http://127.0.0.1:${PORT}/__pay/${row.moneybird_id}`, { method: "POST" });

  expect((await request.post("/api/cron/moneybird")).status()).toBe(401);
  const swept = await request.post("/api/cron/moneybird", { headers: { Authorization: `Bearer ${CRON}` } });
  expect(swept.ok()).toBe(true);
  await expect.poll(async () => (await invoiceRow(booking.id))?.state, { timeout: 20_000 }).toBe("paid");
  // A paid invoice no longer stops the booking being deleted
  await admin.goto(`/admin/requests/${booking.id}`);
  await expect(admin.getByText(t.deleteBlocked)).toHaveCount(0);
});

test("a booking approved before Moneybird went live is only invoiced when the team asks", async ({ browser }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  const db = sql();
  try {
    // Made and confirmed two days ago, long before this file's first Moneybird call
    await db`update quote_requests set status = 'confirmed', created_at = now() - interval '2 days' where id = ${booking.id}`;
    await db`update request_events set created_at = now() - interval '2 days' where request_id = ${booking.id}`;
  } finally {
    await db.end();
  }
  // Saving it again (a resent email) does not invoice it
  expect((await setStatus(admin, booking.id, "confirmed")).ok()).toBe(true);
  await admin.waitForTimeout(1500);
  expect(await rows(booking.id)).toHaveLength(0);

  await admin.goto(`/admin/requests/${booking.id}`);
  await expect(admin.getByText(t.notAutomatic)).toBeVisible();
  await admin.getByRole("button", { name: t.makeInvoice }).click();
  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
});

test("a paid invoice credited in full says a refund is owed, and a new approval invoices again", async ({ browser }) => {
  const admin = await signIn(browser);
  const booking = await seed();
  await setStatus(admin, booking.id, "confirmed");
  await expect.poll(async () => (await invoiceRow(booking.id))?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  const first = (await invoiceRow(booking.id))!;
  await fetch(`http://127.0.0.1:${PORT}/__pay/${first.moneybird_id}`, { method: "POST" });
  await admin.request.post("/api/cron/moneybird", { headers: { Authorization: `Bearer ${CRON}` } });
  await expect.poll(async () => (await invoiceRow(booking.id))?.state, { timeout: 20_000 }).toBe("paid");

  await setStatus(admin, booking.id, "cancelled", false);
  await admin.goto(`/admin/requests/${booking.id}`);
  await admin.getByRole("button", { name: t.creditButton }).click();
  await expect.poll(async () => (await rows(booking.id)).find((r) => r.kind === "credit")?.number ?? null, { timeout: 20_000 }).not.toBeNull();
  const credit = (await rows(booking.id)).find((r) => r.kind === "credit")!;
  expect(credit.total_cents).toBe(-45752);
  // Paid: nothing to settle against, the money goes back by hand
  expect(calls.some((c) => c.path === `sales_invoices/${credit.moneybird_id}/register_payment_creditinvoice.json`)).toBe(false);
  await admin.reload();
  await expect(admin.getByText(/Refund €\s?457[.,]52 to the customer by hand/)).toBeVisible();

  // Approved again: a new invoice, with its own reference
  expect((await setStatus(admin, booking.id, "confirmed")).ok()).toBe(true);
  await expect.poll(async () => (await rows(booking.id)).filter((r) => r.kind === "invoice" && r.number).length, { timeout: 20_000 }).toBe(2);
  const second = (await rows(booking.id)).filter((r) => r.kind === "invoice").at(-1)!;
  expect(invoices.get(second.moneybird_id!)!.reference).toBe(`${booking.reference}-R2`);
});
