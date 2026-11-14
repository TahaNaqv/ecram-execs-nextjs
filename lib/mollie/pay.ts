import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emailPaymentReceived, notifyTeamChargeback, notifyTeamPaid } from "@/lib/email";
import { invoiceCents } from "@/lib/moneybird/invoice";
import { invoiceOpenCents, recordingOn, recordPayment, recordRefund } from "@/lib/moneybird/payments";
import { amountOf, centsOf, mollie, MollieError, type MolliePayment, type MollieRefund } from "./client";
import { mollieConfig, safeCheckoutUrl, webhookOrigin } from "./config";

/**
 * Paying for an approved booking through Mollie's own payment page (the client, 8 Nov 2026; built 14 Nov):
 * - what is due is worked out fresh: the Moneybird invoice's open amount asked of Moneybird now, less payments taken but
 *   not yet recorded there; without Moneybird, the booking's amount less what was paid;
 * - one payment at a time per booking (a database rule): a second click reuses the open one, or waits for it;
 * - our row is made first and its id is Mollie's Idempotency-Key, so a retry never opens a second payment;
 * - Mollie's word is the only truth: a webhook, the customer's return and the sweep all ask Mollie, never believe a caller;
 * - every row carries the key's mode (test or live), and only rows of the current mode are counted or swept.
 */

const p = schema.payments;
const rf = schema.refunds;
const LEASE_MINUTES = 2;
export const IN_PROGRESS = ["creating", "open", "pending", "authorized"] as const;
const REFUND_DONE = ["refunded", "failed", "canceled"] as const;

type Payment = typeof p.$inferSelect;
type Refund = typeof rf.$inferSelect;
export type StartResult =
  | { status: "redirect"; url: string }
  | { status: "in_progress" }
  | { status: "nothing_due" }
  | { status: "off" }
  | { status: "failed"; error: string };

const leaseFree = (claimedAt: typeof p.claimedAt | typeof rf.updatedAt) =>
  sql`(${claimedAt} is null or ${claimedAt} < now() - make_interval(mins => ${LEASE_MINUTES}))`;

async function lease(id: string): Promise<Payment | null> {
  const [row] = await db.update(p).set({ claimedAt: new Date() }).where(and(eq(p.id, id), leaseFree(p.claimedAt))).returning();
  return row ?? null;
}
const save = (id: string, patch: Partial<Payment>) => db.update(p).set({ ...patch, updatedAt: new Date() }).where(eq(p.id, id));
const release = (id: string, patch: Partial<Payment> = {}) => save(id, { ...patch, claimedAt: null });

const describe = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 500);

async function booking(requestId: string) {
  const [row] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, requestId)).limit(1);
  return row ?? null;
}

const payable = (status: string | null | undefined) => status === "confirmed" || status === "completed";

/** Paid, less refunded, by this booking's payments in the key's mode. */
async function paidNet(requestId: string, mode: "test" | "live", opts: { unrecordedOnly?: boolean } = {}): Promise<number> {
  const rows = await db
    .select({ amount: p.amountCents, refunded: p.refundedCents, chargedBack: p.chargedBackCents, recorded: p.moneybirdRegisteredAt })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, mode), eq(p.status, "paid")));
  return rows.filter((r) => !opts.unrecordedOnly || !r.recorded).reduce((sum, r) => sum + r.amount - r.refunded - r.chargedBack, 0);
}

/**
 * What the customer still has to pay for the booking, in cents (0 when nothing is due or it cannot be paid now). Throws
 * when Moneybird cannot be asked: the booking's full amount is never offered instead (it may be part-paid by transfer).
 */
export async function amountDue(requestId: string): Promise<number> {
  const config = mollieConfig();
  if (!config) return 0;
  const r = await booking(requestId);
  if (!r || !payable(r.status)) return 0;
  const open = await invoiceOpenCents(requestId);
  if (open != null) {
    // Paid online but not yet in Moneybird: already counted, or the invoice would be paid twice
    const pending = recordingOn() ? await paidNet(requestId, config.mode, { unrecordedOnly: true }) : await paidNet(requestId, config.mode);
    return Math.max(0, open - pending);
  }
  const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null }) ?? 0;
  return Math.max(0, total - (await paidNet(requestId, config.mode)));
}

