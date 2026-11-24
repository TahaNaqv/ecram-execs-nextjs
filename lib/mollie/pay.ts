import "server-only";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emailBalanceFailed, emailPaymentReceived, notifyTeamBalanceFailed, notifyTeamChargeback, notifyTeamPaid } from "@/lib/email";
import { invoiceCents } from "@/lib/moneybird/invoice";
import { invoiceOpenCents, recordingOn, recordPayment, recordRefund } from "@/lib/moneybird/payments";
import { amountOf, centsOf, mollie, MollieError, type MollieCustomer, type MollieMandate, type MolliePayment, type MollieRefund } from "./client";
import { addDays, amsterdamDay, balanceDueOn, upfrontCents } from "@/lib/payments/schedule";
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
type Booking = typeof schema.quoteRequests.$inferSelect;
/** The consent wording's version (the terms tick at booking): bump it when the wording changes. */
export const CONSENT_VERSION = "2026-11-15";
type Refund = typeof rf.$inferSelect;
export type StartResult =
  | { status: "redirect"; url: string }
  | { status: "in_progress" }
  /** The card is to be saved for the balance: the customer has to agree first (the booking page's tick). */
  | { status: "needs_consent" }
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
export async function paidNet(requestId: string, mode: "test" | "live", opts: { unrecordedOnly?: boolean } = {}): Promise<number> {
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
      event: row.purpose === "balance" ? "balance_charged" : "paid",
      params: { amount: (row.amountCents / 100).toFixed(2), method: m.method ?? undefined },
    });
    // The payment at booking saves the card for the balance
    if (row.purpose === "upfront") await saveCard(row.requestId, m).catch((err) => console.error(`[mollie] saving the card for ${row.reference} failed:`, describe(err)));
    const r = await booking(row.requestId);
    // The payment at booking is announced with the booking itself (the team alert and the customer's acknowledgement,
    // lib/mollie/schedule.ts); every later payment on its own
    if (r && row.purpose !== "upfront") {
      await Promise.allSettled([notifyTeamPaid(r, row.amountCents, m.method), emailPaymentReceived(r, row.amountCents)]);
    }
  }
  // The balance charge failed: the customer is asked to pay on the booking's page, the team is told (once)
  if (row.purpose === "balance" && row.requestId && ["failed", "canceled", "expired"].includes(m.status) && !(["failed", "canceled", "expired"] as string[]).includes(row.status)) {
    await onBalanceFailed(row.requestId, row.amountCents, m.details?.failureMessage ?? m.details?.failureReason ?? null).catch((err) =>
      console.error(`[mollie] telling about the failed balance of ${row.reference} failed:`, describe(err)),
    );
  }
  if (m.status === "paid" && row.requestId) await recordInBooks(row.id);
  await refreshRefunds(row.id);
  if (row.requestId) {
    await syncBookingPaymentStatus(row.requestId);
  }
  return { status: m.status };
}

/** Keeps the card a paid first payment saved (Mollie's mandate): its id, and its label and last day for the admin and warnings. */
async function saveCard(requestId: string, m: MolliePayment): Promise<void> {
  const r = await booking(requestId);
  const customerId = m.customerId ?? r?.mollieCustomerId;
  if (!r || !customerId) return;
  let mandate: MollieMandate | null = null;
  if (m.mandateId) mandate = await mollie<MollieMandate>("GET", `customers/${encodeURIComponent(customerId)}/mandates/${encodeURIComponent(m.mandateId)}`);
  else {
    const list = await mollie<{ _embedded?: { mandates?: MollieMandate[] } }>("GET", `customers/${encodeURIComponent(customerId)}/mandates`);
    mandate = (list._embedded?.mandates ?? []).find((x) => x.status === "valid" && x.method === "creditcard") ?? null;
  }
  if (!mandate) return;
  const expiry = mandate.details?.cardExpiryDate ?? null;
  const label = [mandate.details?.cardLabel, mandate.details?.cardNumber ? `••${mandate.details.cardNumber.slice(-4)}` : null].filter(Boolean).join(" ");
  await db
    .update(schema.quoteRequests)
    .set({ mollieMandateId: mandate.id, cardExpiresOn: expiry && /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : null, cardLabel: label || null })
    .where(eq(schema.quoteRequests.id, requestId));
}

