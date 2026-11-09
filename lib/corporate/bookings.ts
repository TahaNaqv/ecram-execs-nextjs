import "server-only";
import { and, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
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
export type PortalTab = "open" | "past" | "cancelled";
export const PORTAL_TABS: readonly PortalTab[] = ["open", "past", "cancelled"];
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
  destinationWaits: q.destinationWaits,
  pickupAt: q.pickupAt,
  returnAt: q.returnAt,
  priceEstimate: q.priceEstimate,
  durationHours: q.durationHours,
  passengers: q.passengers,
  luggage: q.luggage,
  handLuggage: q.handLuggage,
  flightNumber: q.flightNumber,
  passengerName: q.passengerName,
  passengerPhone: q.passengerPhone,
  vehicle: q.vehicle,
  vehicleCount: q.vehicleCount,
  vehicles: q.vehicles,
  extras: q.extras,
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

// Pick-up times are Netherlands wall-clock timestamps, so "already happened" is compared in that zone.
const amsterdamNow = sql`(now() at time zone 'Europe/Amsterdam')`;

/**
 * A booking belongs to this signed-in partner only when it was tied to the account at the time it was made
 * (the portal, the company introduction, or a booking the team entered for them), or when the team later
 * attached it. A public guest booking is not included because its email matches, even if a contact id was
 * written onto it afterwards.
 */
export function partnerOwns(contactId: string): SQL {
  return and(
    eq(q.corporateContactId, contactId),
    or(
      inArray(q.source, ["portal", "website-corporate", "admin"]),
      sql`exists (
        select 1 from ${schema.requestEvents}
        where ${schema.requestEvents.requestId} = ${q.id}
          and ${schema.requestEvents.event} = 'attached'
          and ${schema.requestEvents.params}->>'by' = 'team'
      )`,
    ),
  )!;
}

const tabFilter: Record<PortalTab, SQL> = {
  // Every new or confirmed booking stays here, including one whose pick-up has already passed.
  open: inArray(q.status, ["new", "contacted", "quoted", "confirmed"]),
  // Marked completed, or confirmed and already driven. The second case is still listed under Open as well.
  past: or(eq(q.status, "completed"), and(eq(q.status, "confirmed"), sql`${q.pickupAt} < ${amsterdamNow}`))!,
  cancelled: eq(q.status, "cancelled"),
};

export async function bookingTabCounts() {
  const contact = await owner();
  const [row] = await db
    .select({
      open: sql<number>`count(*) filter (where ${tabFilter.open})`.mapWith(Number),
      past: sql<number>`count(*) filter (where ${tabFilter.past})`.mapWith(Number),
      cancelled: sql<number>`count(*) filter (where ${tabFilter.cancelled})`.mapWith(Number),
    })
    .from(q)
    .where(partnerOwns(contact.id));
  return row as Record<PortalTab, number>;
}

export async function listBookings(tab: PortalTab, page: number) {
  const contact = await owner();
  const where = and(partnerOwns(contact.id), tabFilter[tab]);
  // Open work is ordered by when the trip is (undated bespoke programmes last); the past by when it was asked for
  const order = tab === "open" ? [sql`${q.pickupAt} asc nulls last`, desc(q.createdAt)] : [desc(q.createdAt)];
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
    .where(and(eq(q.reference, reference), partnerOwns(contact.id)))
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
    // A partner's booking never has guest messages; anything not the partner's own is the team's
    ...messages.map((m) => ({ type: "message" as const, ...m, by: m.by === "partner" ? ("partner" as const) : ("team" as const) })),
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
  const [row] = await db.select({ phone: q.phone }).from(q).where(partnerOwns(contact.id)).orderBy(desc(q.createdAt)).limit(1);
  const match = row?.phone.match(/^\+(\d{1,4}) (.+)$/);
  return match ? { country: match[1], number: match[2] } : null;
}