function fromMollie(m: MolliePayment): Partial<Payment> {
  return {
    mollieId: m.id,
    status: m.status,
    method: m.method ?? null,
    checkoutUrl: m._links?.checkout?.href ?? null,
    dashboardUrl: m._links?.dashboard?.href ?? null,
    refundedCents: centsOf(m.amountRefunded),
    chargedBackCents: centsOf(m.amountChargedBack),
    paidAt: m.paidAt ? new Date(m.paidAt) : null,
  };
}

/** Asks Mollie for the payment again; on a fresh "paid", logs it, tells the team and the customer, and records it in Moneybird. */
export async function refreshPayment(id: string): Promise<{ status: string } | null> {
  const row = await lease(id);
  if (!row) return null;
  if (!row.mollieId) {
    await release(row.id);
    return { status: row.status };
  }
  let m: MolliePayment;
  try {
    m = await mollie<MolliePayment>("GET", `payments/${encodeURIComponent(row.mollieId)}`);
  } catch (err) {
    await release(row.id, { lastError: describe(err) });
    throw err;
  }
  // Only a payment that is the one we opened is taken into account
  if (centsOf(m.amount) !== row.amountCents || (row.requestId && m.metadata?.requestId !== row.requestId) || m.mode !== row.mode) {
    await release(row.id, { lastError: "mismatch: Mollie's payment does not match this booking" });
    return { status: row.status };
  }
  const nowPaid = m.status === "paid" && row.status !== "paid";
  const chargedBack = centsOf(m.amountChargedBack);
  await release(row.id, { ...fromMollie(m), lastError: null });
  if (chargedBack > row.chargedBackCents && row.requestId) {
    // The customer's bank took money back: the team must know (it is not paid any more)
    await db.insert(schema.requestEvents).values({ requestId: row.requestId, event: "charged_back", params: { amount: ((chargedBack - row.chargedBackCents) / 100).toFixed(2) } });
    const r = await booking(row.requestId);
    if (r) await notifyTeamChargeback(r, chargedBack - row.chargedBackCents).catch(() => null);
  }
  if (nowPaid && row.requestId) {
    await db.insert(schema.requestEvents).values({
      requestId: row.requestId,
      event: "paid",
      params: { amount: (row.amountCents / 100).toFixed(2), method: m.method ?? undefined },
    });
    const r = await booking(row.requestId);
    if (r) {
      await Promise.allSettled([notifyTeamPaid(r, row.amountCents, m.method), emailPaymentReceived(r, row.amountCents)]);
    }
  }
  if (m.status === "paid" && row.requestId) await recordInBooks(row.id);
  await refreshRefunds(row.id);
  return { status: m.status };
}

/** Records a paid payment on the booking's Moneybird invoice, once. Left for the sweep when there is no invoice yet. */
async function recordInBooks(id: string): Promise<void> {
  if (!recordingOn()) return;
  const [row] = await db.select().from(p).where(eq(p.id, id)).limit(1);
  if (!row?.requestId || row.status !== "paid" || row.moneybirdRegisteredAt || !row.mollieId) return;
  const outcome = await recordPayment(row.requestId, row.amountCents, row.paidAt ?? new Date(), row.mollieId);
  if (outcome === "done") await save(row.id, { moneybirdRegisteredAt: new Date(), lastError: null });
  else if (outcome === "failed") await save(row.id, { lastError: "Could not record the payment in Moneybird" });
}

