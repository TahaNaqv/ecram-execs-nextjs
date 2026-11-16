import "server-only";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { setBookingStatus } from "@/lib/admin/approve";
import { db, schema } from "@/lib/db";
import type { RequestEventParams } from "@/lib/admin/events";
import {
  confirmToClient,
  emailBalanceFailed,
  emailBalanceNotice,
  emailCardExpires,
  notifyNewQuote,
  notifyTeamAutoApproveStopped,
  notifyTeamBalanceFailed,
  notifyTeamCardExpires,
} from "@/lib/email";
import { amsterdamDay, BALANCE_DAYS_BEFORE, balanceDueOn, NOTICE_DAYS_BEFORE_CHARGE, noticeOn } from "@/lib/payments/schedule";
import { mollieConfig } from "./config";
import { amountDue, chargeBalance, flushPayments, paidNet, refundable, refundPayment } from "./pay";

/**
 * The scheduled steps of paying for a booking (the client's rules of 15 Nov 2026; lib/payments/schedule.ts):
 * 1. a booking made 6 months or more ahead is approved by itself once its service fee is paid (plan A);
 * 2. a booking is announced (the team's alert, the customer's acknowledgement) once its payment at booking is in;
 * 3. a saved card that runs out before the balance date is flagged;
 * 4. five days before the balance date the customer is told what will be charged, to which card;
 * 5. on the balance date the rest is charged to the saved card, once (never retried by itself);
 * 6. a payment that arrives after the team declined the booking is refunded.
 *
 * Every step is claimed by setting its own column on the booking first (an update that only one run can win), so it
 * happens once whoever runs it: the cron sweep every ten minutes, or a webhook or the customer's return, which ask for
 * one booking's steps at once. Only bookings paid in the current Mollie mode take part.
 */

const q = schema.quoteRequests;
const pay = schema.payments;
type Booking = typeof q.$inferSelect;

const one = (requestId?: string) => (requestId ? eq(q.id, requestId) : undefined);
const upfrontPaid = (mode: string) =>
  sql`exists (select 1 from ${pay} where ${pay.requestId} = ${q.id} and ${pay.purpose} = 'upfront' and ${pay.status} = 'paid' and ${pay.mode} = ${mode})`;

/** The ride's day minus so many days, against an Amsterdam calendar day (in SQL, so the due ones come first, not any 20). */
const rideMinus = (days: number) => sql`(${q.pickupAt}::date - ${days}::int)`;
const onOrBefore = (days: number, today: string) => sql`${rideMinus(days)} <= ${today}::date`;

/** Claims a one-time step: true for the single run that set the column. */
async function claim(id: string, column: "autoApproveDoneAt" | "paidNotifiedAt" | "cardWarnedAt" | "noticeSentAt" | "balanceAttemptedAt"): Promise<boolean> {
  const [row] = await db
    .update(q)
    .set({ [column]: new Date() })
    .where(and(eq(q.id, id), isNull(q[column])))
    .returning({ id: q.id });
  return Boolean(row);
}

const unclaim = (id: string, column: "balanceAttemptedAt" | "noticeSentAt" | "autoApproveDoneAt") => db.update(q).set({ [column]: null }).where(eq(q.id, id));
const event = (requestId: string, name: string, params: RequestEventParams = {}) => db.insert(schema.requestEvents).values({ requestId, event: name, params });
const log = (what: string) => (err: unknown) => console.error(`[schedule] ${what}:`, err instanceof Error ? err.message : err);

/** What the card may still be charged by itself: what is due, but never above the total the customer agreed to. */
async function balanceCents(r: Booking, mode: "test" | "live"): Promise<number> {
  const due = await amountDue(r.id);
  const consented = r.consentedCents ?? 0;
  const paid = await paidNet(r.id, mode);
  return Math.max(0, Math.min(due, consented - paid));
}

