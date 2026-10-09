import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/partners/criteria";

const { driverApplications: a, adminUsers } = schema;

export async function listApplications(status?: string) {
  await requireAdmin();
  const valid = status && (APPLICATION_STATUSES as readonly string[]).includes(status);
  return db
    .select()
    .from(a)
    .where(valid ? eq(a.status, status as ApplicationStatus) : undefined)
    .orderBy(desc(a.createdAt))
    .limit(200);
}

export const applicationCounts = cache(async () => {
  await requireAdmin();
  const rows = await db.select({ status: a.status, n: count() }).from(a).groupBy(a.status);
  const counts = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const r of rows) counts[r.status] = r.n;
  return counts;
});

export async function getApplication(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ application: a, reviewer: adminUsers.name })
    .from(a)
    .leftJoin(adminUsers, eq(adminUsers.id, a.reviewedBy))
    .where(eq(a.id, id))
    .limit(1);
  return row ?? null;
}
