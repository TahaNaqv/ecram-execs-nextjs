import "server-only";
import { connection } from "next/server";
import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { STOCKED_EXTRA_KEYS } from "@/lib/pricing/extras";
import { moneybirdConfigured } from "@/lib/moneybird/config";
import { invoiceWorkflows } from "@/lib/moneybird/client";
import { COMPLIANCE_LABELS, driverCompliance } from "@/lib/drivers/compliance";
import { complianceColumns, ownVehiclesByDriver } from "@/lib/drivers/dispatch";
import { amsterdamToday } from "@/lib/drivers/time";

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

  // Driver documents (lib/drivers/compliance.ts): expired ones suspend the driver, the rest show 60, 30 and 7 days ahead
  const people = await db.select(complianceColumns).from(schema.drivers).where(eq(schema.drivers.active, true));
  const own = await ownVehiclesByDriver(people.map((p) => p.id));
  const amsterdam = amsterdamToday();
  const driverTodos: (TodoItem & { rank: number })[] = [];
  const label = (e: { key: string; vehicleLabel?: string }) => `${COMPLIANCE_LABELS[e.key as keyof typeof COMPLIANCE_LABELS] ?? e.key}${e.vehicleLabel ? ` (${e.vehicleLabel})` : ""}`;
  for (const person of people) {
    const standing = driverCompliance(person, own.get(person.id) ?? [], amsterdam);
    if (standing.expired.length > 0) {
      driverTodos.push({ rank: -1, href: `/admin/drivers/${person.id}`, title: `Driver suspended: ${person.name}`, detail: standing.expired.map((e) => `${label(e)} expired ${e.date}`).join(" · ") });
    } else if (standing.dueSoon.length > 0) {
      driverTodos.push({ rank: standing.dueSoon[0].days, href: `/admin/drivers/${person.id}`, title: `Licence due: ${person.name}`, detail: standing.dueSoon.map((e) => `${label(e)} ${e.date} (${e.days} days)`).join(" · ") });
    }
  }
  // Suspended first, then the nearest expiry
  driverTodos.sort((a, b) => a.rank - b.rank);
  for (const item of driverTodos.slice(0, 8)) items.push({ href: item.href, title: item.title, detail: item.detail });

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

  // Close protection added after booking (lib/admin/charges.ts) that needs the team in Moneybird
  const cpReissue = await db.execute<{ id: string; reference: string }>(sql`
    select distinct r.id, r.reference from booking_charges c
    join quote_requests r on r.id = c.request_id
    join moneybird_invoices i on i.request_id = r.id and i.kind = 'invoice' and i.credited_at is null and i.number is not null
    where c.billing = 'balance' and c.status = 'active' and i.sent_at < c.created_at and r.status in ('confirmed', 'completed')
    limit 8`);
  for (const row of cpReissue) {
    items.push({ href: `/admin/requests/${row.id}`, title: `Reissue the invoice: ${row.reference}`, detail: "Close protection was added after its invoice was sent; Reissue makes the balance include it" });
  }
  const cpCredit = await db.execute<{ id: string; reference: string; number: string }>(sql`
    select r.id, r.reference, c.invoice_number as number from booking_charges c
    join quote_requests r on r.id = c.request_id
    where c.billing = 'separate' and c.status = 'active' and c.invoice_number is not null and c.paid_at is null
      and (r.status = 'cancelled' or r.declined_at is not null)
    limit 8`);
  for (const row of cpCredit) {
    items.push({ href: `/admin/requests/${row.id}`, title: `Credit close protection: ${row.reference}`, detail: `The booking is cancelled but invoice ${row.number} is still open in Moneybird` });
  }
  const cpFailed = await db.execute<{ id: string; reference: string }>(sql`
    select r.id, r.reference from booking_charges c
    join quote_requests r on r.id = c.request_id
    where c.billing = 'separate' and c.status = 'active' and c.invoice_state = 'failed' and r.status in ('confirmed', 'completed')
    limit 8`);
  for (const row of cpFailed) {
    items.push({ href: `/admin/requests/${row.id}`, title: `Close-protection invoice failed: ${row.reference}`, detail: "Moneybird did not take it; the reason is on the booking" });
  }

  // Moneybird writes its invoice page and its own email block in the workflow's language. Without an English workflow
  // every invoice, English bookings included, goes out with Dutch words ("Factuur", "Bekijk factuur").
  if (moneybirdConfigured()) {
    // Never hold the dashboard up for Moneybird: no answer within 2 seconds, no to-do this time
    const workflows = await Promise.race([invoiceWorkflows().catch(() => null), new Promise<null>((done) => setTimeout(() => done(null), 2000))]);
    if (workflows && !workflows.en) {
      items.push({
        href: "/admin/financials",
        title: "Moneybird has no English invoice workflow",
        detail: "Invoices and their emails go out in Dutch. In Moneybird: Settings → Workflows → new invoice workflow in English (with an English email template)",
      });
    }
  }

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
