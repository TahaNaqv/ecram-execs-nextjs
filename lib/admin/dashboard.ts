import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { cache } from "react";
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

export type DashboardFigures = {
  fleet: { available: number; total: number };
  /** Confirmed and completed bookings with a pick-up or a return today, and the time of the next confirmed one still to come today */
  jobs: { today: number; nextAt: string | null };
  /** Partner accounts (a password has been chosen), and those that signed in during the last 30 days */
  partners: { total: number; recent: number };
  /** Confirmed and completed bookings whose pick-up is in the current month, at the amounts quoted: trips, not payments received (one without a quote adds nothing; a bespoke one has no pick-up and is not counted) */
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
      .where(
        and(
          // Completed counts too: a trip marked done at noon is still one of today's jobs
          inArray(q.status, ["confirmed", "completed"]),
          sql`(${q.pickupAt}::date = ${NOW}::date or ${q.returnAt}::date = ${NOW}::date)`,
        ),
      ),
    db
      .select({
        total: sql<number>`count(*) filter (where ${contacts.passwordHash} is not null)`.mapWith(Number),
        recent: sql<number>`count(*) filter (where ${contacts.passwordHash} is not null and ${contacts.lastLoginAt} > now() - interval '30 days')`.mapWith(Number),
      })
      .from(contacts),
    db
      .select({
        amount: sql<string>`coalesce(sum(${q.quotedAmount}), 0)`,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(q)
      .where(
        and(
          inArray(q.status, ["confirmed", "completed"]),
          isNotNull(q.pickupAt),
          sql`date_trunc('month', ${q.pickupAt}) = date_trunc('month', ${NOW})`,
        ),
      ),
  ]);

  const now = amsterdamNow();
  const today = now.slice(0, 10);
  // The next one is the next that is still to happen: a trip already marked completed is not
  const times = todays.filter((r) => r.status === "confirmed").flatMap((r) => [r.pickupAt, r.returnAt]).filter((t): t is string => !!t).map(minutes).filter((t) => t.startsWith(today) && t >= now);
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

/** The confirmed bookings still to come, soonest first. */
export const upcomingPickups = cache(async (limit = 6): Promise<UpcomingPickup[]> => {
  await requireAdmin();
  const rows = await db
    .select()
    .from(q)
    .where(and(eq(q.status, "confirmed"), isNotNull(q.pickupAt), sql`greatest(${q.pickupAt}, ${q.returnAt}) >= ${NOW}`))
    .orderBy(sql`case when ${q.pickupAt} >= ${NOW} then ${q.pickupAt} else ${q.returnAt} end`, asc(q.createdAt))
    .limit(limit);
  const now = amsterdamNow();
  return rows.map((r) => {
    const isReturn = minutes(r.pickupAt!) < now && !!r.returnAt;
    return {
      id: r.id,
      reference: r.reference,
      at: isReturn ? r.returnAt! : r.pickupAt!,
      isReturn,
      // A return runs the other way round (an hourly booking has nowhere to return from: it is only the time)
      from: isReturn ? (r.destination ?? r.collection) : r.collection,
      to: isReturn ? (r.destination ? r.collection : null) : r.destination,
      durationHours: r.durationHours,
      name: r.name,
      entity: r.entity,
      vehicle: r.vehicle,
    };
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

/** The newest requests, newest first. */
export const recentRequests = cache(async (limit = 5) => {
  await requireAdmin();
  return db
    .select({ id: q.id, reference: q.reference, service: q.service, name: q.name, entity: q.entity, status: q.status, createdAt: q.createdAt })
    .from(q)
    .orderBy(desc(q.createdAt))
    .limit(limit);
});
