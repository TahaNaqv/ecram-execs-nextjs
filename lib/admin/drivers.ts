import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

const { drivers: d, driverShifts: s } = schema;

/** Drivers with their open shift (if any), on-shift drivers first. */
export async function listDrivers() {
  await requireAdmin();
  await db
    .update(s)
    .set({ endedAt: sql`least(now(), ${s.startedAt} + interval '10 hours')`, status: "auto_closed" })
    .where(and(isNull(s.endedAt), sql`${s.startedAt} <= now() - interval '10 hours'`));
  await db
    .update(s)
    .set({
      status: sql`case when ${s.endedAt} >= ${s.startedAt} + interval '10 hours' - interval '1 minute' then 'auto_closed' else 'completed' end`,
    })
    .where(and(sql`${s.endedAt} is not null`, eq(s.status, "active")));
  const rows = await db
    .select({
      id: d.id,
      name: d.name,
      phone: d.phone,
      partner: d.partner,
      vehicle: d.vehicle,
      active: d.active,
      shiftStartedAt: s.startedAt,
    })
    .from(d)
    .leftJoin(s, and(eq(s.driverId, d.id), isNull(s.endedAt)))
    .orderBy(desc(d.active), asc(d.name));
  const onShift = rows.filter((r) => r.active && r.shiftStartedAt);
  onShift.sort((a, b) => a.shiftStartedAt!.getTime() - b.shiftStartedAt!.getTime());
  return {
    onShift,
    offShift: rows.filter((r) => r.active && !r.shiftStartedAt),
    archived: rows.filter((r) => !r.active),
  };
}
