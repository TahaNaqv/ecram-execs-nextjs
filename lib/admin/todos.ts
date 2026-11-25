import "server-only";
import { connection } from "next/server";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { STOCKED_EXTRA_KEYS } from "@/lib/pricing/extras";

export type TodoItem = { href: string; title: string; detail: string };

const soon = () => {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 30);
  return day.toISOString().slice(0, 10);
};

/** Work the operations desk should see today. Amounts are not formatted here. */
export async function operationsTodos(): Promise<TodoItem[]> {
  await connection();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = soon();
  const items: TodoItem[] = [];

  const licences = await db
    .select({ name: schema.drivers.name, taxipas: schema.drivers.taxipasExpiry, vog: schema.drivers.vogExpiry })
    .from(schema.drivers)
    .where(and(eq(schema.drivers.active, true), sql`${schema.drivers.taxipasExpiry} <= ${horizon} or ${schema.drivers.vogExpiry} <= ${horizon}`))
    .limit(8);
  for (const row of licences) {
    items.push({ href: "/admin/drivers", title: `Licence due: ${row.name}`, detail: `Chauffeur card ${row.taxipas ?? "—"} · VOG ${row.vog ?? "—"}` });
  }

  const cars = await db
    .select({ name: schema.vehicles.name, plate: schema.vehicles.licensePlate, apk: schema.vehicles.apkExpiry, insurance: schema.vehicles.insuranceExpiry })
    .from(schema.vehicles)
    .where(sql`${schema.vehicles.apkExpiry} <= ${horizon} or ${schema.vehicles.insuranceExpiry} <= ${horizon}`)
    .limit(8);
  for (const car of cars) {
    items.push({ href: "/admin/vehicles", title: `Vehicle due: ${car.name}`, detail: `${car.plate ?? "no plate"} · APK ${car.apk ?? "—"} · insurance ${car.insurance ?? "—"}` });
  }

  const [unpaid] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.quoteRequests)
    .where(and(eq(schema.quoteRequests.status, "confirmed"), sql`coalesce(${schema.quoteRequests.paymentStatus}, 'OPEN') <> 'PAID'`));
  if ((unpaid?.n ?? 0) > 0) items.push({ href: "/admin/financials", title: "Unpaid confirmed bookings", detail: `${unpaid?.n} still not marked paid` });

  const [unread] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.bookingMessages)
    .where(and(eq(schema.bookingMessages.authorKind, "guest"), isNull(schema.bookingMessages.seenByTeamAt)));
  if ((unread?.n ?? 0) > 0) items.push({ href: "/admin/requests", title: "Unread guest messages", detail: `${unread?.n} waiting` });

  const stock = await db.select().from(schema.addonStock);
  for (const row of stock) {
    if (row.onHand < 5) items.push({ href: "/admin/addons", title: `Low stock: ${row.key}`, detail: `${row.onHand} on hand, below 5` });
  }
  const known = new Set(stock.map((row) => row.key));
  for (const key of STOCKED_EXTRA_KEYS) {
    if (!known.has(key)) items.push({ href: "/admin/addons", title: `Stock not set: ${key}`, detail: "Set a count before the next booking" });
  }

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);
  const rides = await db
    .select({ extras: schema.quoteRequests.extras, pickupAt: schema.quoteRequests.pickupAt, reference: schema.quoteRequests.reference })
    .from(schema.quoteRequests)
    .where(and(gte(schema.quoteRequests.pickupAt, today), lt(schema.quoteRequests.pickupAt, `${tomorrowKey}T23:59:59`), sql`${schema.quoteRequests.status} in ('confirmed', 'quoted', 'new')`))
    .limit(40);
  const flowersTomorrow = rides.filter((ride) => (ride.extras ?? []).some((extra) => extra.key === "flowers") && (ride.pickupAt ?? "").slice(0, 10) === tomorrowKey);
  const papersToday = rides.filter((ride) => (ride.extras ?? []).some((extra) => extra.key === "newspapers") && (ride.pickupAt ?? "").slice(0, 10) === today);
  if (flowersTomorrow.length) items.push({ href: "/admin/addons", title: "Order flowers for tomorrow", detail: flowersTomorrow.map((ride) => ride.reference).join(", ") });
  if (papersToday.length) items.push({ href: "/admin/addons", title: "Collect newspapers this morning", detail: papersToday.map((ride) => ride.reference).join(", ") });

  return items;
}