async function autoApprove(mode: "test" | "live", requestId?: string, limit = 20) {
  const rows = await db
    .select()
    .from(q)
    .where(
      and(
        one(requestId),
        eq(q.paymentPlan, "A"),
        eq(q.status, "new"),
        isNull(q.declinedAt),
        isNull(q.autoApproveDoneAt),
        isNull(q.autoApproveStoppedAt),
        upfrontPaid(mode),
      ),
    )
    .limit(limit);
  for (const r of rows) {
    if (!(await claim(r.id, "autoApproveDoneAt"))) continue;
    let result: Awaited<ReturnType<typeof setBookingStatus>>;
    try {
      // Only while it is still new and not declined: the team may have acted since it was read
      result = await setBookingStatus(r.id, { newStatus: "confirmed", sendMail: true, adminId: null, onlyFrom: "new" });
    } catch (err) {
      log(`approving ${r.reference}`)(err);
      await unclaim(r.id, "autoApproveDoneAt");
      continue;
    }
    if (result.status === "ok") {
      await event(r.id, "auto_approved");
      await result.followUp();
      await flushPayments(r.id).catch(log(`recording ${r.reference}'s fee`));
    } else if (result.status === "clash") {
      // Its car is booked then: the team decides (and is told once)
      await db.update(q).set({ autoApproveStoppedAt: new Date() }).where(eq(q.id, r.id));
      await event(r.id, "auto_approve_stopped", { clashWith: result.reference });
      await notifyTeamAutoApproveStopped(r, result.reference).catch(log(`alert for ${r.reference}`));
    }
  }
}

async function announcePaid(mode: "test" | "live", requestId?: string, limit = 40) {
  const rows = await db
    .select()
    .from(q)
    .where(and(one(requestId), isNotNull(q.paymentPlan), isNull(q.paidNotifiedAt), isNull(q.declinedAt), inArray(q.status, ["new", "contacted", "quoted", "confirmed"]), upfrontPaid(mode)))
    .limit(limit);
  for (const r of rows) {
    if (!(await claim(r.id, "paidNotifiedAt"))) continue;
    // Approved by itself: the customer already has the "confirmed" email, so only the team is told
    const [now] = await db.select().from(q).where(eq(q.id, r.id)).limit(1);
    const booking = now ?? r;
    await Promise.allSettled([
      notifyNewQuote(booking).catch(log(`team alert for ${r.reference}`)),
      booking.status === "confirmed" ? Promise.resolve() : confirmToClient(booking).catch(log(`acknowledgement for ${r.reference}`)),
    ]);
  }
}

async function cardWarnings(requestId?: string, limit = 40) {
  const rows = await db
    .select()
    .from(q)
    .where(
      and(
        one(requestId),
        inArray(q.paymentPlan, ["A", "B"]),
        inArray(q.status, ["new", "contacted", "confirmed"]),
        isNull(q.balanceAttemptedAt),
        isNotNull(q.cardExpiresOn),
        isNull(q.cardWarnedAt),
        sql`${q.cardExpiresOn} < ${rideMinus(BALANCE_DAYS_BEFORE)}`,
      ),
    )
    .orderBy(q.pickupAt)
    .limit(limit);
  for (const r of rows) {
    const due = balanceDueOn(r.paymentPlan, r.pickupAt);
    if (!due || !r.cardExpiresOn || r.cardExpiresOn >= due) continue;
    if (!(await claim(r.id, "cardWarnedAt"))) continue;
    await event(r.id, "card_expires", { date: r.cardExpiresOn });
    await Promise.allSettled([emailCardExpires(r, due), notifyTeamCardExpires(r, r.cardExpiresOn, due)]);
  }
}

async function notices(mode: "test" | "live", today: string, requestId?: string, limit = 40) {
  const rows = await db
    .select()
    .from(q)
    .where(
      and(
        one(requestId),
        inArray(q.paymentPlan, ["A", "B"]),
        eq(q.status, "confirmed"),
        isNull(q.noticeSentAt),
        isNull(q.balanceAttemptedAt),
        isNotNull(q.mollieMandateId),
        onOrBefore(BALANCE_DAYS_BEFORE + NOTICE_DAYS_BEFORE_CHARGE, today),
        sql`${rideMinus(BALANCE_DAYS_BEFORE)} > ${today}::date`,
      ),
    )
    .orderBy(q.pickupAt)
    .limit(limit);
  for (const r of rows) {
    const from = noticeOn(r.paymentPlan, r.pickupAt);
    const due = balanceDueOn(r.paymentPlan, r.pickupAt);
    if (!from || !due || today < from || today >= due) continue;
    if (!(await claim(r.id, "noticeSentAt"))) continue;
    let cents: number;
    try {
      cents = await balanceCents(r, mode);
    } catch (err) {
      log(`the balance of ${r.reference}`)(err);
      await unclaim(r.id, "noticeSentAt");
      continue;
    }
    if (cents <= 0) continue;
    await event(r.id, "notice_sent", { date: due });
    await emailBalanceNotice(r, cents, due, r.cardLabel).catch(log(`notice for ${r.reference}`));
  }
}