/** The balance could not be charged: one email to the customer (pay on the booking page) and one alert to the team. */
async function onBalanceFailed(requestId: string, cents: number, reason: string | null): Promise<void> {
  await db.insert(schema.requestEvents).values({ requestId, event: "balance_failed", params: { amount: (cents / 100).toFixed(2), reason: reason ?? undefined } });
  const r = await booking(requestId);
  if (r) await Promise.allSettled([emailBalanceFailed(r, cents), notifyTeamBalanceFailed(r, cents, reason)]);
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

/** What one payment at Mollie is asked for, and for whom. */
type Ask = { purpose: "upfront" | "balance" | "pay"; first: boolean; customerId?: string | null };

/** Makes the payment at Mollie (again, with the same key, for a row whose answer was lost: Mollie answers the same). */
async function createAtMollie(row: Payment, r: Booking, returnUrl: string, ask: Ask): Promise<MolliePayment> {
  const origin = webhookOrigin();
  return mollie<MolliePayment>(
    "POST",
    "payments",
    {
      amount: amountOf(row.amountCents),
      description: `Ecram Execs booking ${r.reference}`,
      redirectUrl: returnUrl,
      ...(origin ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
      metadata: { requestId: r.id },
      locale: r.locale === "nl" ? "nl_NL" : "en_GB",
      // The first payment saves the card (a mandate) for the balance, so it is a card payment (the client, 15 Nov 2026)
      ...(ask.first && ask.customerId ? { customerId: ask.customerId, sequenceType: "first", method: "creditcard" } : {}),
    },
    row.id,
  );
}

/** The booking's customer at Mollie (made once, in the key's mode): the card saved by the first payment belongs to it. */
async function ensureCustomer(r: Booking): Promise<string> {
  const config = mollieConfig()!;
  if (r.mollieCustomerId && r.mollieMode === config.mode) return r.mollieCustomerId;
  const customer = await mollie<MollieCustomer>(
    "POST",
    "customers",
    { name: r.name, email: r.email, locale: r.locale === "nl" ? "nl_NL" : "en_GB", metadata: { requestId: r.id } },
    `customer-${r.id}-${config.mode}`,
  );
  await db
    .update(schema.quoteRequests)
    .set({ mollieCustomerId: customer.id, mollieMode: config.mode, mollieMandateId: null })
    .where(eq(schema.quoteRequests.id, r.id));
  return customer.id;
}

export type Due = { cents: number; purpose: "upfront" | "pay"; first: boolean };
const NOTHING: Due = { cents: 0, purpose: "pay", first: false };

/**
 * What the customer can pay now on the booking's page, and how:
 * - a booking made before the client's rules of 15 Nov 2026 (no plan): everything still due, once it is approved;
 * - not yet paid at booking (left Mollie's page, a chat or phone booking, or approved unpaid): the upfront part, as a
 *   first card payment that saves the card;
 * - approved, plan C, or from the balance date on (a failed or capped charge, a raised price): what is still due;
 * - otherwise (approved, the balance not yet due): nothing, the card is charged by itself.
 * Throws when Moneybird cannot be asked what is open.
 */
export async function dueNow(requestId: string): Promise<Due> {
  const config = mollieConfig();
  if (!config) return NOTHING;
  const r = await booking(requestId);
  if (!r || r.declinedAt || r.status === "cancelled") return NOTHING;
  if (!r.paymentPlan) return payable(r.status) ? { cents: await amountDue(requestId), purpose: "pay", first: false } : NOTHING;
  const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null }) ?? 0;
  const paid = await paidNet(requestId, config.mode);
  const upfront = upfrontCents(r.paymentPlan, Math.min(total, r.consentedCents ?? total), r.priceEstimate);
  if (paid < upfront) return { cents: upfront - paid, purpose: "upfront", first: true };
  if (!payable(r.status)) return NOTHING;
  const due = balanceDueOn(r.paymentPlan, r.pickupAt);
  if (r.paymentPlan === "C" || r.balanceAttemptedAt || (due && amsterdamDay() >= due)) {
    return { cents: await amountDue(requestId), purpose: "pay", first: false };
  }
  return NOTHING;
}

/**
 * The customer agreed (the terms tick at booking, or on the booking's page): to the terms, the non-refundable service fee,
 * and the card being charged for the rest 30 days before the ride. The total they saw is kept: nothing above it is ever
 * charged by itself.
 */
