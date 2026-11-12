import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type CustomerInvoice = {
  id: string;
  kind: "invoice" | "credit";
  number: string;
  state: string;
  totalCents: number | null;
  /** Moneybird's own page for the invoice: view it, download the PDF, and pay it when the client has online payment on. */
  url: string | null;
  paymentUrl: string | null;
  /** "Manual": numbered without Moneybird emailing it (the team did not notify the customer). */
  delivery: string | null;
};

/** The booking's invoices as the customer may see them: only those Moneybird has sent (so they have a number), newest first. */
export async function customerInvoices(requestId: string): Promise<CustomerInvoice[]> {
  const t = schema.moneybirdInvoices;
  const rows = await db
    .select({ id: t.id, kind: t.kind, number: t.number, state: t.state, totalCents: t.totalCents, url: t.url, paymentUrl: t.paymentUrl, delivery: t.delivery })
    .from(t)
    .where(and(eq(t.requestId, requestId), isNotNull(t.number)))
    .orderBy(desc(t.createdAt))
    .catch((err) => {
      console.error("[moneybird] could not read the invoices for a customer page", err);
      return [];
    });
  return rows.map((row) => ({ ...row, number: row.number ?? "" }));
}

/** Open for payment: sent and not yet paid, credited or written off. */
export const payable = (inv: Pick<CustomerInvoice, "kind" | "state">) =>
  inv.kind === "invoice" && ["open", "late", "reminded", "pending_payment"].includes(inv.state);