async function balances(mode: "test" | "live", today: string, requestId?: string, limit = 20) {
  const rows = await db
    .select()
    .from(q)
    .where(and(one(requestId), inArray(q.paymentPlan, ["A", "B"]), eq(q.status, "confirmed"), isNull(q.balanceAttemptedAt), isNull(q.declinedAt), onOrBefore(BALANCE_DAYS_BEFORE, today)))
    .orderBy(q.pickupAt)
    .limit(limit);
  for (const r of rows) {
    const due = balanceDueOn(r.paymentPlan, r.pickupAt);
    if (!due || today < due) continue;
    if (!(await claim(r.id, "balanceAttemptedAt"))) continue;
    let result: Awaited<ReturnType<typeof chargeBalance>>;
    try {
      // The amount is worked out by chargeBalance once it holds the booking's one open payment slot
      result = await chargeBalance(r.id, () => balanceCents(r, mode));
    } catch (err) {
      log(`the balance of ${r.reference}`)(err);
      await unclaim(r.id, "balanceAttemptedAt");
      continue;
    }
    if (result.status === "busy") {
      // The customer is paying it themselves right now, or Mollie or Moneybird could not be asked: nothing was charged,
      // so it is looked at again next time
      await unclaim(r.id, "balanceAttemptedAt");
    } else if (result.status === "no_card") {
      // No card to charge (never paid at booking, no consent, or the card is gone): the customer pays on the booking page
      const cents = await amountDue(r.id).catch(() => 0);
      if (cents <= 0) continue;
      await event(r.id, "balance_failed", { amount: (cents / 100).toFixed(2), reason: "no usable card" });
      await Promise.allSettled([emailBalanceFailed(r, cents), notifyTeamBalanceFailed(r, cents, "no usable card saved")]);
    }
    // Charged, pending or failed: the payment's own refresh tells the customer and the team (refreshPayment); refused
    // outright, postBalance does; nothing left to charge: done
  }
}

async function refundsAfterDecline(mode: "test" | "live", requestId?: string, limit = 20) {
  const rows = await db
    .select({ id: pay.id, requestId: pay.requestId })
    .from(pay)
    .innerJoin(q, eq(q.id, pay.requestId))
    .where(and(requestId ? eq(q.id, requestId) : undefined, isNotNull(q.declinedAt), eq(pay.status, "paid"), eq(pay.mode, mode), sql`${pay.amountCents} > ${pay.refundedCents} + ${pay.chargedBackCents}`))
    .orderBy(pay.updatedAt)
    .limit(limit);
  for (const row of rows) {
    const left = await refundable(row.id);
    if (left > 0) await refundPayment(row.id, left, null).catch(log(`refunding a payment after a decline`));
  }
}

/** Runs the scheduled steps, for one booking (a webhook, the customer's return) or for all that are due (the cron sweep). */
export async function runPaymentSteps(requestId?: string): Promise<void> {
  const config = mollieConfig();
  if (!config) return;
  const today = amsterdamDay();
  const steps: [string, () => Promise<void>][] = [
    ["automatic approval", () => autoApprove(config.mode, requestId)],
    ["announcements", () => announcePaid(config.mode, requestId)],
    ["card warnings", () => cardWarnings(requestId)],
    ["notices", () => notices(config.mode, today, requestId)],
    ["balances", () => balances(config.mode, today, requestId)],
    ["refunds after a decline", () => refundsAfterDecline(config.mode, requestId)],
  ];
  for (const [name, step] of steps) await step().catch(log(name));
}
