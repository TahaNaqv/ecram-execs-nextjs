// Development-only cleanup of test bookings and corporate accounts.
//
//   npm run db:reset-dev
//   ALLOW_DEV_RESET=1 npm run db:reset-dev -- --apply --confirm=RESET-DEV-DATA
//   ALLOW_DEV_RESET=1 npm run db:reset-dev -- --all --apply --confirm=RESET-DEV-DATA
//
// The default scope is tagged test data only: demo bookings (source = 'demo'), and bookings
// or corporate accounts whose email is on a reserved test domain (@e2e.ecramexecs.test,
// @example.com, @example.org, @example.net). Bookings that belong to one of those accounts
// are included. --all widens that to every booking and every corporate account.
//
// Nothing is written unless --apply and --confirm=RESET-DEV-DATA are both present and
// ALLOW_DEV_RESET=1 is set for that command. NODE_ENV=production and a host or database
// name that looks like production are refused. Admin users, drivers, vehicles, and
// concierge chats that never became a booking are left in place.
//
// Uses DATABASE_URL only. DATABASE_URL_DIRECT is ignored so a remote direct URL cannot
// override the database this app is actually pointed at.
import { count, eq, inArray, or, sql, type AnyColumn } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import postgres from "postgres";

const quoteRequests = pgTable("quote_requests", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  source: text("source").notNull(),
  corporateContactId: uuid("corporate_contact_id"),
});
const requestEvents = pgTable("request_events", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id").notNull(),
});
const bookingMessages = pgTable("booking_messages", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id").notNull(),
});
const bookingInvoices = pgTable("booking_invoices", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id").notNull(),
});
const corporateContacts = pgTable("corporate_contacts", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
});
const corporateChallenges = pgTable("corporate_challenges", {
  id: uuid("id").primaryKey(),
  contactId: uuid("contact_id").notNull(),
});
const corporateAccess = pgTable("corporate_access", {
  id: text("id").primaryKey(),
  contactId: uuid("contact_id").notNull(),
});
const conciergeConversations = pgTable("concierge_conversations", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id"),
});
const conciergeMessages = pgTable("concierge_messages", {
  id: uuid("id").primaryKey(),
  conversationId: uuid("conversation_id").notNull(),
});

const CONFIRM = "--confirm=RESET-DEV-DATA";
const TEST_EMAIL = String.raw`@(e2e\.ecramexecs\.test|example\.(com|org|net))$`;
const PRODUCTION_WORD = /(^|[^a-z])(prod|production|live)([^a-z]|$)/;

const apply = process.argv.includes("--apply");
const all = process.argv.includes("--all");
const confirmed = process.argv.includes(CONFIRM);

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL is not set. Run via npm run db:reset-dev so .env.local is loaded.");
  process.exit(1);
}

let target: URL;
try {
  target = new URL(rawUrl);
} catch {
  console.error("DATABASE_URL is not a valid database URL. The value was not printed.");
  process.exit(1);
}

const host = target.hostname.toLowerCase();
const database = target.pathname.replace(/^\//, "").toLowerCase();
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to run: NODE_ENV is production.");
  process.exit(1);
}
if (PRODUCTION_WORD.test(host) || PRODUCTION_WORD.test(database)) {
  console.error("Refusing to run: the database host or name looks like production.");
  process.exit(1);
}
if (apply && (!confirmed || process.env.ALLOW_DEV_RESET !== "1")) {
  console.error("Refusing to write. A cleanup needs all of:");
  console.error("  ALLOW_DEV_RESET=1");
  console.error("  --apply");
  console.error(`  ${CONFIRM}`);
  process.exit(1);
}

console.log(`Target: ${host}/${database || "(default)"}  ${isLocal ? "(local)" : "*** NOT LOCAL ***"}`);
console.log(all ? "Scope:  every booking and every corporate account" : "Scope:  demo rows and reserved test-email domains");
console.log(apply ? "Mode:   apply\n" : "Mode:   dry run (no rows changed)\n");

const testEmail = (email: AnyColumn) => sql`lower(${email}) ~ ${TEST_EMAIL}`;

const client = postgres(rawUrl, { prepare: false, max: 1, onnotice: () => {} });
const db = drizzle(client);

try {
  const contactFilter = all ? undefined : testEmail(corporateContacts.email);
  const contactIds = () => db.select({ id: corporateContacts.id }).from(corporateContacts).where(contactFilter);
  const bookingFilter = all
    ? undefined
    : or(eq(quoteRequests.source, "demo"), testEmail(quoteRequests.email), inArray(quoteRequests.corporateContactId, contactIds()));
  const bookingIds = () => db.select({ id: quoteRequests.id }).from(quoteRequests).where(bookingFilter);
  const conversationIds = () =>
    db.select({ id: conciergeConversations.id }).from(conciergeConversations).where(inArray(conciergeConversations.requestId, bookingIds()));

  const [{ bookings }] = await db.select({ bookings: count() }).from(quoteRequests).where(bookingFilter);
  const [{ accounts }] = await db.select({ accounts: count() }).from(corporateContacts).where(contactFilter);
  console.log(`Bookings:           ${Number(bookings)}`);
  console.log(`Corporate accounts: ${Number(accounts)}`);

  if (!apply) {
    console.log("\nDry run only. Re-run with ALLOW_DEV_RESET=1, --apply, and --confirm=RESET-DEV-DATA to delete these rows.");
  } else {
    const removed = await db.transaction(async (tx) => {
      const chats = await tx.delete(conciergeMessages).where(inArray(conciergeMessages.conversationId, conversationIds())).returning({ id: conciergeMessages.id });
      const conversations = await tx.delete(conciergeConversations).where(inArray(conciergeConversations.requestId, bookingIds())).returning({ id: conciergeConversations.id });
      const messages = await tx.delete(bookingMessages).where(inArray(bookingMessages.requestId, bookingIds())).returning({ id: bookingMessages.id });
      const invoices = await tx.delete(bookingInvoices).where(inArray(bookingInvoices.requestId, bookingIds())).returning({ id: bookingInvoices.id });
      const events = await tx.delete(requestEvents).where(inArray(requestEvents.requestId, bookingIds())).returning({ id: requestEvents.id });
      const requests = await tx.delete(quoteRequests).where(bookingFilter).returning({ id: quoteRequests.id });
      const challenges = await tx.delete(corporateChallenges).where(inArray(corporateChallenges.contactId, contactIds())).returning({ id: corporateChallenges.id });
      const sessions = await tx.delete(corporateAccess).where(inArray(corporateAccess.contactId, contactIds())).returning({ id: corporateAccess.id });
      const contacts = await tx.delete(corporateContacts).where(contactFilter).returning({ id: corporateContacts.id });
      return {
        chats: chats.length,
        conversations: conversations.length,
        messages: messages.length,
        invoices: invoices.length,
        events: events.length,
        requests: requests.length,
        challenges: challenges.length,
        sessions: sessions.length,
        contacts: contacts.length,
      };
    });

    console.log("\nRemoved:");
    for (const [name, n] of Object.entries(removed)) console.log(`  ${name.padEnd(16)} ${n}`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : "Cleanup failed.");
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
