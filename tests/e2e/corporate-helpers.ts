import { createHmac, randomInt, randomUUID } from "node:crypto";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import postgres from "postgres";
import { hashPassword } from "../../lib/auth/password";
import en from "../../lib/i18n/dictionaries/en.json";

/**
 * Shared by the Corporate Partner and portal specs. The emailed code can't be read in tests (no mail provider runs),
 * and production code must not grow a test-only backdoor — `next start` has NODE_ENV=production here, so a NODE_ENV
 * guard would ship. Instead tests write challenge and account rows themselves, using the same secret, HMAC and password
 * hash the server uses, and the server treats them exactly as it would real ones.
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
export const SECRET = process.env.CORPORATE_OTP_SECRET ?? "";
export const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const hmac = (id: string, code: string) => createHmac("sha256", SECRET).update(`${id}:${code}`).digest("hex");

export const PASSWORD = "correct horse battery staple";
export const NEW_PASSWORD = "another long passphrase here";
export const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
export const t = en.corporatePartner;

/** Sign-in attempts are limited per visitor address, so each test presents its own. */
export const ownAddress = (context: BrowserContext) =>
  context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}` });

export const newEmail = (label: string) => `${label}-${Date.now()}-${randomInt(1000)}@e2e.ecramexecs.test`;

/** A contact, optionally with an account (a password already chosen). Returns its id. */
export async function seedContact(email: string, password?: string, name = "Anouk Jansen", company: string | null = null) {
  const db = sql();
  try {
    const hash = password ? await hashPassword(password) : null;
    const [contact] = await db`
      insert into corporate_contacts (email, email_domain, name, position, locale, password_hash, password_set_at, verified_at, company_name)
      values (${email}, 'e2e.ecramexecs.test', ${name}, 'Head of Travel', 'en', ${hash}, ${hash ? new Date() : null}, ${hash ? new Date() : null}, ${company})
      on conflict (email) do update set name = excluded.name returning id`;
    return contact.id as string;
  } finally {
    await db.end();
  }
}

export async function seedChallenge(email: string, code: string, opts: { purpose?: "signup" | "reset"; expired?: boolean; password?: string } = {}) {
  const contactId = await seedContact(email, opts.password);
  const db = sql();
  try {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + (opts.expired ? -60_000 : 10 * 60_000));
    await db`insert into corporate_challenges (id, contact_id, code_hmac, purpose, pending_name, pending_position, expires_at)
             values (${id}, ${contactId}, ${hmac(id, code)}, ${opts.purpose ?? "signup"}, 'Anouk Jansen', 'Head of Travel', ${expiresAt})`;
    return id;
  } finally {
    await db.end();
  }
}

export const holdChallenge = (context: BrowserContext, id: string) => context.addCookies([{ name: "ee_cp_challenge", value: id, url: ORIGIN }]);

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeRef = () => `EE-${Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("")}`;

type BookingSeed = {
  contactId: string | null;
  email: string;
  status?: "new" | "contacted" | "quoted" | "confirmed" | "completed" | "cancelled";
  quotedAmount?: string | null;
  pickupAt?: string;
  collection?: string;
  destination?: string;
  stops?: string[];
  source?: string;
  locale?: "en" | "nl";
};

/**
 * A request, linked to the partner, with its "received" event. Returns its id and reference. The pick-up goes in as text
 * and is cast in the database: this driver would otherwise read a bare date string in the test machine's own time zone.
 */
export async function seedBooking(seed: BookingSeed) {
  const db = sql();
  try {
    const reference = makeRef();
    const [row] = await db`
      insert into quote_requests (reference, status, service, collection, destination, destinations, pickup_at, name, email, phone, quoted_amount, corporate_contact_id, source, locale, notes)
      values (${reference}, ${seed.status ?? "new"}, 'airport_transfer', ${seed.collection ?? "Schiphol Airport"}, ${seed.destination ?? "Hotel Des Indes, The Hague"},
              ${seed.stops ? db.array(seed.stops) : null}, ${seed.pickupAt ?? "2031-03-14T08:30"}::text::timestamp, 'Anouk Jansen', ${seed.email}, '+31 6 1234 5678',
              ${seed.quotedAmount ?? null}, ${seed.contactId}, ${seed.source ?? "website"}, ${seed.locale ?? "en"}, 'Flight KL1234')
      returning id`;
    await db`insert into request_events (request_id, event) values (${row.id}, 'received')`;
    return { id: row.id as string, reference };
  } finally {
    await db.end();
  }
}

export async function bookingRow(reference: string) {
  const db = sql();
  try {
    const [row] = await db`select id, status, quoted_amount, corporate_contact_id, source from quote_requests where reference = ${reference}`;
    return row as { id: string; status: string; quoted_amount: string | null; corporate_contact_id: string | null; source: string } | undefined;
  } finally {
    await db.end();
  }
}

/** Submits whichever form is on screen and waits for the server's answer before the test looks at it. */
export async function submit(page: Page, button: string) {
  const answered = page.waitForResponse((r) => r.request().method() === "POST");
  await page.getByRole("button", { name: button, exact: true }).click();
  await answered;
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto("/en/corporate-partner/login");
  await page.fill("#c-email", email);
  await page.fill("#c-password", password);
  await submit(page, t.loginCta);
}

/** A partner with an account, signed in on this page, ready to use the portal. Returns the account's email and id. */
export async function signedInPartner(page: Page, context: BrowserContext, label = "partner", name = "Anouk Jansen", company: string | null = "Orion Holdings B.V.") {
  await ownAddress(context);
  const email = newEmail(label);
  const contactId = await seedContact(email, PASSWORD, name, company);
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);
  return { email, contactId };
}
