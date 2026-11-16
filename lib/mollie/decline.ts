import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { emailDeclined } from "@/lib/email";
import { syncBooking } from "@/lib/moneybird/sync";
import { mollieConfig } from "./config";
import { cancelOpenPayments, refundable, refundPayment, revokeCard } from "./pay";

export type DeclineResult = { status: "done"; refundedCents: number } | { status: "failed"; error: "not_open" | "missing" };

/**
 * "Decline and refund" (the client, 15 Nov 2026): the team cannot take a booking it has not approved (no car, no driver),
 * so everything paid goes back, the service fee included, and the card is no longer charged. A customer who cancels
 * keeps no refund of the fee; that is the ordinary cancel, not this.
 */
export async function declineBooking(requestId: string, adminId: string | null): Promise<DeclineResult> {
  const q = schema.quoteRequests;
  const [before] = await db.select().from(q).where(eq(q.id, requestId)).limit(1);
  if (!before) return { status: "failed", error: "missing" };
  // Only a booking not yet approved: an approved one is cancelled and credited as before
  const [row] = await db
    .update(q)
    .set({ status: "cancelled", declinedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(q.id, requestId), inArray(q.status, ["new", "contacted", "quoted"])))
    .returning();
  if (!row) return { status: "failed", error: "not_open" };
  await db.insert(schema.requestEvents).values({
    requestId,
    adminId,
    event: "changes",
    params: { changes: [{ kind: "status", from: before.status, to: "cancelled" }] },
  });

  let refunded = 0;
  if (mollieConfig()) {
    await cancelOpenPayments(requestId);
    const paid = await db
      .select({ id: schema.payments.id })
      .from(schema.payments)
      .where(and(eq(schema.payments.requestId, requestId), eq(schema.payments.status, "paid")));
    for (const payment of paid) {
      const left = await refundable(payment.id);
      if (left <= 0) continue;
      const result = await refundPayment(payment.id, left, adminId);
      if (result.status === "done") refunded += left;
    }
    await revokeCard(requestId);
  }
  await db.insert(schema.requestEvents).values({ requestId, adminId, event: "declined", params: { amount: (refunded / 100).toFixed(2) } });
  // No invoice was made for a booking never approved; an unsent one being made is dropped
  await syncBooking(requestId).catch(() => null);
  await emailDeclined(row, refunded).catch((err) => console.error(`[decline] email for ${row.reference} failed:`, err instanceof Error ? err.message : err));
  return { status: "done", refundedCents: refunded };
}