/** A payment row that was being made when the process stopped: made again with the same key (Mollie answers the same). */
async function createAtMollie(row: Payment, requestId: string, reference: string, locale: string, returnUrl: string): Promise<MolliePayment> {
  const origin = webhookOrigin();
  return mollie<MolliePayment>(
    "POST",
    "payments",
    {
      amount: amountOf(row.amountCents),
      description: `Ecram Execs booking ${reference}`,
      redirectUrl: returnUrl,
      ...(origin ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
      metadata: { requestId },
      locale: locale === "nl" ? "nl_NL" : "en_GB",
    },
    row.id,
  );
}

/**
 * Starts (or picks up) the booking's payment and says where to send the customer. `returnUrl` is the booking's own page,
 * which shows the result when they come back (built by the caller, which has checked who they are).
 */
export async function startPayment(requestId: string, returnUrl: string): Promise<StartResult> {
  const config = mollieConfig();
  if (!config) return { status: "off" };
  const r = await booking(requestId);
  if (!r || !payable(r.status)) return { status: "nothing_due" };

  const [current] = await db
    .select()
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, config.mode), inArray(p.status, [...IN_PROGRESS])))
    .limit(1);
  if (current) {
    if (current.status === "creating" && !current.mollieId) {
      // Made again with the same key: Mollie hands back the payment it may already have made
      const row = await lease(current.id);
      if (!row) return { status: "in_progress" };
      try {
        const m = await createAtMollie(row, requestId, r.reference, r.locale, returnUrl);
        if (m.mode !== config.mode) throw new MollieError(0, null, "Mollie answered in the other mode");
        await release(row.id, { ...fromMollie(m), lastError: null });
        const url = safeCheckoutUrl(m._links?.checkout?.href);
        return url && m.status === "open" ? { status: "redirect", url } : { status: "in_progress" };
      } catch (err) {
        await release(row.id, { lastError: describe(err) });
        return { status: "failed", error: describe(err) };
      }
    }
    const fresh = await refreshPayment(current.id).catch(() => null);
    const [now] = await db.select().from(p).where(eq(p.id, current.id)).limit(1);
    if (!fresh || !now) return { status: "in_progress" };
    if ((IN_PROGRESS as readonly string[]).includes(now.status)) {
      if (now.status !== "open") return { status: "in_progress" };
      let due: number;
      try {
        due = await amountDue(requestId);
      } catch (err) {
        return { status: "failed", error: describe(err) };
      }
      const url = safeCheckoutUrl(now.checkoutUrl);
      if (due === now.amountCents && url) return { status: "redirect", url };
      // The amount changed while this payment was open: cancel it when Mollie still allows, else let it run its course
      try {
        const m = await mollie<MolliePayment>("DELETE", `payments/${encodeURIComponent(now.mollieId!)}`);
        await save(now.id, fromMollie(m));
      } catch {
        return { status: "in_progress" };
      }
    }
  }

  let due: number;
  try {
    due = await amountDue(requestId);
  } catch (err) {
    // Moneybird cannot be asked what is open: no payment now, rather than a wrong amount
    return { status: "failed", error: describe(err) };
  }
  if (due <= 0) return { status: "nothing_due" };
  const [row] = await db
    .insert(p)
    .values({ requestId, reference: r.reference, mode: config.mode, status: "creating", amountCents: due, claimedAt: new Date() })
    .onConflictDoNothing()
    .returning();
  if (!row) return { status: "in_progress" };
  try {
    const m = await createAtMollie(row, requestId, r.reference, r.locale, returnUrl);
    if (m.mode !== config.mode) throw new MollieError(0, null, "Mollie answered in the other mode");
    await release(row.id, { ...fromMollie(m), lastError: null });
    const url = safeCheckoutUrl(m._links?.checkout?.href);
    return url ? { status: "redirect", url } : { status: "failed", error: "no checkout link" };
  } catch (err) {
    // Nothing was made at Mollie (or it cannot be reached): the row steps aside, so the next click can try again
    const error = describe(err);
    console.error(`[mollie] payment for ${r.reference} failed:`, error);
    await release(row.id, { status: "failed", lastError: error });
    return { status: "failed", error };
  }
}

/** On the customer's return (?paid=1): asks Mollie about the booking's latest unfinished payment, so the page is right at once. */
export async function refreshOnReturn(requestId: string): Promise<void> {
  const config = mollieConfig();
  if (!config) return;
  const [latest] = await db
    .select({ id: p.id, status: p.status })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, config.mode)))
    .orderBy(desc(p.createdAt))
    .limit(1);
  if (!latest || !(IN_PROGRESS as readonly string[]).includes(latest.status)) return;
  const result = await refreshPayment(latest.id).catch((err) => {
    console.error(`[mollie] return check for ${requestId} failed:`, err instanceof Error ? err.message : err);
    return undefined;
  });
  if (result === null) console.error(`[mollie] return check for ${requestId}: payment ${latest.id} is busy (leased)`);
}

