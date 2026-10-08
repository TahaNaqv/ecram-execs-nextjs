import "server-only";
import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";

const { quoteRequests: q, requestEvents: ev, adminUsers } = schema;
export const PAGE_SIZE = 25;

export type ListFilters = { status?: string; search?: string; page?: number };

export async function listRequests({ status, search, page = 1 }: ListFilters) {
  await requireAdmin();
  const where: SQL[] = [];
  if (status && (REQUEST_STATUSES as readonly string[]).includes(status)) {
    where.push(eq(q.status, status as RequestStatus));
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
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(q)
      .where(filter)
      .orderBy(desc(q.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(q).where(filter),
  ]);
  return { rows, total };
}

export async function statusCounts() {
  await requireAdmin();
  const rows = await db.select({ status: q.status, n: count() }).from(q).groupBy(q.status);
  const counts = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<RequestStatus, number>;
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export async function getRequest(id: string) {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [request] = await db.select().from(q).where(eq(q.id, id)).limit(1);
  if (!request) return null;
  const events = await db
    .select({ id: ev.id, message: ev.message, createdAt: ev.createdAt, by: adminUsers.name })
    .from(ev)
    .leftJoin(adminUsers, eq(adminUsers.id, ev.adminId))
    .where(eq(ev.requestId, id))
    .orderBy(desc(ev.createdAt));
  return { request, events };
}
