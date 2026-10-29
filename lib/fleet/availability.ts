import "server-only";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";
import { blocksOf, overlaps, wallText, windowBlocks, type Block, type Window } from "@/lib/fleet/schedule";

type Db = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const q = schema.quoteRequests;

/** A fixed key for the advisory lock that serialises everything that gives a car to a confirmed booking. */
const FLEET_LOCK = 7_311_901;

/**
 * Takes the fleet lock for the rest of the transaction. A car is given to a booking in two steps (look for a clash, then
 * save), so two people confirming at once could both pass the look; the second waits here until the first has saved.
 */
export async function lockFleet(tx: Db) {
  await tx.execute(sql`select pg_advisory_xact_lock(${FLEET_LOCK})`);
}

/** The key a booking's car is held under, or null when no particular car is meant ("advise me", or none chosen). */
export function carKey(vehicle: string | null | undefined): string | null {
  if (!vehicle || vehicle === "advise") return null;
  return normalizeVehicleKey(vehicle) ?? vehicle;
}

type ConfirmedRow = { id: string; reference: string; vehicle: string | null; service: string; pickupAt: string | null; returnAt: string | null; durationHours: number | null };

/** The confirmed bookings with a particular car whose stretches could touch the given stretches. */
async function confirmedNear(db: Db, blocks: Block[], excludeId?: string): Promise<ConfirmedRow[]> {
  if (blocks.length === 0) return [];
  // A trip plus its buffer is at most a day, so anything starting more than a day before, or after, cannot touch
  const lo = wallText(Math.min(...blocks.map((b) => b.start)) - 24 * 60);
  const hi = wallText(Math.max(...blocks.map((b) => b.end)));
  return db
    .select({ id: q.id, reference: q.reference, vehicle: q.vehicle, service: q.service, pickupAt: q.pickupAt, returnAt: q.returnAt, durationHours: q.durationHours })
    .from(q)
    .where(
      and(
        eq(q.status, "confirmed"),
        ne(q.vehicle, "advise"),
        or(sql`${q.pickupAt} between ${lo}::timestamp and ${hi}::timestamp`, sql`${q.returnAt} between ${lo}::timestamp and ${hi}::timestamp`),
        excludeId ? ne(q.id, excludeId) : undefined,
      ),
    );
}

/** The cars that already hold a confirmed booking at some point of this trip (keys only, nothing about the bookings). */
export async function busyVehicleKeys(window: Window, opts: { excludeId?: string; db?: Db } = {}): Promise<Set<string>> {
  const mine = windowBlocks(window);
  const rows = await confirmedNear(opts.db ?? db, mine, opts.excludeId);
  const busy = new Set<string>();
  for (const row of rows) {
    const key = carKey(row.vehicle);
    if (!key) continue;
    const theirs = blocksOf({ ...row, status: "confirmed", blockMinutes: null });
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) busy.add(key);
  }
  return busy;
}

/** The reference of the confirmed booking that already holds this car at some point of this trip, or null when it is free. */
export async function clashingReference(
  tx: Db,
  booking: { id?: string; vehicle: string | null; pickupAt: string | null; returnAt: string | null; service: string; durationHours: number | null },
): Promise<string | null> {
  const key = carKey(booking.vehicle);
  if (!key || !booking.pickupAt) return null;
  const mine = blocksOf({ id: booking.id ?? "new", status: "confirmed", service: booking.service, pickupAt: booking.pickupAt, returnAt: booking.returnAt, durationHours: booking.durationHours, blockMinutes: null });
  const rows = await confirmedNear(tx, mine, booking.id);
  for (const row of rows) {
    if (carKey(row.vehicle) !== key) continue;
    const theirs = blocksOf({ ...row, status: "confirmed", blockMinutes: null });
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) return row.reference;
  }
  return null;
}

/**
 * Whether the car a visitor chose for this trip is held by a confirmed booking by now (it can have been taken since the
 * car step showed it). Only a particular car can be taken. If the bookings cannot be read the visitor is not stopped:
 * what is asked is only a request, and a confirmation is checked on its own.
 */
export async function chosenCarIsBooked(trip: { vehicle?: string | null; pickupAt?: string | null; returnAt?: string | null; service: string; durationHours?: number | null }): Promise<boolean> {
  const key = carKey(trip.vehicle);
  if (!key || !trip.pickupAt) return false;
  try {
    const busy = await busyVehicleKeys({ pickupAt: trip.pickupAt, returnAt: trip.returnAt ?? null, service: trip.service, durationHours: trip.durationHours ?? null });
    return busy.has(key);
  } catch (error) {
    console.error("Failed to read which vehicles are booked:", error);
    return false;
  }
}