export type PaymentSummary = {
  /** Still to pay, in cents. */
  due: number;
  /** The latest payment: in progress, paid, or ended without paying. Null before the first. */
  latest: { status: string; amountCents: number; paidAt: Date | null } | null;
};

/** What the customer's pages show about paying. */
export async function paymentSummary(requestId: string): Promise<PaymentSummary | null> {
  const config = mollieConfig();
  if (!config) return null;
  const [latest] = await db
    .select({ status: p.status, amountCents: p.amountCents, paidAt: p.paidAt })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, config.mode)))
    .orderBy(desc(p.createdAt))
    .limit(1);
  const due = await amountDue(requestId).catch(() => 0);
  return { due, latest: latest ?? null };
}

/** The booking's payments and their refunds, for the admin, newest first (every mode, marked). */
export async function paymentsFor(requestId: string): Promise<(Payment & { refunds: Refund[] })[]> {
  const rows = await db.select().from(p).where(eq(p.requestId, requestId)).orderBy(desc(p.createdAt));
  if (rows.length === 0) return [];
  const all = await db.select().from(rf).where(inArray(rf.paymentId, rows.map((row) => row.id))).orderBy(desc(rf.createdAt));
  return rows.map((row) => ({ ...row, refunds: all.filter((x) => x.paymentId === row.id) }));
}

/** Money taken online and not given back: the booking cannot simply be deleted. */
export async function paymentBlocksDelete(requestId: string): Promise<boolean> {
  const rows = await db
    .select({ amount: p.amountCents, refunded: p.refundedCents })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.status, "paid")));
  return rows.some((row) => row.amount - row.refunded > 0);
}

/** Records every paid but unrecorded payment of the booking in Moneybird (before a credit settles the invoice). */
export async function flushPayments(requestId: string): Promise<void> {
  const rows = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, mollieConfig()?.mode ?? "live"), eq(p.status, "paid"), isNull(p.moneybirdRegisteredAt)));
  for (const row of rows) await recordInBooks(row.id);
}

// ---------------------------------------------------------------------------------------------------------------------
// Refunds

export type RefundResult = { status: "done" } | { status: "failed"; error: "off" | "not_paid" | "not_cancelled" | "too_much" | "busy" | "mollie"; detail?: string };

const REFUND_LIVE = ["creating", "queued", "pending", "processing", "refunded"] as const;

/**
 * How much of the payment can still be given back: paid, less what the customer's bank took back, less what is refunded or
 * on its way (Mollie's own refunded figure, or our refunds not failed, whichever is more, so nothing is counted twice and
 * nothing is missed while Mollie has not yet told us).
 */
export async function refundable(paymentId: string): Promise<number> {
  const [row] = await db.select().from(p).where(eq(p.id, paymentId)).limit(1);
  if (!row || row.status !== "paid") return 0;
  const ours = await db.select({ amount: rf.amountCents, status: rf.status }).from(rf).where(eq(rf.paymentId, paymentId));
  const given = ours.filter((x) => (REFUND_LIVE as readonly string[]).includes(x.status)).reduce((sum, x) => sum + x.amount, 0);
  return Math.max(0, row.amountCents - row.chargedBackCents - Math.max(row.refundedCents, given));
}

/** Sends a refund row to Mollie, with its own id as the key: sent again after a timeout, Mollie answers with the same refund. */
async function sendRefund(refund: Refund, mollieId: string, reference: string): Promise<void> {
  try {
    const m = await mollie<MollieRefund>(
      "POST",
      `payments/${encodeURIComponent(mollieId)}/refunds`,
      { amount: amountOf(refund.amountCents), description: `Refund Ecram Execs booking ${reference}` },
      refund.id,
    );
    await db.update(rf).set({ mollieRefundId: m.id, status: m.status, lastError: null, updatedAt: new Date() }).where(eq(rf.id, refund.id));
  } catch (err) {
    // Refused by Mollie (a 4xx): it was not made. Anything else (a timeout, a 5xx) may have reached Mollie: the row stays
    // "creating" and is sent again with the same key by the sweep, never as a second refund
    const refused = err instanceof MollieError && err.status >= 400 && err.status < 500;
    await db.update(rf).set({ ...(refused ? { status: "failed" } : {}), lastError: describe(err), updatedAt: new Date() }).where(eq(rf.id, refund.id));
    throw err;
  }
}

