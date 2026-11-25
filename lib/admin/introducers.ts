import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Price } from "@/lib/pricing/rates";

export type IntroducerRow = {
  id: string;
  name: string;
  email: string | null;
  commissionPercent: number;
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
      price: schema.quoteRequests.priceEstimate,
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

  const byBooking = new Map<string, { contactId: string; paidCents: number; price: Price | null }>();
  for (const row of paid) {
    if (!row.contactId) continue;
    const current = byBooking.get(row.requestId) ?? { contactId: row.contactId, paidCents: 0, price: null };
    current.paidCents += row.amountCents;
    if (row.price && typeof row.price === "object" && "total" in row.price) current.price = row.price as Price;
    byBooking.set(row.requestId, current);
  }
  const netByContact = new Map<string, number>();
  for (const booking of byBooking.values()) {
    netByContact.set(booking.contactId, (netByContact.get(booking.contactId) ?? 0) + netExcludingRideVat(booking.price, booking.paidCents));
  }

  return people.map((person) => {
    const mine = partners.filter((partner) => partner.introducerId === person.id);
    const monthNetCents = mine.reduce((sum, partner) => sum + (netByContact.get(partner.id) ?? 0), 0);
    return {
      id: person.id,
      name: person.name,
      email: person.email,
      commissionPercent: person.commissionPercent,
      active: person.active,
      lastInvoiceRequestedAt: person.lastInvoiceRequestedAt,
      partners: mine.map((partner) => ({ id: partner.id, name: partner.company || partner.name })),
      monthNetCents,
      monthCommissionCents: Math.round((monthNetCents * person.commissionPercent) / 100),
    };
  });
}

/** Net of the 9% VAT: gross received this month divided by 1.09. */
function netExcludingRideVat(_price: Price | null, paidCents: number): number {
  return Math.round(paidCents / 1.09);
}
