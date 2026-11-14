import "server-only";
import { and, count, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { ACTIVE_STATUSES, REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";

const { quoteRequests: q, requestEvents: ev, adminUsers } = schema;
export const PAGE_SIZE = 10;

export type ListFilters = { status?: string; search?: string; page?: number; queue?: string };

export async function listRequests({ status, search, page = 1, queue }: ListFilters) {
  await requireAdmin();
  const where: SQL[] = [];
  if (status && (ACTIVE_STATUSES as readonly string[]).includes(status)) {
    where.push(eq(q.status, status as RequestStatus));
  }
  // Same rule as isCorporateBooking (lib/quotes/audience.ts): a partner account, the partner portal or site, or the corporate rate card.
  // A company name on a public booking, and a private occasion, stay in the standard stream.
  const corporate = or(
    isNotNull(q.corporateContactId),
    inArray(q.source, ["portal", "website-corporate"]),
    sql`${q.priceEstimate}->>'segment' = 'corporate'`,
  )!;
  if (queue === "corporate") {
    where.push(corporate);
  } else if (queue === "standard") {
    where.push(sql`not (${corporate})`);
  }
  if (search) {
    const term = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(
      or(
        ilike(q.reference, term),
        ilike(q.name, term),
        ilike(q.email, term),
        ilike(q.phone, term),
        ilike(q.collection, term),
        ilike(q.destination, term),
      )!,
    );
  }
  const filter = where.length ? and(...where) : undefined;
  const [rows, [counted]] = await Promise.all([
    db
      .select()
      .from(q)
      .where(filter)
      // In ride order, the latest ride first (the client, 15 Nov 2026: the list read as out of order when it was sorted by
      // when each booking came in). A request with no date yet (a bespoke programme) comes last, newest first.
      .orderBy(sql`${q.pickupAt} desc nulls last`, desc(q.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(q).where(filter),
  ]);
  return { rows, total: counted?.total ?? 0 };
}

export const statusCounts = cache(async () => {
  await requireAdmin();
  const rows = await db.select({ status: q.status, n: count() }).from(q).groupBy(q.status);
  const counts = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<RequestStatus, number>;
  for (const r of rows) counts[r.status] = r.n;
  return counts;
});

/**
 * The same euros as bookingTotalEuros (lib/pricing/rates.ts). The amount stored on the row wins
 * (the VAT-inclusive total, or a final the team later overrode). The rate-card snapshot is used only
 * when that amount is missing. Aggregates add this figure; they do not add the rate-card lines again.
 */
export const bookingEuros = () => sql`coalesce(
  case when ${q.quotedAmount} is not null then round(${q.quotedAmount}, 2) end,
  case
    when ${q.priceEstimate} is not null and (${q.priceEstimate}->>'total') ~ '^[0-9]+(\\.[0-9]+)?$'
    then round((${q.priceEstimate}->>'total')::numeric / 100, 2)
  end,
  0
)`;

/** Headline figures for the requests dashboard. */
export async function requestStats() {
  await requireAdmin();
  const [row] = await db
    .select({
      // Confirmed and completed bookings whose pick-up is in the current Amsterdam month
      monthAmount: sql<string>`coalesce(round(sum(${bookingEuros()}) filter (where ${q.status} in ('confirmed', 'completed') and ${q.pickupAt} is not null and date_trunc('month', ${q.pickupAt}) = date_trunc('month', (now() at time zone 'Europe/Amsterdam'))), 2), 0)`,
      monthCount: sql<number>`count(*) filter (where ${q.status} in ('confirmed', 'completed') and ${q.pickupAt} is not null and date_trunc('month', ${q.pickupAt}) = date_trunc('month', (now() at time zone 'Europe/Amsterdam')))`.mapWith(Number),
      // The same bookings the upcoming count includes, at the same final amount each row shows. Past and cancelled trips are not in this sum.
      confirmedValue: sql<string>`coalesce(round(sum(${bookingEuros()}) filter (where ${q.status} = 'confirmed' and greatest(${q.pickupAt}, ${q.returnAt}) >= (now() at time zone 'Europe/Amsterdam')), 2), 0)`,
      // A booking with a return journey is still upcoming until its return (greatest() skips a null return_at)
      upcoming: sql<number>`count(*) filter (where ${q.status} = 'confirmed' and greatest(${q.pickupAt}, ${q.returnAt}) >= (now() at time zone 'Europe/Amsterdam'))`.mapWith(Number),
      next7: sql<number>`count(*) filter (where ${q.status} = 'confirmed' and (
        (${q.pickupAt} >= (now() at time zone 'Europe/Amsterdam') and ${q.pickupAt} < (now() at time zone 'Europe/Amsterdam') + interval '7 days')
        or (${q.returnAt} >= (now() at time zone 'Europe/Amsterdam') and ${q.returnAt} < (now() at time zone 'Europe/Amsterdam') + interval '7 days')))`.mapWith(Number),
      last24h: sql<number>`count(*) filter (where ${q.status} <> 'cancelled' and ${q.createdAt} > now() - interval '24 hours')`.mapWith(Number),
    })
    .from(q);
  return row;
}

export async function getRequest(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [request] = await db.select().from(q).where(eq(q.id, id)).limit(1);
  if (!request) return null;
  const events = await db
    .select({ id: ev.id, event: ev.event, params: ev.params, createdAt: ev.createdAt, by: adminUsers.name })
    .from(ev)
    .leftJoin(adminUsers, eq(adminUsers.id, ev.adminId))
    .where(eq(ev.requestId, id))
    .orderBy(desc(ev.createdAt));
  return { request, events };
}
