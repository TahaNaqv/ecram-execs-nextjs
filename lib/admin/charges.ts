import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { BookingCharge } from "@/lib/db/schema";
import type { RequestEventChange } from "@/lib/admin/events";
import { amsterdamToday } from "@/lib/admin/financials-shared";
import { invoiceCents } from "@/lib/moneybird/invoice";
import { mollieConfig } from "@/lib/mollie/config";
import { chargeBilling } from "@/lib/payments/charges";
import { balanceDueOn } from "@/lib/payments/schedule";
import { bookingTotalEuros } from "@/lib/pricing/rates";

/**
 * Close protection added to a booking after it was made (the client, 27 Nov 2026), at the amount the team typed.
 * - "balance" (more than 30 days before the ride, not yet paid in full): the booking's total (quoted_amount) goes up by
 *   the amount, so the booking's invoice and the balance charged 30 days before the ride include it. A card payment's
 *   customer agrees to the higher card charge on their booking page (consented_cents); until then the extra is paid with
 *   the Pay button. An invoice already sent shows the team "Reissue" (its total no longer matches).
 * - "separate" (30 days or less, or already paid): its own Moneybird invoice (lib/moneybird/charges.ts), once the booking
 *   is confirmed. The booking's own total and invoice are not touched.
 */

const q = schema.quoteRequests;
const c = schema.bookingCharges;

export type ChargeView = Pick<
  BookingCharge,
  "id" | "description" | "amountCents" | "billing" | "status" | "acceptedAt" | "invoiceNumber" | "invoiceState" | "invoiceUrl" | "paidAt" | "lastError" | "createdAt"
>;

export async function chargesFor(requestId: string): Promise<ChargeView[]> {
  return db
    .select({
      id: c.id,
      description: c.description,
      amountCents: c.amountCents,
      billing: c.billing,
      status: c.status,
      acceptedAt: c.acceptedAt,
      invoiceNumber: c.invoiceNumber,
      invoiceState: c.invoiceState,
      invoiceUrl: c.invoiceUrl,
      paidAt: c.paidAt,
      lastError: c.lastError,
      createdAt: c.createdAt,
    })
    .from(c)
    .where(eq(c.requestId, requestId))
    .orderBy(asc(c.createdAt));
}

const euros = (cents: number) => (cents / 100).toFixed(2);

/** Close protection that joined the booking's total (active "balance" charges), in cents. */
export async function balanceChargesCents(requestId: string): Promise<number> {
  const rows = await db
    .select({ amount: c.amountCents })
    .from(c)
    .where(and(eq(c.requestId, requestId), eq(c.billing, "balance"), eq(c.status, "active")));
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

/**
 * A booking repriced from the rate card (its cars changed): the new rate-card total plus the close protection on it.
 * `typedBefore` is false when the old amount was the rate card's own (plus that close protection), so it follows the new
 * price; a total the team typed is kept as it is.
 */
export function repricedAmount(before: { quotedAmount: string | null; snapshotEuros: string | null }, newSnapshotEuros: string | null, chargesCents: number): string | null {
  const plus = (value: string | null) => (value == null ? null : euros(Math.round(Number(value) * 100) + chargesCents));
  const fromRateCard = before.quotedAmount == null || Number(before.quotedAmount) === Number(plus(before.snapshotEuros));
  // The new cars could not be priced: keep the amount (and the close protection in it) rather than dropping it
  if (newSnapshotEuros == null) return before.quotedAmount;
  return fromRateCard ? plus(newSnapshotEuros) : before.quotedAmount;
}

/** Paid online so far, net of refunds and chargebacks, in the payment key's mode (0 without online payments). */
async function paidCents(requestId: string): Promise<number> {
  const mode = mollieConfig()?.mode;
  if (!mode) return 0;
  const rows = await db
    .select({ amount: schema.payments.amountCents, refunded: schema.payments.refundedCents, back: schema.payments.chargedBackCents })
    .from(schema.payments)
    .where(and(eq(schema.payments.requestId, requestId), eq(schema.payments.mode, mode), eq(schema.payments.status, "paid")));
  return rows.reduce((sum, row) => sum + row.amount - row.refunded - row.back, 0);
}

export type AddResult = { ok: true; billing: "balance" | "separate" } | { error: string };

export async function addCloseProtection(input: { requestId: string; amountCents: number; description: string; adminId: string; notify: boolean }): Promise<AddResult> {
  const paid = await paidCents(input.requestId);
  // Paid on its Moneybird invoice by other means (a bank transfer): nothing open there counts as paid in full
  const { invoiceOpenCents } = await import("@/lib/moneybird/payments");
  const open = await invoiceOpenCents(input.requestId).catch(() => null);
  const result = await db.transaction(async (tx) => {
    const [r] = await tx.select().from(q).where(eq(q.id, input.requestId)).for("update").limit(1);
    if (!r) return { error: "This booking no longer exists." } as const;
    if (r.status === "cancelled" || r.declinedAt) return { error: "This booking is cancelled." } as const;
    const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null });
    if (total == null) return { error: "Give the booking its price first: close protection is added to it." } as const;
    const billing = chargeBilling({
      pickupAt: r.pickupAt,
      today: amsterdamToday(),
      paidCents: paid,
      totalCents: total,
      balanceAttempted: r.balanceAttemptedAt != null,
      invoicePaid: open === 0,
    });
    const [charge] = await tx
      .insert(c)
      .values({ requestId: r.id, kind: "close_protection", description: input.description, amountCents: input.amountCents, billing, createdBy: input.adminId })
      .returning();
    const changes: RequestEventChange[] = [{ kind: "closeProtection", amount: euros(input.amountCents), billing }];
    const set: Partial<typeof q.$inferInsert> = { closeProtection: true, updatedAt: new Date() };
    if (billing === "balance") {
      const before = bookingTotalEuros(r);
      const after = euros(total + input.amountCents);
      set.quotedAmount = after;
      changes.push({ kind: "quote", from: before, to: after });
    }
    await tx.update(q).set(set).where(eq(q.id, r.id));
    await tx.insert(schema.requestEvents).values({ requestId: r.id, adminId: input.adminId, event: "changes", params: { changes } });
    return { ok: true, billing, charge, booking: { ...r, ...set } } as const;
  });
  if ("error" in result) return result;

  after(async () => {
    const { charge, booking } = result;
    try {
      if (result.billing === "separate") {
        const { issueChargeInvoice } = await import("@/lib/moneybird/charges");
        if (booking.status === "confirmed" || booking.status === "completed") await issueChargeInvoice(charge.id);
      } else if (booking.status === "confirmed" || booking.status === "completed") {
        // An unsent draft is made again with the new total; a sent invoice waits for the team's Reissue
        const { syncBooking } = await import("@/lib/moneybird/sync");
        await syncBooking(booking.id);
      }
    } catch (err) {
      console.error(`[charges] ${booking.reference} close protection invoicing failed`, err);
    }
    if (input.notify) {
      const { emailCloseProtection } = await import("@/lib/email");
      await emailCloseProtection(booking, charge, result.billing === "balance" ? balanceDueOn(booking.paymentPlan, booking.pickupAt) : null).catch((err) =>
        console.error(`[charges] ${booking.reference} close protection email failed`, err),
      );
    }
  });
  return { ok: true, billing: result.billing };
}

