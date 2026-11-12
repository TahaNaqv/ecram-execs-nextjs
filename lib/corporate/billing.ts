import "server-only";
import { and, eq, inArray, isNull, like } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { syncAfterEach } from "@/lib/moneybird/after";

/**
 * A partner's billing details: the address a Dutch invoice to a company has to carry, an optional VAT number, and an
 * optional address for invoices other than the login email. The partner keeps them on the portal; the team can edit
 * them on the partner's billing page. Moneybird invoices a partner's booking only once street, postcode and city are in.
 */
export const billingSchema = z.object({
  street: z.string().trim().min(2).max(200),
  postcode: z.string().trim().min(2).max(20),
  city: z.string().trim().min(1).max(100),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("NL"),
  vatNumber: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9 .-]*$/)
    .optional()
    .transform((v) => (v ? v.replace(/[\s.-]/g, "").toUpperCase() : null)),
  invoiceEmail: z
    .union([z.literal(""), z.email().max(254)])
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null)),
});
export type BillingInput = z.output<typeof billingSchema>;
export type BillingField = keyof z.input<typeof billingSchema>;

export type BillingDetails = {
  street: string;
  postcode: string;
  city: string;
  country: string;
  vatNumber: string;
  invoiceEmail: string;
  complete: boolean;
};

const c = schema.corporateContacts;

export async function billingDetails(contactId: string): Promise<BillingDetails | null> {
  const [row] = await db
    .select({ street: c.billingStreet, postcode: c.billingPostcode, city: c.billingCity, country: c.billingCountry, vatNumber: c.vatNumber, invoiceEmail: c.invoiceEmail })
    .from(c)
    .where(eq(c.id, contactId))
    .limit(1);
  if (!row) return null;
  return {
    street: row.street ?? "",
    postcode: row.postcode ?? "",
    city: row.city ?? "",
    country: row.country || "NL",
    vatNumber: row.vatNumber ?? "",
    invoiceEmail: row.invoiceEmail ?? "",
    complete: Boolean(row.street?.trim() && row.postcode?.trim() && row.city?.trim()),
  };
}

/** Saves the details, then invoices the partner's confirmed bookings that were waiting on them. */
export async function saveBilling(contactId: string, input: BillingInput): Promise<boolean> {
  const [saved] = await db
    .update(c)
    .set({
      billingStreet: input.street,
      billingPostcode: input.postcode.toUpperCase(),
      billingCity: input.city,
      billingCountry: input.country,
      vatNumber: input.vatNumber,
      invoiceEmail: input.invoiceEmail,
      updatedAt: new Date(),
    })
    .where(eq(c.id, contactId))
    .returning({ id: c.id });
  if (!saved) return false;
  const waiting = await db
    .select({ id: schema.moneybirdInvoices.requestId })
    .from(schema.moneybirdInvoices)
    .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.moneybirdInvoices.requestId))
    .where(
      and(
        eq(schema.quoteRequests.corporateContactId, contactId),
        inArray(schema.quoteRequests.status, ["confirmed", "completed"]),
        eq(schema.moneybirdInvoices.kind, "invoice"),
        isNull(schema.moneybirdInvoices.creditedAt),
        like(schema.moneybirdInvoices.lastError, "billing_missing%"),
      ),
    );
  syncAfterEach(waiting.flatMap((row) => (row.id ? [row.id] : [])));
  return true;
}

/** Form fields to the schema's input (an empty optional field is left out). */
export function billingFromForm(formData: FormData) {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  return {
    street: get("street") ?? "",
    postcode: get("postcode") ?? "",
    city: get("city") ?? "",
    country: get("country") || "NL",
    vatNumber: get("vatNumber") || undefined,
    invoiceEmail: get("invoiceEmail") ?? "",
  };
}