export async function recordConsent(requestId: string, ipHash: string | null): Promise<void> {
  const r = await booking(requestId);
  if (!r) return;
  const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null });
  await db
    .update(schema.quoteRequests)
    .set({ consentedCents: total, consentedAt: new Date(), consentVersion: CONSENT_VERSION, consentIpHash: ipHash })
    .where(eq(schema.quoteRequests.id, requestId));
}

/**
 * Starts (or picks up) the booking's payment and says where to send the customer. `returnUrl` is the booking's own page,
 * which shows the result when they come back (built by the caller, which has checked who they are). A payment that saves
 * the card is only started once the customer has agreed to it (`consentedAt`).
 */
export async function startPayment(requestId: string, returnUrl: string): Promise<StartResult> {
  const config = mollieConfig();
  if (!config) return { status: "off" };
  const r = await booking(requestId);
  if (!r) return { status: "nothing_due" };

  const [current] = await db
    .select()
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, config.mode), inArray(p.status, [...IN_PROGRESS])))
    .limit(1);
  if (current) {
    // The balance being charged to the card: it settles first (the sweep finishes it)
    if (current.purpose === "balance") return { status: "in_progress" };
    if (current.status === "creating" && !current.mollieId) {
      // Made again with the same key: Mollie hands back the payment it may already have made
      const row = await lease(current.id);
      if (!row) return { status: "in_progress" };
      try {
        const first = row.purpose === "upfront";
        const m = await createAtMollie(row, r, returnUrl, { purpose: row.purpose, first, customerId: first ? await ensureCustomer(r) : null });
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
      if (now.status !== "open" || now.purpose === "balance") return { status: "in_progress" };
      let due: Due;
      try {
        due = await dueNow(requestId);
      } catch (err) {
        return { status: "failed", error: describe(err) };
      }
      const url = safeCheckoutUrl(now.checkoutUrl);
      if (due.cents === now.amountCents && due.purpose === now.purpose && url) return { status: "redirect", url };
      // The amount changed while this payment was open: cancel it when Mollie still allows, else let it run its course
      try {
        const m = await mollie<MolliePayment>("DELETE", `payments/${encodeURIComponent(now.mollieId!)}`);
        await save(now.id, fromMollie(m));
      } catch {
        return { status: "in_progress" };
      }
    }
  }

  let due: Due;
  try {
    due = await dueNow(requestId);
  } catch (err) {
    // Moneybird cannot be asked what is open: no payment now, rather than a wrong amount
    return { status: "failed", error: describe(err) };
  }
  if (due.cents <= 0) return { status: "nothing_due" };
  if (due.first && !r.consentedAt) return { status: "needs_consent" };
  const [row] = await db
    .insert(p)
    .values({ requestId, reference: r.reference, mode: config.mode, purpose: due.purpose, status: "creating", amountCents: due.cents, claimedAt: new Date() })
    .onConflictDoNothing()
    .returning();
  if (!row) return { status: "in_progress" };
  try {
    const customerId = due.first ? await ensureCustomer(r) : null;
    const m = await createAtMollie(row, r, returnUrl, { purpose: due.purpose, first: due.first, customerId });
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

export type ChargeResult = { status: "charged" | "pending" | "failed" | "busy" | "no_card" | "nothing"; reason?: string };

/**
 * Charges the balance to the card saved at booking (a Mollie "recurring" payment: no checkout, the customer is not there).
 * Our row is made first and is Mollie's Idempotency-Key, as Mollie asks for these charges, so a retry never charges twice.
 * The result comes back like any payment (refreshPayment): paid, or failed, which tells the customer and the team once.
 */
export async function chargeBalance(requestId: string, amount: () => Promise<number>): Promise<ChargeResult> {
  const config = mollieConfig();
  if (!config) return { status: "failed", reason: "off" };
  let r = await booking(requestId);
  if (!r?.mollieCustomerId || r.mollieMode !== config.mode || !r.consentedAt) return { status: "no_card" };
  const customer = encodeURIComponent(r.mollieCustomerId);
  let mandate: MollieMandate | null;
  try {
    if (r.mollieMandateId) {
      mandate = await mollie<MollieMandate>("GET", `customers/${customer}/mandates/${encodeURIComponent(r.mollieMandateId)}`);
    } else {
      // The card was not kept when the first payment came in (Mollie could not be asked then): look it up now
      const list = await mollie<{ _embedded?: { mandates?: MollieMandate[] } }>("GET", `customers/${customer}/mandates`);
      mandate = (list._embedded?.mandates ?? []).find((x) => x.status === "valid" && x.method === "creditcard") ?? null;
      if (mandate) await db.update(schema.quoteRequests).set({ mollieMandateId: mandate.id }).where(eq(schema.quoteRequests.id, requestId));
    }
  } catch (err) {
    // Only Mollie saying it is not there means there is no card; anything else (down, slow) is asked again next time
    if (err instanceof MollieError && (err.status === 404 || err.status === 410)) mandate = null;
    else return { status: "busy", reason: describe(err) };
  }
  // Just saved, Mollie may still be settling the card ("pending"; minutes in test mode): asked again next time, unless it
  // has been so for two days past the balance date
  const due = balanceDueOn(r.paymentPlan, r.pickupAt);
  if (mandate?.status === "pending" && (!due || amsterdamDay() <= addDays(due, 2))) return { status: "busy", reason: "card still pending at Mollie" };
  // A card that is no longer usable (revoked, or the bank refused it) is not charged
  if (!mandate || mandate.status !== "valid") return { status: "no_card" };
  // Its label (Mastercard ••9399) is only given once the card is settled: kept for the admin and the emails
  if (!r.cardLabel && mandate.details?.cardLabel) {
    const label = [mandate.details.cardLabel, mandate.details.cardNumber ? `••${mandate.details.cardNumber.slice(-4)}` : null].filter(Boolean).join(" ");
    await db.update(schema.quoteRequests).set({ cardLabel: label }).where(eq(schema.quoteRequests.id, requestId));
  }
  r = (await booking(requestId)) ?? r;
  let first: number;
  try {
    first = await amount();
  } catch (err) {
    return { status: "busy", reason: describe(err) };
  }
  if (first <= 0) return { status: "nothing" };
  const [row] = await db
    .insert(p)
    .values({ requestId, reference: r.reference, mode: config.mode, purpose: "balance", status: "creating", amountCents: first, claimedAt: new Date() })
    .onConflictDoNothing()
    .returning();
  // A payment of the customer's own is under way (the Pay button): it settles first
  if (!row) return { status: "busy" };
  // Asked again now that this row holds the one open slot: a payment of the customer's own that came in meanwhile is
  // counted, so the card is never charged for it a second time
  let cents: number;
  try {
    cents = Math.min(first, await amount());
  } catch (err) {
    await release(row.id, { status: "canceled", lastError: describe(err) });
    return { status: "busy", reason: describe(err) };
  }
  if (cents <= 0) {
    await release(row.id, { status: "canceled", lastError: "nothing left to charge" });
    return { status: "nothing" };
  }
  if (cents !== first) await save(row.id, { amountCents: cents });
  return postBalance({ ...row, amountCents: cents }, { ...r, mollieMandateId: mandate.id });
}

/** Sends a balance row's charge to Mollie, with the row's id as the key (again, for a row whose answer was lost). */
async function postBalance(row: Payment, r: Booking): Promise<ChargeResult> {
  const origin = webhookOrigin();
  let m: MolliePayment;
  try {
    m = await mollie<MolliePayment>(
      "POST",
      "payments",
      {
        amount: amountOf(row.amountCents),
        description: `Ecram Execs booking ${r.reference} (balance)`,
        ...(origin ? { webhookUrl: `${origin}/api/mollie/webhook` } : {}),
        metadata: { requestId: r.id },
        customerId: r.mollieCustomerId,
        mandateId: r.mollieMandateId,
        sequenceType: "recurring",
      },
      row.id,
    );
  } catch (err) {
    const reason = describe(err);
    // Refused by Mollie (a 4xx): nothing was charged. Anything else may have reached Mollie: the row stays for the sweep
    // to ask again with the same key, never as a second charge
    const refused = err instanceof MollieError && err.status >= 400 && err.status < 500;
    // Too many requests: nothing was made, and it may be asked again (the slot is freed, the caller tries next time)
    if (err instanceof MollieError && err.status === 429) {
      await release(row.id, { status: "canceled", lastError: reason });
      return { status: "busy", reason };
    }
    await release(row.id, refused ? { status: "failed", lastError: reason } : { lastError: reason });
    // Refused outright: there is no payment at Mollie to report back, so the customer and the team are told here
    if (refused) await onBalanceFailed(r.id, row.amountCents, reason).catch(() => null);
    return refused ? { status: "failed", reason } : { status: "pending", reason };
  }
  await release(row.id, { mollieId: m.id, status: "open", lastError: null });
  const after = await refreshPayment(row.id).catch(() => null);
  const status = after?.status ?? m.status;
  return status === "paid" ? { status: "charged" } : ["failed", "canceled", "expired"].includes(status) ? { status: "failed" } : { status: "pending" };
}

/**
 * Synchronizes quoteRequests.paymentStatus with the booking's Mollie payments.
 * Sets to "PAID" if any paid payment exists in the current mode,
 * "UNPAID" if the latest attempt failed/canceled/expired,
 * or "OPEN" if a payment is in progress or pending.
 *
 * Worked out from our own payment rows only, which hold what Mollie's API said. A status in a request (the return link,
 * the webhook) is never trusted: Mollie sends neither, and anyone can type or post one (fixed 24 Nov 2026).
 */
export async function syncBookingPaymentStatus(requestId: string): Promise<string> {
  const config = mollieConfig();
  const mode = config?.mode ?? "test";

  let nextStatus: "PAID" | "OPEN" | "UNPAID" = "OPEN";

  const [paidRow] = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, mode), eq(p.status, "paid")))
    .limit(1);

  if (paidRow) {
    nextStatus = "PAID";
  } else {
    const [latest] = await db
      .select({ status: p.status })
      .from(p)
      .where(and(eq(p.requestId, requestId), eq(p.mode, mode)))
      .orderBy(desc(p.createdAt))
      .limit(1);

    if (latest && ["canceled", "expired", "failed"].includes(latest.status)) {
      nextStatus = "UNPAID";
    } else {
      nextStatus = "OPEN";
    }
  }

  await db
    .update(schema.quoteRequests)
    .set({ paymentStatus: nextStatus })
    .where(eq(schema.quoteRequests.id, requestId));

  return nextStatus;
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
  if (!latest || !(IN_PROGRESS as readonly string[]).includes(latest.status)) {
    await syncBookingPaymentStatus(requestId);
    return;
  }
  const result = await refreshPayment(latest.id).catch((err) => {
    console.error(`[mollie] return check for ${requestId} failed:`, err instanceof Error ? err.message : err);
    return undefined;
  });
  if (result === null) console.error(`[mollie] return check for ${requestId}: payment ${latest.id} is busy (leased)`);
  await syncBookingPaymentStatus(requestId);
}

