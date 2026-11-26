import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Price } from "@/lib/pricing/rates";
import { amsterdamToday } from "@/lib/drivers/time";
import { commissionBasisPoints, nextRateChange } from "./commission";

export type IntroducerRow = {
  id: string;
  name: string;
  email: string | null;
  /** YYYY-MM-DD; the tenure schedule counts from here */
  startDate: string;
  /** Today's rate under the schedule, in basis points (250 = 2.5%) */
  rateBp: number;
  /** When the rate next steps down, or null once it is locked at 0.5% */
  nextChange: { on: string; basisPoints: number } | null;
  active: boolean;
  lastInvoiceRequestedAt: Date | null;
  partners: { id: string; name: string }[];
  /** This calendar month, euro cents, excluding the 9% ride VAT. */
  monthNetCents: number;
  monthCommissionCents: number;
};

export async function introducerBoard(): Promise<IntroducerRow[]> {
  const people = await db.select().from(schema.introducers).orderBy(schema.introducers.name);
  const partners = await db
    .select({
      id: schema.corporateContacts.id,
      company: schema.corporateContacts.companyName,
      name: schema.corporateContacts.name,
      introducerId: schema.corporateContacts.introducerId,
    })
    .from(schema.corporateContacts)
    .where(sql`${schema.corporateContacts.introducerId} is not null`);

  const paid = await db
    .select({
      requestId: schema.quoteRequests.id,
      contactId: schema.quoteRequests.corporateContactId,
      amountCents: schema.payments.amountCents,
      paidAt: schema.payments.paidAt,
    })
    .from(schema.payments)
    .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.payments.requestId))
    .where(
      and(
        eq(schema.payments.status, "paid"),
        eq(schema.quoteRequests.status, "completed"),
        isNotNull(schema.quoteRequests.corporateContactId),
        sql`${schema.payments.paidAt} >= date_trunc('month', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam'`,
      ),
    );

  // Each payment earns the rate of the day it was received, so a month that spans an anniversary is split correctly
  const byContact = new Map<string, { paidAt: Date | null; netCents: number }[]>();
  for (const row of paid) {
    if (!row.contactId) continue;
    const list = byContact.get(row.contactId) ?? [];
    list.push({ paidAt: row.paidAt, netCents: netExcludingRideVat(null, row.amountCents) });
    byContact.set(row.contactId, list);
  }

  const today = amsterdamToday();
  return people.map((person) => {
    const startDate = person.startDate ?? amsterdamToday(person.createdAt);
    const mine = partners.filter((partner) => partner.introducerId === person.id);
    const payments = mine.flatMap((partner) => byContact.get(partner.id) ?? []);
    const monthNetCents = payments.reduce((sum, payment) => sum + payment.netCents, 0);
    const commissionTimes10k = payments.reduce(
      (sum, payment) => sum + payment.netCents * commissionBasisPoints(startDate, amsterdamToday(payment.paidAt ?? new Date())),
      0,
    );
    return {
      id: person.id,
      name: person.name,
      email: person.email,
      startDate,
      rateBp: commissionBasisPoints(startDate, today),
      nextChange: nextRateChange(startDate, today),
      active: person.active,
      lastInvoiceRequestedAt: person.lastInvoiceRequestedAt,
      partners: mine.map((partner) => ({ id: partner.id, name: partner.company || partner.name })),
      monthNetCents,
      monthCommissionCents: Math.round(commissionTimes10k / 10_000),
    };
  });
}

/** Net of the 9% VAT: gross received this month divided by 1.09. */
function netExcludingRideVat(_price: Price | null, paidCents: number): number {
  return Math.round(paidCents / 1.09);
}
