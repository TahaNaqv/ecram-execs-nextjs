import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import type { RequestEventChange } from "@/lib/admin/events";
import { emailBookingRecorded, emailEnquiryStatus, emailPartnerBooking } from "@/lib/email";
import { clashingReference, lockFleet } from "@/lib/fleet/availability";
import { routeHold } from "@/lib/fleet/route";
import { syncBooking } from "@/lib/moneybird/sync";
import { cancelOpenPayments, collectConfirmedCharge, flushPayments, revokeCard } from "@/lib/mollie/pay";
import { storedQuoteEuros } from "@/lib/pricing/rates";
import type { ActiveStatus } from "@/lib/quotes/constants";

export type StatusChange =
  | { status: "ok"; request: QuoteRequest; followUp: () => Promise<void> }
  | { status: "missing" }
  | { status: "clash"; reference: string };

/**
 * Sets a booking's status: the admin's status menu and Approve (app/api/admin/requests/[id]/authorise), and the automatic
 * approval of a booking made 6 months or more ahead (lib/mollie/schedule.ts). Confirming gives the booking its car, so it
 * is refused while another confirmed booking holds that car at that time; the look and the save happen under the fleet
 * lock, so two approvals at once cannot both pass.
 *
 * What follows the change (the customer's email when `sendMail`, and the Moneybird invoice) is handed back as `followUp`:
 * a route runs it after its response, the sweep simply awaits it.
 */
/**
 * A cancelled booking takes no more money: a checkout still open at Mollie is cancelled (it could otherwise still be paid),
 * and the saved card is never charged again (put back to confirmed, the balance is paid by hand).
 */
export async function stopPaying(requestId: string, reference: string): Promise<void> {
  await cancelOpenPayments(requestId).catch((err) => console.error(`[mollie] ${reference}: cancelling the open payment failed`, err));
  await revokeCard(requestId).catch((err) => console.error(`[mollie] ${reference}: revoking the card failed`, err));
}

export async function setBookingStatus(
  id: string,
  { newStatus, sendMail, adminId, onlyFrom }: { newStatus: ActiveStatus; sendMail: boolean; adminId: string | null; onlyFrom?: ActiveStatus },
): Promise<StatusChange> {
  const [current] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
  if (!current) return { status: "missing" };

  // Confirming also fixes how long the car is held: the route's length, asked for before the fleet lock is taken
  // (Google can be slow, and nobody else should wait on it). It is only ever an improvement on the estimate.
  const confirming = newStatus === "confirmed" && current.status !== "confirmed";
  const hold = confirming ? await routeHold(current) : null;
  const routed = hold?.blockMinutes ?? null;

  const result = await db.transaction(async (tx) => {
    let length: number | null = null;
    let back: number | null = null;
    let basis = current;
    if (newStatus === "confirmed") {
      await lockFleet(tx);
      // Read again under the lock: the car may have been changed, or the booking confirmed, meanwhile
      const [fresh] = await tx.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
      if (!fresh) return { missing: true } as const;
      basis = fresh;
      if (fresh.status !== "confirmed") {
        length = fresh.blockMinutes ?? routed;
        back = fresh.driveBackMinutes ?? hold?.driveBackMinutes ?? null;
      }
      const clash = fresh.status === "confirmed" ? null : await clashingReference(tx, { ...fresh, blockMinutes: length, driveBackMinutes: back });
      if (clash) return { clash } as const;
    }
    // Keep a final already stored on the row (the VAT-inclusive total, or one the team overrode); fill it from the
    // rate-card snapshot only when the row has none, so approving never reprices the booking
    const rateCard = storedQuoteEuros(basis.priceEstimate);
    const hasQuote = basis.quotedAmount != null && basis.quotedAmount !== "";
    const amountStr = hasQuote ? basis.quotedAmount : rateCard;
    const sameMoney =
      (basis.quotedAmount == null || basis.quotedAmount === "" ? null : Number(basis.quotedAmount)) === (amountStr == null ? null : Number(amountStr));
    const changes: RequestEventChange[] = [];
    if (basis.status !== newStatus) changes.push({ kind: "status", from: basis.status, to: newStatus });
    if (!sameMoney) changes.push({ kind: "quote", from: basis.quotedAmount, to: amountStr });
    if (sendMail) changes.push({ kind: "dispatch", to: newStatus });

    const [row] = await tx
      .update(schema.quoteRequests)
      .set({
        status: newStatus,
        quotedAmount: amountStr,
        updatedAt: new Date(),
        ...(length && length !== current.blockMinutes ? { blockMinutes: length } : {}),
        ...(back && back !== current.driveBackMinutes ? { driveBackMinutes: back } : {}),
      })
      // Automatic approval: only a booking still waiting, never one the team declined or cancelled meanwhile
      .where(onlyFrom ? and(eq(schema.quoteRequests.id, id), eq(schema.quoteRequests.status, onlyFrom), isNull(schema.quoteRequests.declinedAt)) : eq(schema.quoteRequests.id, id))
      .returning();
    if (!row) return { missing: true } as const;
    if (changes.length > 0) {
      await tx.insert(schema.requestEvents).values({ requestId: id, adminId, event: "changes", params: { changes } });
    }
    return { updated: row } as const;
  });
  if ("clash" in result && result.clash) return { status: "clash", reference: result.clash };
  if (!("updated" in result) || !result.updated) return { status: "missing" };
  const updated = result.updated;

  const followUp = async () => {
    if (sendMail) {
      try {
        // "New" has not been confirmed: the customer gets the acknowledgement, never "your booking is confirmed"
        if (newStatus === "new") await emailBookingRecorded(updated);
        else if (updated.corporateContactId && updated.source !== "website-corporate") {
          const [partner] = await db
            .select({ email: schema.corporateContacts.email, name: schema.corporateContacts.name, locale: schema.corporateContacts.locale })
            .from(schema.corporateContacts)
            .where(eq(schema.corporateContacts.id, updated.corporateContactId))
            .limit(1);
          if (partner) await emailPartnerBooking({ request: updated, to: partner, kind: newStatus });
        } else {
          await emailEnquiryStatus({ request: updated, kind: newStatus });
        }
      } catch (err) {
        console.error(`[status] ${updated.reference}: the customer's email failed`, err instanceof Error ? err.message : err);
      }
    }
    // Confirming makes the Moneybird invoice (emailed when the customer is told, else only numbered); leaving confirmed
    // drops an unsent one
    try {
      const mb = await syncBooking(updated.id, { deliver: sendMail ? "Email" : "Manual" });
      if (mb.status === "failed") console.error(`[moneybird] ${updated.id}: ${mb.error}`);
      // What was paid at booking goes on the new invoice straight away, so it never reads as wholly open (and a kept
      // service fee on its own invoice, when the customer cancelled before approval)
      if (newStatus === "confirmed" || newStatus === "cancelled") await flushPayments(updated.id);
    } catch (err) {
      console.error(`[moneybird] ${updated.id}: sync failed`, err);
    }
    // Cancelled: the saved card is never charged again (put back to confirmed, the balance is paid by hand)
    if (newStatus === "cancelled") await stopPaying(updated.id, updated.reference);
    // Confirmed: charge the saved card when there is one. Otherwise the customer pays on the booking page.
    if (newStatus === "confirmed" && updated.paymentPlan) await collectConfirmedCharge(updated.id);
  };
  console.info(`[status] ${updated.reference}: ${current.status} → ${newStatus}${sendMail ? " (customer told)" : ""}${adminId ? "" : " (automatic)"}`);
  return { status: "ok", request: updated, followUp };
}