/** The team gives money back through Mollie, for a cancelled booking. Mollie carries it out over time (queued → refunded). */
export async function refundPayment(paymentId: string, cents: number, adminId: string | null): Promise<RefundResult> {
  const config = mollieConfig();
  if (!config) return { status: "failed", error: "off" };
  const [found] = await db.select().from(p).where(eq(p.id, paymentId)).limit(1);
  if (!found || found.status !== "paid" || !found.mollieId || found.mode !== config.mode) return { status: "failed", error: "not_paid" };
  const r = found.requestId ? await booking(found.requestId) : null;
  if (r && r.status !== "cancelled") return { status: "failed", error: "not_cancelled" };
  const amount = Math.round(cents);
  if (!(amount > 0)) return { status: "failed", error: "too_much" };
  const row = await lease(found.id);
  if (!row) return { status: "failed", error: "busy" };
  try {
    // Checked again under the lease: two clicks at once cannot both pass
    if (amount > (await refundable(paymentId))) return { status: "failed", error: "too_much" };
    const [refund] = await db.insert(rf).values({ paymentId, amountCents: amount, status: "creating", adminId }).returning();
    try {
      await sendRefund(refund, row.mollieId!, row.reference);
    } catch (err) {
      const [now] = await db.select({ status: rf.status }).from(rf).where(eq(rf.id, refund.id)).limit(1);
      if (now?.status === "failed") return { status: "failed", error: "mollie", detail: describe(err) };
      // Not refused: on its way or not, the sweep finishes it with the same key
    }
    if (row.requestId) {
      await db.insert(schema.requestEvents).values({ requestId: row.requestId, adminId, event: "refunded", params: { amount: (amount / 100).toFixed(2) } });
    }
    return { status: "done" };
  } finally {
    await release(row.id);
  }
}

/**
 * Follows the payment's refunds: one still being made is sent again with its key; one under way is asked of Mollie; one
 * that went through is recorded on the Moneybird credit, once, and only when the payment itself was in the books (a
 * payment taken after the booking was credited never reached an invoice, so its refund has nothing to settle there).
 */
