import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

const { drivers: d, driverShifts: s } = schema;

/** Drivers with their open shift (if any), on-shift drivers first. */
export async function listDrivers() {
  await requireAdmin();
  const rows = await db
    .select({ id: d.id, name: d.name, phone: d.phone, active: d.active, shiftStartedAt: s.startedAt })
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
