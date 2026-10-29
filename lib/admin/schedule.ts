import "server-only";
import { and, asc, inArray, or, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { carKey } from "@/lib/fleet/availability";
import { blocksOf, overlaps, wallMinutes, wallText } from "@/lib/fleet/schedule";
import { vehicleByKey } from "@/lib/fleet/vehicles";

const { vehicles: v, quoteRequests: q } = schema;

/** One booking's stretch of a car's day, in minutes from midnight (clipped to the day). */
export type DayBlock = {
  id: string;
  reference: string;
  leg: "outward" | "return";
  status: "confirmed" | "completed";
  /** Minutes from midnight at which the trip starts and ends (the car stays held for the buffer after it) */
  start: number;
  tripEnd: number;
  end: number;
  clipsStart: boolean;
  clipsEnd: boolean;
  from: string | null;
  to: string | null;
  name: string;
  entity: string | null;
  passengers: number | null;
  /** Another confirmed booking holds this car at the same time (only old data can do this) */
  clash: boolean;
};

export type DayColumn = {
  /** The fleet key, or "unassigned" for confirmed bookings that have no particular car yet */
  key: string;
  name: string;
  /** available | unavailable | maintenance, or null for a car with no row in the fleet table */
  state: string | null;
  blocks: DayBlock[];
};

export type DaySchedule = { date: string; columns: DayColumn[]; jobs: number; carsAvailable: number; carsTotal: number };

export const UNASSIGNED = "unassigned";

/** Today in the Netherlands as "YYYY-MM-DD". */
export function amsterdamToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Moves a "YYYY-MM-DD" by whole days. */
export function shiftDay(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The cars and the confirmed bookings of one day, as the schedule draws them: a column per car, a block per booking. */
export async function daySchedule(date: string): Promise<DaySchedule> {
  await requireAdmin();
  const dayStart = wallMinutes(`${date}T00:00`)!;
  const dayEnd = dayStart + 24 * 60;
  // A trip plus its buffer is at most a day, so a booking that starts more than a day before cannot reach into this one
  const lo = wallText(dayStart - 24 * 60);
  const hi = wallText(dayEnd);

  const [cars, rows] = await Promise.all([
    db.select({ id: v.id, name: v.name, status: v.status }).from(v).orderBy(asc(v.name)),
    db
      .select({
        id: q.id,
        reference: q.reference,
        status: q.status,
        vehicle: q.vehicle,
        service: q.service,
        pickupAt: q.pickupAt,
        returnAt: q.returnAt,
        durationHours: q.durationHours,
        collection: q.collection,
        destination: q.destination,
        passengers: q.passengers,
        name: q.name,
        entity: q.entity,
      })
      .from(q)
      .where(
        and(
          inArray(q.status, ["confirmed", "completed"]),
          or(sql`${q.pickupAt} between ${lo}::timestamp and ${hi}::timestamp`, sql`${q.returnAt} between ${lo}::timestamp and ${hi}::timestamp`),
        ),
      ),
  ]);

  // One column per car in the fleet table (a switched-off car stays, greyed), then any car a booking names that the table
  // does not have, then the bookings with no particular car
  const columns = new Map<string, DayColumn>();
  for (const car of cars) {
    const key = carKey(car.id) ?? car.id;
    if (!columns.has(key)) columns.set(key, { key, name: vehicleByKey(key)?.name ?? car.name, state: car.status, blocks: [] });
  }
  const unassigned: DayColumn = { key: UNASSIGNED, name: "", state: null, blocks: [] };

  let jobs = 0;
  for (const row of rows) {
    const key = carKey(row.vehicle);
    let column = unassigned;
    if (key) {
      column = columns.get(key) ?? { key, name: vehicleByKey(key)?.name ?? key, state: null, blocks: [] };
      columns.set(key, column);
    }
    const status = row.status as "confirmed" | "completed";
    let onThisDay = false;
    for (const block of blocksOf({ ...row, blockMinutes: null })) {
      if (!overlaps(block, { start: dayStart, end: dayEnd })) continue;
      onThisDay = true;
      const outward = block.leg === "outward";
      column.blocks.push({
        id: row.id,
        reference: row.reference,
        leg: block.leg,
        status,
        start: Math.max(block.start, dayStart) - dayStart,
        tripEnd: Math.min(block.tripEnd, dayEnd) - dayStart,
        end: Math.min(block.end, dayEnd) - dayStart,
        clipsStart: block.start < dayStart,
        clipsEnd: block.end > dayEnd,
        // The return journey runs the other way
        from: outward ? row.collection : (row.destination ?? row.collection),
        to: outward ? row.destination : row.destination ? row.collection : null,
        name: row.name,
        entity: row.entity,
        passengers: row.passengers,
        clash: false,
      });
    }
    if (onThisDay) jobs++;
  }

  // Two confirmed bookings in one car at the same time: only old data (from before the schedule) can do this. Mark both.
  for (const column of [...columns.values()]) {
    const held = column.blocks.filter((b) => b.status === "confirmed");
    for (const a of held) {
      if (held.some((b) => b !== a && overlaps(a, b))) a.clash = true;
    }
  }

  const all = [...columns.values()].sort((a, b) => (a.state === null ? 1 : 0) - (b.state === null ? 1 : 0) || a.name.localeCompare(b.name));
  for (const column of all) column.blocks.sort((a, b) => a.start - b.start);
  unassigned.blocks.sort((a, b) => a.start - b.start);
  const carsAvailable = all.filter((c) => c.state === "available").length;
  return { date, columns: unassigned.blocks.length > 0 ? [...all, unassigned] : all, jobs, carsAvailable, carsTotal: cars.length };
}
