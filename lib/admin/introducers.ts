import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { priceNet, type Price } from "@/lib/pricing/rates";

export type IntroducerRow = {
  id: string;
  name: string;
  email: string | null;
  commissionPercent: number;
  active: boolean;
  partners: { id: string; name: string }[];
  /** This calendar month, euro cents, excluding VAT. */
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

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const paid = await db
    .select({
      contactId: schema.quoteRequests.corporateContactId,
      amountCents: schema.payments.amountCents,
      price: schema.quoteRequests.priceEstimate,
    })
    .from(schema.payments)
    .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.payments.requestId))
    .where(and(eq(schema.payments.status, "paid"), gte(schema.payments.paidAt, monthStart), sql`${schema.quoteRequests.corporateContactId} is not null`));

  const netByContact = new Map<string, number>();
  for (const row of paid) {
    if (!row.contactId) continue;
    const fromPrice = row.price && typeof row.price === "object" && "total" in row.price ? Math.round(priceNet(row.price as Price) * 100) : null;
    const net = fromPrice ?? Math.round(row.amountCents / 1.21);
    netByContact.set(row.contactId, (netByContact.get(row.contactId) ?? 0) + net);
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
      partners: mine.map((partner) => ({ id: partner.id, name: partner.company || partner.name })),
      monthNetCents,
      monthCommissionCents: Math.round((monthNetCents * person.commissionPercent) / 100),
    };
  });
}
