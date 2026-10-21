import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { RETENTION, erasePartnerAccount, runRetention } from "../../lib/retention";
import { newEmail, ownAddress, sql } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";

// The retention rules of lib/retention.ts (what the privacy policy promises) and the admin's Delete button. These write
// rows straight into the database with old dates, and run the same function the scheduled job runs.
test.describe.configure({ mode: "serial" });

type Db = ReturnType<typeof sql>;

const ref = () => `EE-T${randomUUID().slice(0, 5).toUpperCase()}`;

/** A request whose every date (row, history, message) is `ago` old: Postgres interval text, e.g. "30 months". */
async function request(
  db: Db,
  o: { status?: string; ago?: string; pickup?: string; contactId?: string | null; invoice?: boolean; recentMessage?: boolean; entity?: string; notes?: string } = {},
) {
  const ago = o.ago ?? "0 days";
  const reference = ref();
  const [row] = await db`
    insert into quote_requests (reference, status, service, collection, destination, pickup_at, name, email, phone, entity, notes, ip_hash, corporate_contact_id, source, locale, created_at, updated_at)
    values (${reference}, ${o.status ?? "new"}, 'airport_transfer', 'Schiphol Airport', 'Hotel Des Indes', ${o.pickup ?? "2020-01-01 10:00"}::text::timestamp, 'Retention Test', ${newEmail("ret")}, '+31 6 1234 5678',
            ${o.entity ?? null}, ${o.notes ?? null}, ${o.notes ? "hash" : null}, ${o.contactId ?? null}, 'website', 'en', now() - ${ago}::interval, now() - ${ago}::interval)
    returning id`;
  await db`insert into request_events (request_id, event, created_at) values (${row.id}, 'received', now() - ${ago}::interval)`;
  let invoicePath: string | null = null;
  if (o.invoice) {
    invoicePath = `${randomUUID()}/invoice.pdf`;
    await db`insert into booking_invoices (request_id, path, file_name, size, created_at) values (${row.id}, ${invoicePath}, 'invoice.pdf', 1000, now() - ${ago}::interval)`;
  }
  if (o.recentMessage) await db`insert into booking_messages (request_id, author_kind, body) values (${row.id}, 'team', 'A recent reply')`;
  return { id: row.id as string, reference, invoicePath };
}

async function contact(
  db: Db,
  o: { account?: boolean; created?: string; lastLogin?: string | null; consent?: boolean } = {},
) {
  const created = o.created ?? "0 days";
  const [row] = await db`
    insert into corporate_contacts (email, email_domain, name, position, locale, password_hash, password_set_at, verified_at, last_login_at, marketing_consent, created_at, updated_at)
    values (${newEmail("ret-contact")}, 'e2e.ecramexecs.test', 'Retention Partner', 'Head of Travel', 'en',
            ${o.account === false ? null : "x"}, ${o.account === false ? null : db`now() - ${created}::interval`}, now() - ${created}::interval,
            ${o.lastLogin ? db`now() - ${o.lastLogin}::interval` : null}, ${o.consent ?? false}, now() - ${created}::interval, now() - ${created}::interval)
    returning id`;
  return row.id as string;
}

async function exists(db: Db, table: "quote_requests" | "corporate_contacts" | "driver_applications", id: string) {
  const rows = await db`select 1 from ${db(table)} where id = ${id}`;
  return rows.length > 0;
}

function files() {
  const removed: string[] = [];
  return { removed, removeFiles: async (paths: string[]) => void removed.push(...paths) };
}

