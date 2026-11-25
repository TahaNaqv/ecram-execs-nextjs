import "server-only";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { carKey, heldKeys } from "@/lib/fleet/held";
import { fleetPicks, normalizeVehicleKey, VEHICLE_KEYS } from "@/lib/fleet/vehicles";
import { TRAILER_KEY } from "@/lib/pricing/extras";
import { blocksOf, overlaps, wallText, windowBlocks, type Block, type Window } from "@/lib/fleet/schedule";

export { carKey, heldKeys };

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

type ConfirmedRow = { id: string; reference: string; vehicle: string | null; vehicles: unknown; extras: unknown; service: string; pickupAt: string | null; returnAt: string | null; durationHours: number | null; blockMinutes: number | null; driveBackMinutes: number | null };

/** The confirmed bookings with a particular car whose stretches could touch the given stretches. */
async function confirmedNear(db: Db, blocks: Block[], excludeId?: string): Promise<ConfirmedRow[]> {
  if (blocks.length === 0) return [];
  // A trip (at most 16 hours) plus its drive home (at most 11, see route-core.ts) is under two days
  const lo = wallText(Math.min(...blocks.map((b) => b.start)) - 2 * 24 * 60);
  const hi = wallText(Math.max(...blocks.map((b) => b.end)));
  return db
    .select({ id: q.id, reference: q.reference, vehicle: q.vehicle, vehicles: q.vehicles, extras: q.extras, service: q.service, pickupAt: q.pickupAt, returnAt: q.returnAt, durationHours: q.durationHours, blockMinutes: q.blockMinutes, driveBackMinutes: q.driveBackMinutes })
    .from(q)
    .where(
      and(
        eq(q.status, "confirmed"),
        // "Let us choose" holds no car, but it may hold the trailer
        or(ne(q.vehicle, "advise"), sql`${q.extras} @> ${JSON.stringify([{ key: TRAILER_KEY }])}::jsonb`),
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
    const keys = heldKeys(row);
    if (keys.size === 0) continue;
    const theirs = blocksOf({ ...row, status: "confirmed" });
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) for (const key of keys) busy.add(key);
  }
  return busy;
}

/**
 * Another booking already holds one of these cars across this trip: a confirmed booking, or one still
 * pending (new, in discussion, or at the payment step). The review panel uses this so staff can offer
 * another car or decline. Confirming still refuses only a confirmed clash.
 */
export async function holdConflict(
  booking: { id?: string; vehicle: string | null; vehicles?: unknown; extras?: unknown; pickupAt: string | null; returnAt: string | null; service: string; durationHours: number | null; blockMinutes?: number | null; driveBackMinutes?: number | null },
): Promise<{ reference: string; pending: boolean; trailer: boolean } | null> {
  const keys = heldKeys(booking);
  if (keys.size === 0 || !booking.pickupAt) return null;
  const mine = blocksOf({ id: booking.id ?? "new", status: "confirmed", service: booking.service, pickupAt: booking.pickupAt, returnAt: booking.returnAt, durationHours: booking.durationHours, blockMinutes: booking.blockMinutes ?? null, driveBackMinutes: booking.driveBackMinutes ?? null });
  if (mine.length === 0) return null;
  const lo = wallText(Math.min(...mine.map((b) => b.start)) - 2 * 24 * 60);
  const hi = wallText(Math.max(...mine.map((b) => b.end)));
  const rows = await db
    .select({ id: q.id, reference: q.reference, status: q.status, vehicle: q.vehicle, vehicles: q.vehicles, extras: q.extras, service: q.service, pickupAt: q.pickupAt, returnAt: q.returnAt, durationHours: q.durationHours, blockMinutes: q.blockMinutes, driveBackMinutes: q.driveBackMinutes })
    .from(q)
    .where(
      and(
        inArray(q.status, ["new", "contacted", "quoted", "confirmed"]),
        // "Let us choose" holds no car, but it may hold the trailer
        or(ne(q.vehicle, "advise"), sql`${q.extras} @> ${JSON.stringify([{ key: TRAILER_KEY }])}::jsonb`),
        or(sql`${q.pickupAt} between ${lo}::timestamp and ${hi}::timestamp`, sql`${q.returnAt} between ${lo}::timestamp and ${hi}::timestamp`),
        booking.id ? ne(q.id, booking.id) : undefined,
      ),
    );
  for (const row of rows) {
    const shared = [...heldKeys(row)].filter((k) => keys.has(k));
    if (shared.length === 0) continue;
    const theirs = blocksOf({ ...row, status: "confirmed" });
    // `trailer`: what clashes is only the luggage trailer, so removing it from this booking resolves it
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) return { reference: row.reference, pending: row.status !== "confirmed", trailer: shared.every((k) => k === TRAILER_KEY) };
  }
  return null;
}

