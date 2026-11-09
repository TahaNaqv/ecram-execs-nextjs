import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { verifyGuestKey } from "@/lib/quotes/guest-link";

/**
 * A website visitor's view of their own booking, found by its reference and the private key in their link
 * (lib/quotes/guest-link.ts). A wrong key, someone else's reference, or a booking that belongs to a corporate partner (they
 * have their portal) finds nothing, all in the same way. Columns are named one by one: internal notes, the visitor's address
 * and browser are never selected. `server-only` and not a "use server" file, so none of it is callable from the browser.
 */
const q = schema.quoteRequests;
const m = schema.bookingMessages;

const REF_RE = /^EE-[A-Z0-9]{6}$/;

const guestColumns = {
  id: q.id,
  reference: q.reference,
  status: q.status,
  service: q.service,
  name: q.name,
  locale: q.locale,
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
  vehicle: q.vehicle,
  vehicleCount: q.vehicleCount,
  vehicles: q.vehicles,
  extras: q.extras,
  quotedAmount: q.quotedAmount,
  pickupPlaceId: q.pickupPlaceId,
  destinationPlaceId: q.destinationPlaceId,
  updatedAt: q.updatedAt,
};

export type GuestBooking = NonNullable<Awaited<ReturnType<typeof getGuestBooking>>>;

/** The booking this link opens, or null for anything else. */
export async function getGuestBooking(reference: unknown, key: unknown) {
  if (typeof reference !== "string" || !REF_RE.test(reference)) return null;
  const [row] = await db
    .select(guestColumns)
    .from(q)
    .where(and(eq(q.reference, reference), isNull(q.corporateContactId)))
    .limit(1);
  if (!row || !verifyGuestKey(row.id, key)) return null;
  return row;
}

export type GuestMessage = { id: string; by: "guest" | "team"; body: string; at: Date };

/** The conversation of ONE booking, oldest first: the team's messages and the visitor's. Call only with an id from getGuestBooking. */
export async function guestMessages(requestId: string): Promise<GuestMessage[]> {
  const rows = await db
    .select({ id: m.id, by: m.authorKind, body: m.body, at: m.createdAt })
    .from(m)
    .where(and(eq(m.requestId, requestId), inArray(m.authorKind, ["guest", "team"])))
    .orderBy(asc(m.createdAt));
  return rows.map((r) => ({ ...r, by: r.by === "guest" ? "guest" : "team" }));
}

/** What the open page polls: the status, and when the conversation last changed. Nothing else about the booking. */
export async function guestState(reference: unknown, key: unknown): Promise<{ status: string; lastMessageAt: string | null } | null> {
  const booking = await getGuestBooking(reference, key);
  if (!booking) return null;
  const [last] = await db.select({ at: m.createdAt }).from(m).where(eq(m.requestId, booking.id)).orderBy(desc(m.createdAt)).limit(1);
  return { status: booking.status, lastMessageAt: last?.at.toISOString() ?? null };
}