async function refreshRefunds(paymentId: string): Promise<void> {
  const [row] = await db.select().from(p).where(eq(p.id, paymentId)).limit(1);
  if (!row?.mollieId) return;
  const list = await db.select().from(rf).where(eq(rf.paymentId, paymentId));
  for (const refund of list) {
    let status = refund.status;
    if (status === "creating" && !refund.mollieRefundId) {
      try {
        await sendRefund(refund, row.mollieId, row.reference);
        const [now] = await db.select({ status: rf.status, id: rf.mollieRefundId }).from(rf).where(eq(rf.id, refund.id)).limit(1);
        status = now?.status ?? status;
        refund.mollieRefundId = now?.id ?? null;
      } catch {
        continue;
      }
    } else if (refund.mollieRefundId && !(REFUND_DONE as readonly string[]).includes(status)) {
      try {
        const m = await mollie<MollieRefund>("GET", `payments/${encodeURIComponent(row.mollieId)}/refunds/${encodeURIComponent(refund.mollieRefundId)}`);
        status = m.status;
        await db.update(rf).set({ status, lastError: null, updatedAt: new Date() }).where(eq(rf.id, refund.id));
      } catch (err) {
        await db.update(rf).set({ lastError: describe(err), updatedAt: new Date() }).where(eq(rf.id, refund.id));
        continue;
      }
    }
    if (status === "refunded" && !refund.moneybirdRegisteredAt && row.requestId && refund.mollieRefundId && row.moneybirdRegisteredAt && recordingOn()) {
      const outcome = await recordRefund(row.requestId, refund.amountCents, new Date(), refund.mollieRefundId);
      if (outcome === "done") await db.update(rf).set({ moneybirdRegisteredAt: new Date(), updatedAt: new Date() }).where(eq(rf.id, refund.id));
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Run by cron every ten minutes (app/api/cron/payments): asks Mollie about payments still under way (a bank transfer takes
 * days), records paid ones in Moneybird that could not be recorded yet (no invoice, Moneybird down), follows refunds, and
 * clears a payment that was never made at Mollie. Only rows in the current key's mode.
 */
export async function sweepPayments(limit = 40): Promise<{ refreshed: number; recorded: number; cleared: number }> {
  const config = mollieConfig();
  if (!config) return { refreshed: 0, recorded: 0, cleared: 0 };
  let refreshed = 0;
  let recorded = 0;

  // A row whose payment was never made at Mollie (the process stopped first) stops blocking a new one after an hour
  const cleared = await db
    .update(p)
    .set({ status: "failed", lastError: "never made at Mollie", claimedAt: null, updatedAt: new Date() })
    .where(and(eq(p.status, "creating"), isNull(p.mollieId), sql`${p.createdAt} < now() - interval '1 hour'`))
    .returning({ id: p.id });

  const underway = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.mode, config.mode), isNotNull(p.mollieId), inArray(p.status, ["open", "pending", "authorized"]), leaseFree(p.claimedAt)))
    .orderBy(p.updatedAt)
    .limit(limit);
  for (const row of underway) {
    refreshed++;
    await refreshPayment(row.id).catch(() => null);
  }

  if (recordingOn()) {
    // Only bookings that can still have an open invoice: a payment taken after the booking was credited never will
    const unrecorded = await db
      .select({ id: p.id })
      .from(p)
      .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, p.requestId))
      .where(
        and(
          eq(p.mode, config.mode),
          eq(p.status, "paid"),
          isNull(p.moneybirdRegisteredAt),
          inArray(schema.quoteRequests.status, ["confirmed", "completed"]),
        ),
      )
      .orderBy(p.updatedAt)
      .limit(limit);
    for (const row of unrecorded) {
      recorded++;
      await recordInBooks(row.id).catch(() => null);
      await save(row.id, {});
    }
  }

  // Payments with a refund still to finish or to record: the payment itself is asked again too (its refunded amount)
  const refunding = await db
    .selectDistinct({ id: rf.paymentId })
    .from(rf)
    .innerJoin(p, eq(p.id, rf.paymentId))
    .where(and(eq(p.mode, config.mode), sql`(${rf.status} not in ('refunded', 'failed', 'canceled') or (${rf.status} = 'refunded' and ${rf.moneybirdRegisteredAt} is null and ${p.moneybirdRegisteredAt} is not null))`))
    .limit(limit);
  for (const row of refunding) await refreshPayment(row.id).catch(() => null);

  return { refreshed, recorded, cleared: cleared.length };
}

/** For the webhook: our row for a Mollie payment id, in the current mode. */
export async function paymentByMollieId(mollieId: string): Promise<Payment | null> {
  const config = mollieConfig();
  if (!config) return null;
  const [row] = await db.select().from(p).where(and(eq(p.mollieId, mollieId), eq(p.mode, config.mode))).limit(1);
  return row ?? null;
}

export type PaymentView = { due: number; dueLabel: string; state: "none" | "progress" | "paid" | "failed"; paidOn: string | null };

/** The customer pages' view of paying: what is due (formatted), and how the latest payment went. Null when payments are off. */
export async function paymentView(requestId: string, locale: "en" | "nl"): Promise<PaymentView | null> {
  const summary = await paymentSummary(requestId);
  if (!summary) return null;
  const { formatCents } = await import("@/lib/pricing/rates");
  const { formatDay } = await import("@/lib/corporate/format");
  const status = summary.latest?.status;
  // An open payment is one the customer can still finish (or left without paying): the button stays, and opens it again.
  // Only a payment Mollie is still working on (pending, authorised) shows "in progress".
  const state: PaymentView["state"] = !status || status === "open" || status === "creating"
    ? "none"
    : (IN_PROGRESS as readonly string[]).includes(status)
      ? "progress"
      : status === "paid"
        ? "paid"
        : "failed";
  return {
    due: summary.due,
    dueLabel: formatCents(summary.due, locale),
    state,
    paidOn: summary.latest?.paidAt ? formatDay(summary.latest.paidAt, locale) : null,
  };
}
