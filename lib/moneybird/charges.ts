import "server-only";
import { and, asc, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CORPORATE_TERM_DAYS, amsterdamToday } from "@/lib/admin/financials-shared";
import { spokenLocale } from "@/lib/i18n/config";
import { isCorporateBooking } from "@/lib/quotes/audience";
import { formatCurrency } from "@/lib/pricing/rates";
import { centsFromMoney, invoiceWorkflows, moneybird, moneyFromCents, salesTaxRates, type MoneybirdSalesInvoice } from "./client";
import { moneybirdConfig } from "./config";
import { dueInDays } from "./invoice";
import { billingComplete, deleteDraft, describeError, ensureContact, getInvoice, isSent, send } from "./sync";
import { INVOICE_MAIL } from "./words";

/**
 * A charge added after booking that is collected on its own (close protection within 30 days of the ride, or on a booking
 * already paid: lib/payments/charges.ts "separate") gets its own Moneybird invoice, reference EE-XXXXXX-CP1, -CP2, …,
 * sent by email like the booking's invoice; the customer pays it from there. Kept apart from the booking's own invoice
 * (lib/moneybird/sync.ts), which it never changes. The cron sweep (refreshChargeInvoices) retries one that failed and
 * reads paid states back.
 */

const c = schema.bookingCharges;

export type ChargeResult = { status: "off" | "done" | "busy" | "failed" | "skipped"; error?: string };

/** Makes and sends the charge's invoice, once. */
export async function issueChargeInvoice(chargeId: string): Promise<ChargeResult> {
  const config = moneybirdConfig();
  if (!config) return { status: "off" };
  // Claimed by one run at a time (invoice_state "claimed"); a claim older than ten minutes was a run that stopped
  const [charge] = await db
    .update(c)
    .set({ invoiceState: "claimed", claimedAt: new Date(), lastError: null })
    .where(
      and(
        eq(c.id, chargeId),
        eq(c.billing, "separate"),
        eq(c.status, "active"),
        isNull(c.invoiceNumber),
        or(isNull(c.invoiceState), eq(c.invoiceState, "failed"), and(eq(c.invoiceState, "claimed"), lt(c.claimedAt, sql`now() - interval '10 minutes'`))),
      ),
    )
    .returning();
  if (!charge) return { status: "busy" };

  const fail = async (error: string): Promise<ChargeResult> => {
    await db.update(c).set({ invoiceState: "failed", lastError: error.slice(0, 500) }).where(eq(c.id, chargeId));
    return { status: "failed", error };
  };

  try {
    const [r] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, charge.requestId)).limit(1);
    if (!r) return fail("booking_missing");
    // Invoiced once the booking is confirmed, as its own invoice is (the cron picks it up then)
    if (r.status !== "confirmed" && r.status !== "completed") {
      await db.update(c).set({ invoiceState: null }).where(eq(c.id, chargeId));
      return { status: "skipped" };
    }
    const [partner] = r.corporateContactId
      ? await db.select().from(schema.corporateContacts).where(eq(schema.corporateContacts.id, r.corporateContactId)).limit(1)
      : [];
    if (partner && !billingComplete(partner)) return fail("billing_missing");

    const locale = spokenLocale(r.locale);
    const [rates, workflows, earlier] = await Promise.all([
      salesTaxRates(),
      invoiceWorkflows().catch(() => null),
      db
        .select({ id: c.id })
        .from(c)
        .where(and(eq(c.requestId, r.id), eq(c.billing, "separate"), lt(c.createdAt, charge.createdAt))),
    ]);
    const workflowId = workflows?.[locale];
    const reference = `${r.reference}-CP${earlier.length + 1}`;
    let inv: MoneybirdSalesInvoice | null = charge.moneybirdId ? await getInvoice(charge.moneybirdId) : null;
    // Sent by a run that stopped before it could record that: record it, never send it twice
    if (inv && isSent({ number: inv.invoice_id, sentAt: null, state: inv.state })) {
      await db
        .update(c)
        .set({ invoiceNumber: inv.invoice_id ?? null, invoiceState: inv.state ?? "open", invoiceUrl: inv.url ?? null, invoicedAt: new Date(), lastError: null })
        .where(eq(c.id, chargeId));
      return { status: "done" };
    }
    if (inv && centsFromMoney(inv.total_price_incl_tax) !== charge.amountCents && !isSent({ number: inv.invoice_id, sentAt: null, state: inv.state })) {
      await deleteDraft(String(inv.id));
      inv = null;
    }
    if (!inv) {
      const contactId = await ensureContact(r, partner ?? null, workflowId);
      const corporate = Boolean(partner) || isCorporateBooking(r);
      inv = await moneybird<MoneybirdSalesInvoice>("POST", "sales_invoices.json", {
        sales_invoice: {
          contact_id: contactId,
          reference,
          currency: "EUR",
          prices_are_incl_tax: true,
          first_due_interval: dueInDays(corporate, r.pickupAt, amsterdamToday(), CORPORATE_TERM_DAYS),
          language: locale,
          ...(workflowId ? { workflow_id: workflowId } : {}),
          details_attributes: [
            {
              description: `${r.reference} · ${charge.description}`,
              price: moneyFromCents(charge.amountCents),
              amount: "1",
              tax_rate_id: charge.vatBasisPoints === 900 ? rates.low : rates.high,
              ledger_account_id: config.ledgerExtras,
            },
          ],
        },
      });
      await db.update(c).set({ moneybirdId: String(inv.id) }).where(eq(c.id, chargeId));
    }
    if (centsFromMoney(inv.total_price_incl_tax) !== charge.amountCents) return fail(`total_mismatch: Moneybird ${inv.total_price_incl_tax}`);

    // Cancelled while the invoice was being made: it is not sent
    const [now] = await db.select({ status: c.status }).from(c).where(eq(c.id, chargeId)).limit(1);
    if (now?.status !== "active") {
      await deleteDraft(String(inv.id));
      await db.update(c).set({ moneybirdId: null, invoiceState: null }).where(eq(c.id, chargeId));
      return { status: "skipped" };
    }

    const mail = INVOICE_MAIL[locale];
    const who = partner?.name || r.name;
    const message = [mail.greeting(who), "", mail.intro, "", `${mail.reference}: ${r.reference}`, `${charge.description}: ${formatCurrency(charge.amountCents / 100)}`].join("\n");
    const to = partner ? partner.invoiceEmail || partner.email : r.email;
    const sent = await send(inv, "Email", to, message);
    await db
      .update(c)
      .set({
        invoiceNumber: sent.invoice_id ?? null,
        invoiceState: sent.state ?? "open",
        invoiceUrl: sent.url ?? null,
        invoicedAt: new Date(),
        lastError: null,
      })
      .where(eq(c.id, chargeId));
    await db.insert(schema.requestEvents).values({ requestId: r.id, adminId: null, event: "mb_invoice", params: { number: sent.invoice_id ?? undefined } });
    return { status: "done" };
  } catch (err) {
    const error = describeError(err);
    console.error(`[moneybird] close-protection invoice ${chargeId} failed:`, error);
    return fail(error);
  }
}

