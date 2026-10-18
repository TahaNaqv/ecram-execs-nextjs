import "server-only";
import { and, count, desc, eq, inArray, isNotNull, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import type { RequestEventParams } from "@/lib/admin/events";
import type { RequestStatus } from "@/lib/quotes/constants";
import { getCorporateContact } from "./access";

/**
 * A partner's view of their own bookings. Every function here finds the partner itself (from the session, never from
 * input) and filters by `corporate_contact_id`, so a reference or id belonging to someone else finds nothing. Columns
 * are named one by one: the internal notes, the visitor's address and the browser are never selected. This module is
 * `server-only` and deliberately NOT a "use server" file, so none of it is callable from the browser.
 */
const q = schema.quoteRequests;

export const PORTAL_PAGE_SIZE = 20;
export type PortalTab = "answer" | "open" | "past";
export const PORTAL_TABS: readonly PortalTab[] = ["answer", "open", "past"];
export const isPortalTab = (value: unknown): value is PortalTab => PORTAL_TABS.includes(value as PortalTab);

/** A booking reference as the system makes them (see makeReference). */
export const REF_RE = /^EE-[A-Z0-9]{6}$/;

/** Statuses in which a partner can still write to the team about a booking. */
export const MESSAGEABLE: readonly RequestStatus[] = ["new", "contacted", "quoted", "confirmed"];

const bookingColumns = {
  id: q.id,
  reference: q.reference,
  status: q.status,
  service: q.service,
  collection: q.collection,
  destination: q.destination,
  destinations: q.destinations,
  pickupAt: q.pickupAt,
  passengers: q.passengers,
  vehicle: q.vehicle,
  entity: q.entity,
  itinerary: q.itinerary,
  notes: q.notes,
  phone: q.phone,
  quotedAmount: q.quotedAmount,
  source: q.source,
  createdAt: q.createdAt,
};
export type Booking = NonNullable<Awaited<ReturnType<typeof getBooking>>>;

async function owner() {
  const contact = await getCorporateContact();
  if (!contact) throw new Error("Not signed in");
  return contact;
}

/** The company introduction is stored as a request too, but it is not a booking: it has its own page. */
const isBooking = ne(q.source, "website-corporate");

/** A quote is waiting for the partner's answer only when it has an amount: that is what they would be accepting. */
const waiting = and(eq(q.status, "quoted"), isNotNull(q.quotedAmount))!;
const tabFilter: Record<PortalTab, SQL> = {
  answer: waiting,
  open: or(inArray(q.status, ["new", "contacted", "confirmed"]), and(eq(q.status, "quoted"), isNull(q.quotedAmount)))!,
  past: inArray(q.status, ["completed", "cancelled"]),
};

export async function bookingTabCounts() {
  const contact = await owner();
  const [row] = await db
    .select({
      answer: sql<number>`count(*) filter (where ${tabFilter.answer})`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${tabFilter.open})`.mapWith(Number),
      past: sql<number>`count(*) filter (where ${tabFilter.past})`.mapWith(Number),
    })
    .from(q)
    .where(and(eq(q.corporateContactId, contact.id), isBooking));
  return row as Record<PortalTab, number>;
}

export async function listBookings(tab: PortalTab, page: number) {
  const contact = await owner();
  const where = and(eq(q.corporateContactId, contact.id), isBooking, tabFilter[tab]);
  // Open work is ordered by when the trip is (undated bespoke programmes last); the past by when it was asked for
  const order = tab === "past" ? [desc(q.createdAt)] : [sql`${q.pickupAt} asc nulls last`, desc(q.createdAt)];
  const [rows, [counted]] = await Promise.all([
    db
      .select(bookingColumns)
      .from(q)
      .where(where)
      .orderBy(...order)
      .limit(PORTAL_PAGE_SIZE)
      .offset((page - 1) * PORTAL_PAGE_SIZE),
    db.select({ total: count() }).from(q).where(where),
  ]);
  return { rows, total: counted?.total ?? 0 };
}

export async function getBooking(reference: string) {
  const contact = await owner();
  if (!REF_RE.test(reference)) return null;
  const [row] = await db
    .select(bookingColumns)
    .from(q)
    .where(and(eq(q.reference, reference), eq(q.corporateContactId, contact.id), isBooking))
    .limit(1);
  return row ?? null;
}

export type TimelineItem =
  | { type: "event"; id: string; event: string; params: RequestEventParams | null; at: Date }
  | { type: "message"; id: string; by: "partner" | "team"; kind: "message" | "change" | "cancel"; body: string; at: Date };

/** The history and the conversation of ONE booking, newest first. Call only with an id from getBooking. */
export async function bookingTimeline(requestId: string): Promise<TimelineItem[]> {
  const contact = await owner();
  const [events, messages] = await Promise.all([
    db
      .select({ id: schema.requestEvents.id, event: schema.requestEvents.event, params: schema.requestEvents.params, at: schema.requestEvents.createdAt })
      .from(schema.requestEvents)
      .where(eq(schema.requestEvents.requestId, requestId)),
    db
      .select({ id: schema.bookingMessages.id, by: schema.bookingMessages.authorKind, kind: schema.bookingMessages.kind, body: schema.bookingMessages.body, at: schema.bookingMessages.createdAt })
      .from(schema.bookingMessages)
      // The team's messages, and the ones THIS partner wrote: if a booking was ever moved from another partner (the admin
      // refuses that once there is history, see lib/admin/portal.ts) their words would still never show here
      .where(and(eq(schema.bookingMessages.requestId, requestId), or(eq(schema.bookingMessages.authorKind, "team"), eq(schema.bookingMessages.contactId, contact.id)))),
  ]);
  return [
    ...events.map((e) => ({ type: "event" as const, ...e })),
    ...messages.map((m) => ({ type: "message" as const, ...m })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}

/** Invoices for ONE booking. Call only with an id from getBooking. */
export async function bookingInvoicesFor(requestId: string) {
  return db
    .select({ id: schema.bookingInvoices.id, fileName: schema.bookingInvoices.fileName, size: schema.bookingInvoices.size, createdAt: schema.bookingInvoices.createdAt })
    .from(schema.bookingInvoices)
    .where(eq(schema.bookingInvoices.requestId, requestId))
    .orderBy(desc(schema.bookingInvoices.createdAt));
}

/** Whether the partner has sent the company introduction yet (it shows as a prompt until they have). */
export const hasIntroduction = cache(async () => {
  const contact = await owner();
  const [row] = await db
    .select({ id: q.id })
    .from(q)
    .where(and(eq(q.corporateContactId, contact.id), eq(q.source, "website-corporate")))
    .limit(1);
  return !!row;
});

/** The phone number on their latest booking, split into calling code and number, to prefill the next one. */
export async function latestPhone() {
  const contact = await owner();
  const [row] = await db.select({ phone: q.phone }).from(q).where(eq(q.corporateContactId, contact.id)).orderBy(desc(q.createdAt)).limit(1);
  const match = row?.phone.match(/^\+(\d{1,4}) (.+)$/);
  return match ? { country: match[1], number: match[2] } : null;
}
