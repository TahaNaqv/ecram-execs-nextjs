import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { carKey } from "@/lib/fleet/availability";
import { tripMinutes } from "@/lib/fleet/schedule";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { evaluateShift, type Compliance, type Span } from "@/lib/drivers/shifts";
import { amsterdamToday, amsterdamWallToUtc, parseInstant, utcToAmsterdamParts } from "@/lib/drivers/time";

const { drivers: d, vehicles: v, driverAssignments: a, driverBreakBlocks: breaks, driverShifts: shifts, quoteRequests: q } = schema;

const LIVE = ["new", "contacted", "quoted", "confirmed", "completed"] as const;

export type BoardAssignment = {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicleLabel: string;
  pair: string;
  start: Date;
  end: Date;
  isEntireShift: boolean;
  notes: string | null;
  compliance: Compliance;
  workedMin: number;
  breakMin: number;
  requiredMin: number;
  blockCount: number;
};

export type BoardBreak = {
  id: string;
  driverId: string;
  driverName: string;
  start: Date;
  end: Date;
  notes: string | null;
};

export type BoardShift = {
  id: string;
  driverId: string;
  driverName: string;
  start: Date;
  end: Date | null;
  status: string;
  vehicleId: string | null;
};

export type DriverOption = { id: string; name: string };
export type VehicleOption = { id: string; label: string };

const minutes = (ms: number) => Math.round(ms / 60_000);

const vehicleLabel = (id: string, name: string, plate: string | null) => {
  const model = vehicleByKey(id)?.name ?? name;
  return [model, plate].filter(Boolean).join(" · ");
};

const pairLine = (driver: string, vehicle: string) => `${driver} → ${vehicle}`;

type JobRow = {
  vehicle: string | null;
  vehicles: { key: string; count: number }[] | null;
  pickupAt: string | null;
  service: string;
  durationHours: number | null;
  blockMinutes: number | null;
};

const jobSpans = (rows: JobRow[], vehicleId: string, window: Span): Span[] => {
  const spans: Span[] = [];
  for (const row of rows) {
    const keys = new Set<string>();
    if (row.vehicle) keys.add(row.vehicle);
    for (const pick of row.vehicles ?? []) keys.add(pick.key);
    if (!keys.has(vehicleId)) continue;
    const startAt = parseInstant(row.pickupAt);
    if (!startAt) continue;
    const start = startAt.getTime();
    const end = start + tripMinutes(row) * 60_000;
    if (end <= window.start || start >= window.end) continue;
    spans.push({ start, end });
  }
  return spans;
};

async function jobsBetween(from: Date, to: Date): Promise<JobRow[]> {
  return db
    .select({
      vehicle: q.vehicle,
      vehicles: q.vehicles,
      pickupAt: q.pickupAt,
      service: q.service,
      durationHours: q.durationHours,
      blockMinutes: q.blockMinutes,
    })
    .from(q)
    .where(
      and(
        inArray(q.status, [...LIVE]),
        sql`${q.pickupAt} is not null`,
        sql`${q.pickupAt} >= ${from.toISOString()}::timestamp - interval '2 days'`,
        sql`${q.pickupAt} <= ${to.toISOString()}::timestamp + interval '2 days'`,
      ),
    );
}

export async function driverBoard(date = amsterdamToday()) {
  const dayStart = amsterdamWallToUtc(date, "00:00");
  const dayEnd = amsterdamWallToUtc(date, "23:59");
  if (!dayStart || !dayEnd) {
    return { date, drivers: [] as DriverOption[], vehicles: [] as VehicleOption[], assignments: [] as BoardAssignment[], breaks: [] as BoardBreak[], shifts: [] as BoardShift[] };
  }
  const windowEnd = new Date(dayEnd.getTime() + 60_000);

  const [people, cars, rows, breakRows, shiftRows] = await Promise.all([
    db.select({ id: d.id, name: d.name }).from(d).where(eq(d.active, true)).orderBy(asc(d.name)),
    db
      .select({ id: v.id, name: v.name, plate: v.licensePlate })
      .from(v)
      .orderBy(asc(v.name)),
    db
      .select({
        id: a.id,
        driverId: a.driverId,
        driverName: d.name,
        vehicleId: a.vehicleId,
        vehicleName: v.name,
        plate: v.licensePlate,
        start: a.startTime,
        end: a.endTime,
        isEntireShift: a.isEntireShift,
        notes: a.notes,
      })
      .from(a)
      .innerJoin(d, eq(d.id, a.driverId))
      .innerJoin(v, eq(v.id, a.vehicleId))
      .where(and(lte(a.startTime, windowEnd), gte(a.endTime, dayStart)))
      .orderBy(asc(a.startTime)),
    db
      .select({ id: breaks.id, driverId: breaks.driverId, driverName: d.name, start: breaks.startTime, end: breaks.endTime, notes: breaks.notes })
      .from(breaks)
      .innerJoin(d, eq(d.id, breaks.driverId))
      .where(and(lte(breaks.startTime, windowEnd), gte(breaks.endTime, dayStart)))
      .orderBy(asc(breaks.startTime)),
    db
      .select({ id: shifts.id, driverId: shifts.driverId, driverName: d.name, start: shifts.startedAt, end: shifts.endedAt, status: shifts.status, vehicleId: shifts.vehicleId })
      .from(shifts)
      .innerJoin(d, eq(d.id, shifts.driverId))
      .where(and(lte(shifts.startedAt, windowEnd), sql`coalesce(${shifts.endedAt}, now()) >= ${dayStart.toISOString()}::timestamptz`))
      .orderBy(asc(shifts.startedAt)),
  ]);

  const from = rows.reduce((min, row) => (row.start < min ? row.start : min), dayStart);
  const to = rows.reduce((max, row) => (row.end > max ? row.end : max), windowEnd);
  const jobs = rows.length ? await jobsBetween(from, to) : [];
  const now = Date.now();

  const assignments: BoardAssignment[] = rows.map((row) => {
    const label = vehicleLabel(row.vehicleId, row.vehicleName, row.plate);
    const window = { start: row.start.getTime(), end: row.end.getTime() };
    const manual = breakRows
      .filter((block) => block.driverId === row.driverId)
      .map((block) => ({ start: block.start.getTime(), end: block.end.getTime() }));
    const spans = jobSpans(jobs, row.vehicleId, window);
    const result = evaluateShift({
      start: window.start,
      end: window.end,
      now,
      jobs: spans,
      manualBreaks: manual,
    });
    const plannedOnly = spans.length === 0;
    return {
      id: row.id,
      driverId: row.driverId,
      driverName: row.driverName,
      vehicleId: row.vehicleId,
      vehicleLabel: label,
      pair: pairLine(row.driverName, label),
      start: row.start,
      end: row.end,
      isEntireShift: row.isEntireShift,
      notes: row.notes,
      compliance: plannedOnly ? "green" : result.compliance,
      workedMin: minutes(result.workedMs),
      breakMin: minutes(result.breakMs),
      requiredMin: plannedOnly ? 0 : minutes(result.requiredMs),
      blockCount: result.blocks.length,
    };
  });

  return {
    date,
    drivers: people,
    vehicles: cars.map((car) => ({ id: car.id, label: vehicleLabel(car.id, car.name, car.plate) })),
    assignments,
    breaks: breakRows,
    shifts: shiftRows,
  };
}