/**
 * Cancels a charge. "balance": the booking's total goes down again (and what the customer agreed to the card paying).
 * "separate": an invoice not yet sent is withdrawn; a sent one must be credited in Moneybird first (`credited`).
 */
export async function cancelCharge(input: { chargeId: string; adminId: string; credited: boolean }): Promise<{ ok: true } | { error: string; needsCredit?: true }> {
  const [charge] = await db.select().from(c).where(eq(c.id, input.chargeId)).limit(1);
  if (!charge || charge.status !== "active") return { ok: true };
  if (charge.billing === "separate" && !input.credited) {
    const { withdrawChargeInvoice } = await import("@/lib/moneybird/charges");
    const withdrawn = await withdrawChargeInvoice(charge).catch(() => false);
    if (!withdrawn) {
      return { error: "Its invoice was already sent. Credit it in Moneybird, then cancel it here and tick that it was credited.", needsCredit: true };
    }
  }
  const done = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(c)
      .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: input.adminId })
      .where(and(eq(c.id, charge.id), eq(c.status, "active")))
      .returning();
    if (!row) return null;
    const changes: RequestEventChange[] = [{ kind: "closeProtection", amount: euros(charge.amountCents), billing: charge.billing, cancelled: true }];
    if (charge.billing === "balance") {
      const [r] = await tx.select().from(q).where(eq(q.id, charge.requestId)).for("update").limit(1);
      if (r) {
        const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null });
        const after = total != null && total > charge.amountCents ? euros(total - charge.amountCents) : r.quotedAmount;
        const consented = r.consentedCents != null && charge.acceptedAt ? Math.max(0, r.consentedCents - charge.amountCents) : r.consentedCents;
        await tx.update(q).set({ quotedAmount: after, consentedCents: consented, updatedAt: new Date() }).where(eq(q.id, r.id));
        changes.push({ kind: "quote", from: r.quotedAmount, to: after });
      }
    }
    await tx.insert(schema.requestEvents).values({ requestId: charge.requestId, adminId: input.adminId, event: "changes", params: { changes } });
    return row;
  });
  if (done && charge.billing === "balance") {
    after(async () => {
      const { syncBooking } = await import("@/lib/moneybird/sync");
      await syncBooking(charge.requestId).catch((err) => console.error("[charges] invoice sync after cancel failed", err));
    });
  }
  return { ok: true };
}

/**
 * The customer agrees, on their booking page, that the card saved for the balance also pays this close protection: what
 * they agreed to (consented_cents) goes up by its amount, once.
 */
export async function acceptCharge(requestId: string, chargeId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(q).where(eq(q.id, requestId)).for("update").limit(1);
    if (!r || r.consentedCents == null) return false;
    const total = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null }) ?? 0;
    const [row] = await tx
      .update(c)
      .set({ acceptedAt: new Date() })
      .where(and(eq(c.id, chargeId), eq(c.requestId, requestId), eq(c.billing, "balance"), eq(c.status, "active"), isNull(c.acceptedAt)))
      .returning({ amount: c.amountCents });
    if (!row) return false;
    // Never above the booking's total: consent given after the charge was added already covered it
    await tx.update(q).set({ consentedCents: Math.min(r.consentedCents + row.amount, Math.max(total, r.consentedCents)) }).where(eq(q.id, requestId));
    return true;
  });
}

/** The balance charges a card payment's customer still has to agree to (shown on their booking page). */
export function chargesToAccept(
  booking: { paymentPlan: string | null; consentedCents: number | null; balanceAttemptedAt: Date | null; quotedAmount: string | null; priceEstimate: unknown },
  charges: ChargeView[],
): ChargeView[] {
  if (!booking.paymentPlan || booking.consentedCents == null || booking.balanceAttemptedAt) return [];
  // Consent given after the charge was added (the total then already included it) needs nothing more
  const total = invoiceCents({ quotedAmount: booking.quotedAmount, priceEstimate: (booking.priceEstimate ?? null) as never }) ?? 0;
  if (booking.consentedCents >= total) return [];
  return charges.filter((charge) => charge.status === "active" && charge.billing === "balance" && !charge.acceptedAt);
}