export type PaymentSummary = {
  /** What can be paid now, in cents. */
  due: number;
  /** Paying it saves the card (the upfront payment): the customer agrees first. */
  first: boolean;
  /** The latest payment: in progress, paid, or ended without paying. Null before the first. */
  latest: { status: string; amountCents: number; paidAt: Date | null } | null;
};

/** The open Mollie page for this booking, if the customer can still pay it. Paid bookings have none. */
export async function openCheckoutFor(requestId: string): Promise<{ url: string | null; status: string | null }> {
  const config = mollieConfig();
  if (!config) return { url: null, status: null };
  const [latest] = await db
    .select({ status: p.status, checkoutUrl: p.checkoutUrl })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, config.mode)))
    .orderBy(desc(p.createdAt))
    .limit(1);
  if (!latest) return { url: null, status: null };
  // Only a payment still open has a Mollie page to go back to. A failed, expired or cancelled one has none: the page then
  // offers the Pay button, which starts a new payment (24 Nov 2026)
  const url = latest.status === "open" ? safeCheckoutUrl(latest.checkoutUrl) : null;
  return { url, status: latest.status };
}

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
  const due = await dueNow(requestId).catch(() => NOTHING);
  return { due: due.cents, first: due.first, latest: latest ?? null };
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

  // A balance charge whose answer was lost (a timeout): sent again with the same key, so Mollie answers with the same charge
  const lost = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.mode, config.mode), eq(p.purpose, "balance"), eq(p.status, "creating"), isNull(p.mollieId), leaseFree(p.claimedAt), sql`${p.createdAt} > now() - interval '50 minutes'`))
    .limit(limit);
  for (const item of lost) {
    const row = await lease(item.id);
    const r = row?.requestId ? await booking(row.requestId) : null;
    if (row && r) await postBalance(row, r).catch(() => null);
    else if (row) await release(row.id);
  }

  // A row whose payment was never made at Mollie (the process stopped first) stops blocking a new one after an hour
  const cleared = await db
    .update(p)
    .set({ status: "failed", lastError: "never made at Mollie", claimedAt: null, updatedAt: new Date() })
    .where(and(eq(p.status, "creating"), isNull(p.mollieId), sql`${p.createdAt} < now() - interval '1 hour'`))
    .returning({ id: p.id, requestId: p.requestId, purpose: p.purpose, amountCents: p.amountCents });
  // A balance charge whose answer never came back may still have been made: the team checks Mollie's dashboard (the
  // customer is not asked to pay it again by email; their page offers it, which the team can stop)
  for (const row of cleared.filter((c) => c.purpose === "balance" && c.requestId && c.amountCents > 0)) {
    const r = await booking(row.requestId!);
    if (!r) continue;
    await db.insert(schema.requestEvents).values({ requestId: r.id, event: "balance_failed", params: { amount: (row.amountCents / 100).toFixed(2), reason: "no answer from Mollie" } });
    await notifyTeamBalanceFailed(r, row.amountCents, "No answer from Mollie: check its dashboard whether the card was charged before asking the customer").catch(() => null);
  }

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

