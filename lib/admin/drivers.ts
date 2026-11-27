import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { driverCompliance, type AccountStatus } from "@/lib/drivers/compliance";
import { complianceColumns, ownVehiclesByDriver } from "@/lib/drivers/dispatch";
import { amsterdamToday } from "@/lib/drivers/time";

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
  const found = await db
    .select({
      ...complianceColumns,
      phone: d.phone,
      partner: d.partner,
      vehicle: d.vehicle,
      shiftStartedAt: s.startedAt,
    })
    .from(d)
    .leftJoin(s, and(eq(s.driverId, d.id), isNull(s.endedAt)))
    .orderBy(desc(d.active), asc(d.name));
  // Each driver's standing (lib/drivers/compliance.ts): the board shows it, and the link form says who cannot be linked
  const own = await ownVehiclesByDriver(found.map((row) => row.id));
  const today = amsterdamToday();
  const rows = found.map((row) => {
    const standing = driverCompliance(row, own.get(row.id) ?? [], today);
    const status: AccountStatus = standing.status;
    return { id: row.id, name: row.name, phone: row.phone, partner: row.driverType === "freelance", vehicle: row.vehicle, active: row.active, shiftStartedAt: row.shiftStartedAt, status, nextDue: standing.dueSoon[0] ?? null };
  });
  const onShift = rows.filter((r) => r.active && r.shiftStartedAt);
  onShift.sort((a, b) => a.shiftStartedAt!.getTime() - b.shiftStartedAt!.getTime());
  return {
    onShift,
    offShift: rows.filter((r) => r.active && !r.shiftStartedAt),
    archived: rows.filter((r) => !r.active),
  };
}