/** Takes back a separate charge's invoice that was never sent. False when it was sent: then it is credited in Moneybird. */
export async function withdrawChargeInvoice(charge: { moneybirdId: string | null; invoiceNumber: string | null }): Promise<boolean> {
  if (charge.invoiceNumber) return false;
  if (!charge.moneybirdId || !moneybirdConfig()) return true;
  const inv = await getInvoice(charge.moneybirdId);
  if (inv && isSent({ number: inv.invoice_id, sentAt: null, state: inv.state })) return false;
  if (inv) await deleteDraft(String(inv.id));
  return true;
}

/** The cron's share: invoices that failed or were never made are tried again, and sent ones' paid states read back. */
export async function refreshChargeInvoices(limit = 20): Promise<{ issued: number; refreshed: number }> {
  if (!moneybirdConfig()) return { issued: 0, refreshed: 0 };
  let issued = 0;
  let refreshed = 0;
  // Only bookings that are invoiced now; the ones tried longest ago first, so a lasting failure does not block the rest
  const waiting = await db
    .select({ id: c.id })
    .from(c)
    .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, c.requestId))
    .where(
      and(
        eq(c.billing, "separate"),
        eq(c.status, "active"),
        isNull(c.invoiceNumber),
        sql`${schema.quoteRequests.status} in ('confirmed', 'completed')`,
        sql`${c.createdAt} < now() - interval '2 minutes'`,
      ),
    )
    .orderBy(sql`${c.claimedAt} asc nulls first`, asc(c.createdAt))
    .limit(limit);
  for (const row of waiting) if ((await issueChargeInvoice(row.id)).status === "done") issued += 1;

  const open = await db
    .select({ id: c.id, moneybirdId: c.moneybirdId })
    .from(c)
    .where(and(eq(c.billing, "separate"), eq(c.status, "active"), isNotNull(c.invoiceNumber), isNotNull(c.moneybirdId), isNull(c.paidAt)))
    .orderBy(sql`${c.claimedAt} asc nulls first`)
    .limit(limit);
  for (const row of open) {
    try {
      const inv = await getInvoice(row.moneybirdId!);
      if (!inv) continue;
      await db
        .update(c)
        .set({ invoiceState: inv.state ?? null, claimedAt: new Date(), ...(inv.state === "paid" ? { paidAt: inv.paid_at ? new Date(inv.paid_at) : new Date() } : {}) })
        .where(eq(c.id, row.id));
      refreshed += 1;
    } catch (err) {
      console.error(`[moneybird] close-protection invoice ${row.id} could not be read:`, describeError(err));
    }
  }
  return { issued, refreshed };
}