export type PaymentView = {
  due: number;
  dueLabel: string;
  state: "none" | "progress" | "paid" | "failed";
  paidOn: string | null;
  /** The payment at booking (it saves the card): asked for with the consent tick, before approval too */
  first: boolean;
  /** Paid at booking, the rest to come from the card: how much, and on which day */
  rest: { label: string; on: string } | null;
};

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
  // What the card is charged later: after the payment at booking (still to make, or made and the card saved)
  let rest: PaymentView["rest"] = null;
  const r = summary.first || summary.due === 0 ? await booking(requestId) : null;
  const restOn = r && !r.balanceAttemptedAt && (summary.first || r.mollieMandateId) ? balanceDueOn(r.paymentPlan, r.pickupAt) : null;
  if (r && restOn) {
    const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null }) ?? 0;
    const left = total - (await paidNet(requestId, mollieConfig()!.mode)) - (summary.first ? summary.due : 0);
    if (left > 0) rest = { label: formatCents(left, locale), on: formatDay(new Date(`${restOn}T12:00:00Z`), locale) };
  }
  return {
    due: summary.due,
    dueLabel: formatCents(summary.due, locale),
    state,
    paidOn: summary.latest?.paidAt ? formatDay(summary.latest.paidAt, locale) : null,
    first: summary.first,
    rest,
  };
}