test("requests are removed after 24 months, completed or invoiced ones after 7 years, and nothing upcoming or recently touched is", async () => {
  const db = sql();
  try {
    const old = await request(db, { ago: "30 months" });
    const young = await request(db, { ago: "10 months" });
    const completed = await request(db, { ago: "30 months", status: "completed" });
    const ancientCompleted = await request(db, { ago: "8 years", status: "completed" });
    const invoiced = await request(db, { ago: "30 months", status: "confirmed", invoice: true });
    const ancientInvoiced = await request(db, { ago: "8 years", status: "confirmed", invoice: true });
    const upcoming = await request(db, { ago: "30 months", pickup: "2099-01-01 10:00" });
    const touched = await request(db, { ago: "30 months", recentMessage: true });
    // Confirmed and driven but never marked completed, and no invoice uploaded: still a financial record
    const driven = await request(db, { ago: "30 months", status: "confirmed", notes: "Pick-up at gate 4" });
    // Seven years run to the end of the calendar year: one from December six years and ten months ago is not due yet,
    // one a year older is
    const notYetSeven = await request(db, { ago: "6 years 10 months", status: "completed" });
    const sevenAndMore = await request(db, { ago: "7 years 10 months", status: "completed" });

    // A dry run says what is due and deletes nothing
    const dry = files();
    const preview = await runRetention({ sql: db, apply: false, removeFiles: dry.removeFiles });
    expect(preview.requests).toEqual(expect.arrayContaining([old.reference, ancientCompleted.reference, ancientInvoiced.reference, sevenAndMore.reference]));
    for (const kept of [young, completed, invoiced, upcoming, touched, driven, notYetSeven]) expect(preview.requests).not.toContain(kept.reference);
    expect(await exists(db, "quote_requests", old.id)).toBe(true);
    expect(dry.removed).toEqual([]);

    const real = files();
    const report = await runRetention({ sql: db, apply: true, removeFiles: real.removeFiles });
    expect(report.requests).toEqual(expect.arrayContaining([old.reference, ancientCompleted.reference, ancientInvoiced.reference, sevenAndMore.reference]));
    for (const gone of [old, ancientCompleted, ancientInvoiced, sevenAndMore]) expect(await exists(db, "quote_requests", gone.id), gone.reference).toBe(false);
    for (const kept of [young, completed, invoiced, upcoming, touched, driven, notYetSeven]) expect(await exists(db, "quote_requests", kept.id), kept.reference).toBe(true);
    // A booking kept for the financial records loses its notes and technical data once the ordinary period has passed, and keeps the rest
    expect(report.scrubbed).toContain(driven.reference);
    const [stripped] = await db`select notes, ip_hash, collection, status from quote_requests where id = ${driven.id}`;
    expect(stripped).toMatchObject({ notes: null, ip_hash: null, collection: "Schiphol Airport", status: "confirmed" });
    // The invoice file of the one that went is removed, and only that one; its history went with it
    expect(real.removed).toEqual([ancientInvoiced.invoicePath]);
    expect(await db`select 1 from request_events where request_id = ${old.id}`).toHaveLength(0);
  } finally {
    await db.end();
  }
});

test("a rule stops at its cap and says so, so a wrong rule cannot empty a table in one run", async () => {
  const db = sql();
  try {
    const extra = RETENTION.maxPerRule + 5;
    await db`
      insert into quote_requests (reference, status, service, collection, destination, pickup_at, name, email, phone, source, locale, created_at, updated_at)
      select 'EE-C' || lpad(g::text, 5, '0'), 'new', 'airport_transfer', 'A', 'B', timestamp '2020-01-01 10:00', 'Cap Test', 'cap-' || g || '@e2e.ecramexecs.test', '+31 6 1234 5678', 'website', 'en',
             now() - interval '40 months', now() - interval '40 months'
      from generate_series(1, ${extra}) g`;
    const preview = await runRetention({ sql: db, apply: false, removeFiles: async () => {} });
    expect(preview.capped).toBe(true);
    expect(preview.requests.length).toBe(RETENTION.maxPerRule);
    await db`delete from quote_requests where reference like 'EE-C%'`;
  } finally {
    await db.end();
  }
});

