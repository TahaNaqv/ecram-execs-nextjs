import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { centsFromMoney, moneybird, moneyFromCents, MoneybirdError } from "./client";
import { moneybirdConfig } from "./config";
import { fromInvoice, getInvoice, isSent, lease, liveInvoice, release } from "./sync";

/**
 * Online payments (lib/mollie) in the books: a payment the customer made is recorded on the booking's Moneybird invoice,
 * and a refund on its credit invoice, each exactly once. Moneybird has no idempotency key, so every write is checked
 * against the invoice's own payments first (by Mollie's transaction id), under the invoice row's lease.
 *
 * Recorded as a payment "without proof": the client's Moneybird has no bank or Mollie account connected (14 Nov 2026).
 * When the accountant connects Mollie in Moneybird (which then matches payments itself), set MOLLIE_MONEYBIRD_RECORD=off.
 */

type MbPayment = { transaction_identifier?: string | null; price?: string };
type Outcome = "done" | "off" | "no_invoice" | "busy" | "failed";

export { recordingOn } from "./recording";
import { recordingOn } from "./recording";

const amsterdamDate = (at: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);

/** The live invoice's open amount, asked of Moneybird now (the sweep's copy can be ten minutes old). Null without one. */
export async function invoiceOpenCents(requestId: string): Promise<number | null> {
  if (!moneybirdConfig()) return null;
  const live = await liveInvoice(requestId);
  if (!live || !isSent(live) || !live.moneybirdId) return null;
  const inv = await getInvoice(live.moneybirdId);
  return inv ? centsFromMoney(inv.total_unpaid) : null;
}

async function recordOn(rowId: string, moneybirdId: string, cents: number, at: Date, transactionId: string): Promise<Outcome> {
  try {
    const inv = await getInvoice(moneybirdId);
    if (!inv) {
      await release(rowId);
      return "no_invoice";
    }
    const known = ((inv as unknown as { payments?: MbPayment[] }).payments ?? []).some((p) => p.transaction_identifier === transactionId);
    if (!known) {
      await moneybird("POST", `sales_invoices/${moneybirdId}/payments.json`, {
        payment: {
          payment_date: amsterdamDate(at),
          price: moneyFromCents(cents),
          transaction_identifier: transactionId,
          manual_payment_action: "payment_without_proof",
        },
      });
    }
    const fresh = await getInvoice(moneybirdId);
    await release(rowId, fresh ? { ...fromInvoice(fresh), lastError: null } : {});
    return "done";
  } catch (err) {
    console.error(`[moneybird] recording ${transactionId} failed:`, err instanceof Error ? err.message : err);
    await release(rowId, { lastError: err instanceof MoneybirdError ? err.message.slice(0, 500) : "recording a payment failed" });
    return "failed";
  }
}

/** Records a customer's payment on the booking's invoice. "no_invoice" when there is none (yet): the sweep tries again. */
export async function recordPayment(requestId: string, cents: number, paidAt: Date, transactionId: string): Promise<Outcome> {
  if (!recordingOn()) return "off";
  const live = await liveInvoice(requestId);
  if (!live || !isSent(live) || !live.moneybirdId) return "no_invoice";
  if (!(await lease(live.id))) return "busy";
  return recordOn(live.id, live.moneybirdId, cents, paidAt, transactionId);
}

/** Records a refund on the credit invoice that gave the money back (a negative payment settles it). */
export async function recordRefund(requestId: string, cents: number, at: Date, transactionId: string): Promise<Outcome> {
  if (!recordingOn()) return "off";
  const t = schema.moneybirdInvoices;
  const [credit] = await db
    .select()
    .from(t)
    .where(and(eq(t.requestId, requestId), eq(t.kind, "credit"), isNotNull(t.number)))
    .orderBy(desc(t.createdAt))
    .limit(1);
  if (!credit?.moneybirdId) return "no_invoice";
  if (!(await lease(credit.id))) return "busy";
  return recordOn(credit.id, credit.moneybirdId, -cents, at, transactionId);
}