/** Cancels the booking's payments still open at Mollie (ones Mollie lets go of): the customer can no longer pay them. */
export async function cancelOpenPayments(requestId: string): Promise<void> {
  const config = mollieConfig();
  if (!config) return;
  const open = await db
    .select()
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, config.mode), inArray(p.status, [...IN_PROGRESS]), isNotNull(p.mollieId)));
  for (const row of open) {
    try {
      const m = await mollie<MolliePayment>("DELETE", `payments/${encodeURIComponent(row.mollieId!)}`);
      await save(row.id, fromMollie(m));
    } catch {
      // Not cancelable any more (being paid): if it is paid after all, the sweep refunds it (lib/mollie/schedule.ts)
    }
  }
}

/** Stops the saved card from being charged again (a declined or cancelled booking): the mandate is revoked at Mollie. */
export async function revokeCard(requestId: string): Promise<void> {
  const r = await booking(requestId);
  if (!r?.mollieCustomerId || !r.mollieMandateId || r.mollieMode !== mollieConfig()?.mode) return;
  await mollie("DELETE", `customers/${encodeURIComponent(r.mollieCustomerId)}/mandates/${encodeURIComponent(r.mollieMandateId)}`).catch(() => null);
  await db.update(schema.quoteRequests).set({ mollieMandateId: null }).where(eq(schema.quoteRequests.id, requestId));
}

/** Removes the booking's customer at Mollie (with its saved card), when the booking itself is deleted. */
export async function forgetCustomer(requestId: string): Promise<void> {
  const r = await booking(requestId);
  if (!r?.mollieCustomerId || r.mollieMode !== mollieConfig()?.mode) return;
  await mollie("DELETE", `customers/${encodeURIComponent(r.mollieCustomerId)}`).catch(() => null);
}