test("driver applications that did not become a partnership are removed after 12 months with their documents; approved ones are not", async () => {
  const db = sql();
  try {
    const insert = async (status: string, ago: string, documents: string[] | null) => {
      const reference = ref();
      const [row] = await db`
        insert into driver_applications (reference, status, name, email, phone, kvk, experience_years, plate, documents, created_at, updated_at)
        values (${reference}, ${status}, 'Retention Driver', ${newEmail("ret-driver")}, '+31 6 0000 0000', '12345678', 3, 'AB123C',
                ${documents ? db.json(documents.map((path) => ({ name: "chauffeurCard", path, size: 10, contentType: "application/pdf" }))) : null}, now() - ${ago}::interval, now() - ${ago}::interval)
        returning id`;
      return { id: row.id as string, reference };
    };
    const path = () => `${randomUUID()}/chauffeurCard.pdf`;
    const rejectedPath = path();
    const rejected = await insert("rejected", "13 months", [rejectedPath]);
    const stale = await insert("new", "13 months", null);
    const approved = await insert("approved", "13 months", [path()]);
    const recent = await insert("reviewing", "2 months", [path()]);

    const real = files();
    const report = await runRetention({ sql: db, apply: true, removeFiles: real.removeFiles });
    expect(report.applications).toEqual(expect.arrayContaining([rejected.reference, stale.reference]));
    expect(report.applications).not.toContain(approved.reference);
    expect(await exists(db, "driver_applications", rejected.id)).toBe(false);
    expect(await exists(db, "driver_applications", stale.id)).toBe(false);
    expect(await exists(db, "driver_applications", approved.id)).toBe(true);
    expect(await exists(db, "driver_applications", recent.id)).toBe(true);
    expect(real.removed).toEqual([rejectedPath]);
  } finally {
    await db.end();
  }
});

test("an idle partner account is erased with its non-financial bookings; financial ones stay unlinked; active accounts and unfinished sign-ups follow their own rules", async () => {
  const db = sql();
  try {
    // Idle for 25 months, with a booking that is not a financial record and one that is
    const idle = await contact(db, { created: "30 months", lastLogin: "25 months" });
    const idleOpen = await request(db, { ago: "25 months", contactId: idle });
    const idleDone = await request(db, { ago: "25 months", contactId: idle, status: "completed", entity: "Orion Holdings B.V.", notes: "Please call the driver" });
    await db`insert into booking_messages (request_id, author_kind, contact_id, body, created_at) values (${idleDone.id}, 'partner', ${idle}, 'Thank you', now() - interval '25 months')`;
    // Old account but used last month: stays. Idle account whose booking the team worked on recently: stays
    const active = await contact(db, { created: "30 months", lastLogin: "1 month" });
    const busy = await contact(db, { created: "30 months", lastLogin: "25 months" });
    await request(db, { ago: "25 months", contactId: busy, recentMessage: true, pickup: "2099-01-01 10:00" });
    await db`update quote_requests set updated_at = now() where corporate_contact_id = ${busy}`;
    // Unfinished sign-ups
    const abandoned = await contact(db, { account: false, created: "40 days" });
    const fresh = await contact(db, { account: false, created: "10 days" });
    const consented = await contact(db, { account: false, created: "40 days", consent: true });
    const midway = await contact(db, { account: false, created: "40 days" });
    await db`insert into corporate_challenges (contact_id, code_hmac, purpose, expires_at) values (${midway}, 'x', 'signup', now() + interval '5 minutes')`;

    const report = await runRetention({ sql: db, apply: true, removeFiles: async () => {} });
    expect(report.accounts).toContain(idle);
    expect(report.signups).toContain(abandoned);

    expect(await exists(db, "corporate_contacts", idle)).toBe(false);
    expect(await exists(db, "quote_requests", idleOpen.id)).toBe(false);
    // The completed booking stays, without the account and without the messages about it
    const [kept] = await db`select corporate_contact_id, name, email, phone, notes, ip_hash, entity, collection from quote_requests where id = ${idleDone.id}`;
    expect(kept).toBeDefined();
    // Unlinked and stripped: the company, the journey and the invoices are what the record needs; the person is gone
    expect(kept).toMatchObject({ corporate_contact_id: null, name: "Orion Holdings B.V.", email: "erased@invalid", phone: "", notes: null, ip_hash: null, entity: "Orion Holdings B.V.", collection: "Schiphol Airport" });
    expect(await db`select 1 from booking_messages where request_id = ${idleDone.id}`).toHaveLength(0);
    expect(await db`select 1 from request_events where request_id = ${idleDone.id} and event = 'partner_erased'`).toHaveLength(1);

    for (const stays of [active, busy, fresh, consented, midway]) expect(await exists(db, "corporate_contacts", stays), stays).toBe(true);
    expect(await exists(db, "corporate_contacts", abandoned)).toBe(false);
  } finally {
    await db.end();
  }
});

