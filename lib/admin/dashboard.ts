import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";
import { bookingEuros } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";

const { quoteRequests: q, vehicles, corporateContacts: contacts } = schema;

// pickup_at and return_at are Netherlands wall-clock times stored without a zone, so "now" and "today" are read there as well
const NOW = sql`(now() at time zone 'Europe/Amsterdam')`;

/** The Netherlands wall-clock time now, as "YYYY-MM-DD HH:mm" (the form pickup_at comes back in). */
function amsterdamNow() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
const minutes = (value: string) => value.replace("T", " ").slice(0, 16);

/**
 * What "today" means for the headline "Today's jobs" figure: a confirmed booking whose pick-up or return
 * falls on today's Amsterdam date. New, contacted, quoted, completed and cancelled trips are left out.
 * The New Incoming Requests list does not use this. It is every status "new" booking, soonest first.
 */
const TODAY_STATUSES = ["confirmed"] as const;

/** A fresh fragment each time: the same sql object must not be embedded twice in one query. */
const amsterdamClock = () => sql`(now() at time zone 'Europe/Amsterdam')`;

function todayJobsWhere() {
  return and(
    inArray(q.status, [...TODAY_STATUSES]),
    sql`(
      (${q.pickupAt} is not null and ${q.pickupAt}::date = ${amsterdamClock()}::date)
      or (${q.returnAt} is not null and ${q.returnAt}::date = ${amsterdamClock()}::date)
    )`,
  );
}

export type DashboardFigures = {
  fleet: { available: number; total: number };
  /** Confirmed bookings with a pick-up or a return today, and the time of the next one still to come today */
  jobs: { today: number; nextAt: string | null };
  /** Every corporate partner account, the same set as the Corporate Partners list */
  partners: { total: number };
  /** Every booking that was not cancelled, at the calculated price: the same total the bookings list used to show as Total business */
  revenue: { amount: string; count: number };
};

/** The four headline figures. Every one comes straight from the bookings, vehicles and partner accounts the panel already holds. */
export const dashboardFigures = cache(async (): Promise<DashboardFigures> => {
  await requireAdmin();
  const [[fleet], todays, [partners], [revenue]] = await Promise.all([
    db
      .select({
        available: sql<number>`count(*) filter (where ${vehicles.status} = 'available')`.mapWith(Number),
        total: sql<number>`count(*)`.mapWith(Number),
      })
      .from(vehicles),
    db
      .select({ pickupAt: q.pickupAt, returnAt: q.returnAt, status: q.status })
      .from(q)
      .where(todayJobsWhere()),
    db.select({ total: sql<number>`count(*)`.mapWith(Number) }).from(contacts),
    db
      .select({
        amount: sql<string>`coalesce(round(sum(${bookingEuros()}), 2), 0)`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(q)
      .where(sql`${q.status} <> 'cancelled'`),
  ]);

  const now = amsterdamNow();
  const today = now.slice(0, 10);
  // The next one is the next that is still to happen: a trip already marked completed is not
  const times = todays.filter((r) => r.status !== "completed").flatMap((r) => [r.pickupAt, r.returnAt]).filter((t): t is string => !!t).map(minutes).filter((t) => t.startsWith(today) && t >= now);
  times.sort();
  return { fleet, jobs: { today: todays.length, nextAt: times[0]?.slice(11) ?? null }, partners, revenue };
});

export type UpcomingPickup = {
  id: string;
  reference: string;
  /** When it happens: the pick-up, or for a booking whose pick-up has passed, its return */
  at: string;
  isReturn: boolean;
  from: string | null;
  to: string | null;
  durationHours: number | null;
  name: string;
  entity: string | null;
  vehicle: string | null;
};

/**
 * Bookings still waiting for review: status "new" only. Confirmed trips stay on Today's routes.
 * Soonest pick-up first, including another day. Times are formatted in SQL so the wall clock
 * stored on the row is what the page shows.
 */
export const upcomingPickups = cache(async (): Promise<UpcomingPickup[]> => {
  await requireAdmin();
  const rows = await db
    .select({
      id: q.id,
      reference: q.reference,
      pickupAt: sql<string | null>`to_char(${q.pickupAt}, 'YYYY-MM-DD HH24:MI:SS')`,
      returnAt: sql<string | null>`to_char(${q.returnAt}, 'YYYY-MM-DD HH24:MI:SS')`,
      collection: q.collection,
      destination: q.destination,
      durationHours: q.durationHours,
      name: q.name,
      entity: q.entity,
      vehicle: q.vehicle,
    })
    .from(q)
    .where(eq(q.status, "new"))
    .orderBy(sql`coalesce(${q.pickupAt}, ${q.returnAt}, ${q.createdAt})`, asc(q.createdAt));
  const now = amsterdamNow();
  return rows.flatMap((r) => {
    const pickup = r.pickupAt ? minutes(r.pickupAt) : null;
    const at = pickup && pickup >= now ? r.pickupAt! : (r.returnAt ?? r.pickupAt);
    if (!at) return [];
    const isReturn = at === r.returnAt && at !== r.pickupAt;
    return [{
      id: r.id,
      reference: r.reference,
      at,
      isReturn,
      // A return runs the other way round (an hourly booking has nowhere to return from: it is only the time)
      from: isReturn ? (r.destination ?? r.collection) : r.collection,
      to: isReturn ? (r.destination ? r.collection : null) : r.destination,
      durationHours: r.durationHours,
      name: r.name,
      entity: r.entity,
      vehicle: r.vehicle,
    }];
  });
});

export type FleetRow = { id: string; name: string; available: boolean; nextAt: string | null; batterySoC: number; rangeKm: number };

/** Every registered vehicle, whether it is switched on, and the time of its next confirmed booking. */
export const fleetStatus = cache(async (): Promise<FleetRow[]> => {
  await requireAdmin();
  const [all, booked] = await Promise.all([
    db.select().from(vehicles).orderBy(asc(vehicles.name)),
    db
      .select({ vehicle: q.vehicle, next: sql<string>`min(case when ${q.pickupAt} >= ${NOW} then ${q.pickupAt} else ${q.returnAt} end)` })
      .from(q)
      .where(and(eq(q.status, "confirmed"), isNotNull(q.vehicle), sql`greatest(${q.pickupAt}, ${q.returnAt}) >= ${NOW}`))
      .groupBy(q.vehicle),
  ]);
  // Bookings hold the vehicle's key as it was when they were made (older ones use earlier spellings of it)
  const next = new Map<string, string>();
  for (const b of booked) {
    const key = normalizeVehicleKey(b.vehicle) ?? b.vehicle;
    if (!key || !b.next) continue;
    const have = next.get(key);
    if (!have || b.next < have) next.set(key, b.next);
  }
  return all.map((v) => ({ id: v.id, name: v.name, available: v.status === "available", nextAt: next.get(normalizeVehicleKey(v.id) ?? v.id) ?? null, batterySoC: v.batterySoC, rangeKm: v.evRangeKm }));
});

/** Finished bookings, newest first. A booking that is still new stays in New Incoming Requests. */
export const recentRequests = cache(async (limit = 5) => {
  await requireAdmin();
  return db
    .select({ id: q.id, reference: q.reference, service: q.service, name: q.name, entity: q.entity, status: q.status, createdAt: q.createdAt })
    .from(q)
    .where(inArray(q.status, ["completed", "cancelled"]))
    .orderBy(desc(q.createdAt))
    .limit(limit);
});