/** Driver linked to each fleet key during the booking's pick-up, for the dispatch car list. */
export async function linkedDriversAt(at: Date | null): Promise<Record<string, string>> {
  if (!at) return {};
  const rows = await db
    .select({ vehicleId: a.vehicleId, driverName: d.name })
    .from(a)
    .innerJoin(d, eq(d.id, a.driverId))
    .where(and(lte(a.startTime, at), gte(a.endTime, at), eq(d.active, true)))
    .orderBy(asc(d.name));
  const links: Record<string, string> = {};
  for (const row of rows) {
    const name = links[row.vehicleId] ? `${links[row.vehicleId]}, ${row.driverName}` : row.driverName;
    links[row.vehicleId] = name;
    const key = carKey(row.vehicleId);
    if (key && key !== row.vehicleId) links[key] = name;
  }
  return links;
}

/** Column key → "Driver → Vehicle" for every assignment that touches this Amsterdam day. */
export async function driverPairByVehicle(date: string): Promise<Map<string, string>> {
  const dayStart = amsterdamWallToUtc(date, "00:00");
  const dayEnd = amsterdamWallToUtc(date, "23:59");
  const map = new Map<string, string>();
  if (!dayStart || !dayEnd) return map;
  const rows = await db
    .select({ vehicleId: a.vehicleId, driverName: d.name, vehicleName: v.name, plate: v.licensePlate })
    .from(a)
    .innerJoin(d, eq(d.id, a.driverId))
    .innerJoin(v, eq(v.id, a.vehicleId))
    .where(and(lte(a.startTime, new Date(dayEnd.getTime() + 60_000)), gte(a.endTime, dayStart)))
    .orderBy(asc(d.name));
  for (const row of rows) {
    const line = pairLine(row.driverName, vehicleLabel(row.vehicleId, row.vehicleName, row.plate));
    const current = map.get(row.vehicleId);
    map.set(row.vehicleId, current ? `${current}; ${line}` : line);
  }
  return map;
}

export function formatBoardClock(instant: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);
}

export { utcToAmsterdamParts };

/**
 * Driver–vehicle links from the day before `date` to two weeks after it, in Amsterdam wall time ("YYYY-MM-DDTHH:MM"), so the
 * link form can leave out cars and drivers already taken on whichever day is picked there (the server checks again on save).
 */
export async function linksAround(date: string): Promise<{ driverId: string; driverName: string; vehicleId: string; start: string; end: string }[]> {
  const from = amsterdamWallToUtc(date, "00:00");
  if (!from) return [];
  const lo = new Date(from.getTime() - 24 * 3_600_000);
  const hi = new Date(from.getTime() + 15 * 24 * 3_600_000);
  const rows = await db
    .select({ driverId: a.driverId, driverName: d.name, vehicleId: a.vehicleId, start: a.startTime, end: a.endTime })
    .from(a)
    .innerJoin(d, eq(d.id, a.driverId))
    .where(and(lte(a.startTime, hi), gte(a.endTime, lo)));
  return rows.map((row) => {
    const s = utcToAmsterdamParts(row.start);
    const e = utcToAmsterdamParts(row.end);
    return { driverId: row.driverId, driverName: row.driverName, vehicleId: row.vehicleId, start: `${s.date}T${s.time}`, end: `${e.date}T${e.time}` };
  });
}