test("an account with an open booking whose trip has not happened is not erased, by the job or by the admin", async () => {
  const db = sql();
  try {
    const holder = await contact(db, { created: "30 months", lastLogin: "25 months" });
    const trip = await request(db, { ago: "25 months", contactId: holder, status: "confirmed", pickup: "2099-01-01 10:00" });
    const report = await runRetention({ sql: db, apply: true, removeFiles: async () => {} });
    expect(report.blocked).toContain(holder);
    expect(report.accounts).not.toContain(holder);
    expect(await erasePartnerAccount(db, holder)).toEqual({ blocked: 1 });
    expect(await exists(db, "corporate_contacts", holder)).toBe(true);
    expect(await exists(db, "quote_requests", trip.id)).toBe(true);
    // Once it is cancelled the account can go
    await db`update quote_requests set status = 'cancelled' where id = ${trip.id}`;
    expect(await erasePartnerAccount(db, holder)).toEqual({ deleted: 1, kept: [] });
  } finally {
    await db.end();
  }
});

test("the job's own erasure leaves an account alone if its owner has signed in since it was picked", async () => {
  const db = sql();
  try {
    const returning = await contact(db, { created: "30 months", lastLogin: "1 day" });
    expect(await erasePartnerAccount(db, returning, { onlyIfInactive: true })).toBeNull();
    expect(await exists(db, "corporate_contacts", returning)).toBe(true);
    // The admin's Delete has no such condition
    expect(await erasePartnerAccount(db, returning)).toEqual({ deleted: 0, kept: [] });
    expect(await exists(db, "corporate_contacts", returning)).toBe(false);
    expect(await erasePartnerAccount(db, returning)).toBeNull(); // a second click finds nothing
  } finally {
    await db.end();
  }
});

test("the admin's Delete button on the Corporate page says what happens to the bookings, then deletes the account", async ({ page, context }) => {
  test.slow();
  await ownAddress(context);
  const db = sql();
  try {
    const id = await contact(db, { created: "2 months", lastLogin: "1 day" });
    await db`update corporate_contacts set name = 'Delete Me Partner' where id = ${id}`;
    const open = await request(db, { ago: "1 month", contactId: id, status: "cancelled" });
    const done = await request(db, { ago: "1 month", contactId: id, status: "completed" });
    const holder = await contact(db, { created: "2 months", lastLogin: "1 day" });
    await db`update corporate_contacts set name = 'Has Upcoming Trip' where id = ${holder}`;
    await request(db, { ago: "1 month", contactId: holder, status: "confirmed", pickup: "2099-01-01 10:00" });

    await page.goto("/admin/login");
    await fillAdminLogin(page);
    await page.waitForURL((url) => !url.pathname.endsWith("/login"));
    await page.goto("/admin/corporate");

    const c = en.admin.corporate;
    const dialog = page.getByRole("dialog", { name: c.deleteTitle });
    const open_ = (name: string) => page.getByRole("button", { name: `${c.delete}: ${name}` });

    // The dialog says what will happen to the bookings
    await open_("Delete Me Partner").click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(c.deleteIntro.replace("{name}", "Delete Me Partner"));
    await expect(dialog).toContainText(c.deleteGone.replace("{count}", "1"));
    await expect(dialog).toContainText(c.deleteKept.replace("{count}", "1"));
    // Cancel changes nothing
    await dialog.getByRole("button", { name: c.deleteCancel }).click();
    await expect(dialog).toBeHidden();
    expect(await exists(db, "corporate_contacts", id)).toBe(true);

    // An account that still has an open trip ahead cannot be deleted: the dialog says so and offers no way to confirm
    await open_("Has Upcoming Trip").click();
    await expect(dialog).toContainText(c.deleteBlocked.replace("{count}", "1"));
    await expect(dialog.getByRole("button", { name: c.deleteConfirm })).toHaveCount(0);
    await dialog.getByRole("button", { name: c.deleteCancel }).click();
    await expect(dialog).toBeHidden();

    await open_("Delete Me Partner").click();
    await dialog.getByRole("button", { name: c.deleteConfirm }).click();
    await expect(open_("Delete Me Partner")).toHaveCount(0);

    expect(await exists(db, "corporate_contacts", id)).toBe(false);
    expect(await exists(db, "quote_requests", open.id)).toBe(false);
    const [kept] = await db`select corporate_contact_id from quote_requests where id = ${done.id}`;
    expect(kept.corporate_contact_id).toBeNull();
  } finally {
    await db.end();
  }
});