/** The reference of a confirmed booking that already holds one of this booking's cars at some point of this trip, or null when they are all free. */
export async function clashingReference(
  tx: Db,
  booking: { id?: string; vehicle: string | null; vehicles?: unknown; extras?: unknown; pickupAt: string | null; returnAt: string | null; service: string; durationHours: number | null; blockMinutes?: number | null; driveBackMinutes?: number | null },
): Promise<string | null> {
  const keys = heldKeys(booking);
  if (keys.size === 0 || !booking.pickupAt) return null;
  const mine = blocksOf({ id: booking.id ?? "new", status: "confirmed", service: booking.service, pickupAt: booking.pickupAt, returnAt: booking.returnAt, durationHours: booking.durationHours, blockMinutes: booking.blockMinutes ?? null, driveBackMinutes: booking.driveBackMinutes ?? null });
  const rows = await confirmedNear(tx, mine, booking.id);
  for (const row of rows) {
    if (![...heldKeys(row)].some((k) => keys.has(k))) continue;
    const theirs = blocksOf({ ...row, status: "confirmed" });
    if (theirs.some((t) => mine.some((m) => overlaps(t, m)))) return row.reference;
  }
  return null;
}

const ACTIVE = ["new", "contacted", "quoted", "confirmed"] as const;

type SlotBooking = {
  id?: string;
  vehicle?: string | null;
  vehicles?: unknown;
  vehicleCount?: number | null;
  pickupAt?: string | null;
  returnAt?: string | null;
  service: string;
  durationHours?: number | null;
  blockMinutes?: number | null;
  driveBackMinutes?: number | null;
};

/** Cars of each class that can be booked. A printed model with no row yet counts as one car. An unavailable row does not. */
async function classCapacity(tx: Db): Promise<Map<string, number>> {
  const rows = await tx.select({ id: schema.vehicles.id, status: schema.vehicles.status }).from(schema.vehicles);
  const known = new Set<string>();
  const free = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeVehicleKey(row.id) ?? row.id;
    known.add(key);
    if (row.status !== "available") continue;
    free.set(key, (free.get(key) ?? 0) + 1);
  }
  for (const key of VEHICLE_KEYS) if (!known.has(key)) free.set(key, 1);
  return free;
}

/** How many of each class this booking needs. No chosen class means one car from the whole fleet. */
function classDemand(booking: SlotBooking): Map<string, number> | null {
  const picks = fleetPicks(booking.vehicles);
  if (picks.length > 0) {
    const need = new Map<string, number>();
    for (const pick of picks) need.set(pick.key, (need.get(pick.key) ?? 0) + Math.max(1, pick.count));
    return need;
  }
  const key = carKey(booking.vehicle);
  if (!key) return null;
  return new Map([[key, Math.max(1, booking.vehicleCount ?? 1)]]);
}

/**
 * Whether the fleet still has a car for this trip. Overlapping bookings that are not cancelled already hold their cars,
 * including ones still waiting to be confirmed. The window includes the trip and the handover buffer.
 */
export async function fleetSlotFree(tx: Db, booking: SlotBooking): Promise<boolean> {
  if (!booking.pickupAt) return true;
  const mine = blocksOf({
    id: booking.id ?? "new",
    status: "confirmed",
    service: booking.service,
    pickupAt: booking.pickupAt,
    returnAt: booking.returnAt ?? null,
    durationHours: booking.durationHours ?? null,
    blockMinutes: booking.blockMinutes ?? null,
    driveBackMinutes: booking.driveBackMinutes ?? null,
  });
  if (mine.length === 0) return true;
  const lo = wallText(Math.min(...mine.map((b) => b.start)) - 2 * 24 * 60);
  const hi = wallText(Math.max(...mine.map((b) => b.end)));
  const rows = await tx
    .select({
      id: q.id,
      vehicle: q.vehicle,
      vehicles: q.vehicles,
      vehicleCount: q.vehicleCount,
      service: q.service,
      pickupAt: q.pickupAt,
      returnAt: q.returnAt,
      durationHours: q.durationHours,
      blockMinutes: q.blockMinutes,
      driveBackMinutes: q.driveBackMinutes,
    })
    .from(q)
    .where(
      and(
        inArray(q.status, [...ACTIVE]),
        or(sql`${q.pickupAt} between ${lo}::timestamp and ${hi}::timestamp`, sql`${q.returnAt} between ${lo}::timestamp and ${hi}::timestamp`),
        booking.id ? ne(q.id, booking.id) : undefined,
      ),
    );
  const used = new Map<string, number>();
  let any = 0;
  for (const row of rows) {
    const theirs = blocksOf({ ...row, id: row.id, status: "confirmed" });
    if (!theirs.some((block) => mine.some((slot) => overlaps(block, slot)))) continue;
    const need = classDemand(row);
    if (!need) {
      any += Math.max(1, row.vehicleCount ?? 1);
      continue;
    }
    for (const [key, count] of need) used.set(key, (used.get(key) ?? 0) + count);
  }
  const caps = await classCapacity(tx);
  const totalCap = [...caps.values()].reduce((sum, n) => sum + n, 0);
  const totalUsed = [...used.values()].reduce((sum, n) => sum + n, 0) + any;
  const requested = classDemand(booking);
  const asking = requested ? [...requested.values()].reduce((sum, n) => sum + n, 0) : Math.max(1, booking.vehicleCount ?? 1);
  if (totalUsed + asking > totalCap) return false;
  if (!requested) return true;
  for (const [key, count] of requested) {
    if ((used.get(key) ?? 0) + count > (caps.get(key) ?? 0)) return false;
  }
  return true;
}
