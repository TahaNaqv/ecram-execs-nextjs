import type { Price } from "@/lib/pricing/rates";
import { SERVICE_FEE_CENTS, SERVICE_FEE_VAT_RATE, centsOf } from "@/lib/pricing/rates";

/**
 * When a booking is paid, and whether it is approved by itself (launch rules):
 *
 * | plan | the ride is…                         | confirmation                         | once confirmed                                      |
 * | A    | 6 calendar months or more away       | automatic, as soon as it is booked   | the €12.50 service fee, then the rest 30 days before |
 * | B    | 31 days up to 6 months away          | a person confirms it first           | the €12.50 service fee, then the rest 30 days before |
 * | C    | 30 days or less away                 | a person confirms it first           | the full amount                                     |
 *
 * Nothing is taken until the booking is confirmed. Plan A confirms itself, then the fee is charged.
 * Plans B and C wait for a person. The fee (B) or the full amount (C) is charged only after that.
 * A corporate booking can invoice the balance on 7, 14 or 30 day terms.
 *
 * The plan is fixed when the booking is made (stored on it). The dates that follow from it are worked out from the ride's
 * date each time, so a changed ride date moves them. All dates are Amsterdam calendar days, "YYYY-MM-DD"; pure, no clock.
 */
export type PaymentPlan = "A" | "B" | "C";
export const BALANCE_DAYS_BEFORE = 30;
export const AUTO_APPROVE_MONTHS = 6;
/** The customer is told this many days before the balance is charged. */
export const NOTICE_DAYS_BEFORE_CHARGE = 5;

const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  return iso(day(date) + days * 86_400_000);
}

/** The same day so many months on, or the month's last day when it has no such day (31 Aug + 6 months = 28/29 Feb). */
export function addMonths(date: string, months: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + months;
  const d = Number(date.slice(8, 10));
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return iso(Date.UTC(year, month, Math.min(d, last)));
}

export function daysBetween(from: string, to: string): number {
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/** The ride's calendar day from a stored pick-up ("2027-06-16T05:00" or "2027-06-16 05:00:00"). */
export const rideDay = (pickupAt: string) => pickupAt.slice(0, 10);

/** The plan for a booking made `today` for a ride at `pickupAt`; null without a date (a bespoke programme is quoted by hand). */
export function planFor(pickupAt: string | null | undefined, today: string): PaymentPlan | null {
  if (!pickupAt) return null;
  const ride = rideDay(pickupAt);
  if (daysBetween(today, ride) <= BALANCE_DAYS_BEFORE) return "C";
  return ride >= addMonths(today, AUTO_APPROVE_MONTHS) ? "A" : "B";
}

/** The service fee itself, in cents. Always €12.50 (1250), never the fee plus its 21% VAT. */
export function serviceFeeCents(price: Pick<Price, "fee"> | null | undefined): number {
  return centsOf(price?.fee) ?? SERVICE_FEE_CENTS;
}

/** The service fee with its VAT, for an invoice line that is stored tax-inclusive. Not the amount taken at booking. */
export function feeWithVatCents(price: Pick<Price, "fee" | "feeVat"> | null | undefined): number {
  const fee = serviceFeeCents(price);
  const vat = centsOf(price?.feeVat) ?? Math.round(fee * SERVICE_FEE_VAT_RATE);
  return fee + vat;
}

/** What is paid once the booking is confirmed: the fee (plans A and B), or everything (plan C). Nothing is taken before that. */
export function upfrontCents(plan: PaymentPlan, totalCents: number, price: Pick<Price, "fee" | "feeVat"> | null | undefined): number {
  return plan === "C" ? totalCents : Math.min(totalCents, serviceFeeCents(price));
}

/** A corporate partner's invoice window, or null when they pay the balance by card. */
export function invoiceTerms(days: number | null | undefined): 7 | 14 | 30 | null {
  return days === 7 || days === 14 || days === 30 ? days : null;
}

export type LaunchSchedule = {
  plan: PaymentPlan | null;
  /** Six months or more ahead: confirmed as soon as it is booked. */
  autoConfirmed: boolean;
  /** Under six months: a person confirms it before any charge. */
  requiresManualApproval: boolean;
  /** Charged once confirmed. The fee, or the whole amount within 30 days. */
  upfrontCents: number;
  /** Charged on its own 30 days before the ride. Zero when the whole amount is taken up front. */
  scheduledBalanceCents: number;
  /** That day, at noon UTC, or null when there is no later charge. */
  scheduledBalanceDate: Date | null;
};

/** Lead time from the ride's Amsterdam day. No date: a hand-quoted programme, with nothing to charge yet. */
export function launchSchedule(
  pickupAt: string | null | undefined,
  today: string,
  totalCents: number,
  price: Pick<Price, "fee" | "feeVat"> | null | undefined,
): LaunchSchedule {
  const plan = planFor(pickupAt, today);
  if (!plan) {
    return { plan: null, autoConfirmed: false, requiresManualApproval: true, upfrontCents: 0, scheduledBalanceCents: 0, scheduledBalanceDate: null };
  }
  const upfront = upfrontCents(plan, totalCents, price);
  const due = balanceDueOn(plan, pickupAt);
  return {
    plan,
    autoConfirmed: confirmsAutomatically(plan),
    requiresManualApproval: requiresManualConfirmation(plan),
    upfrontCents: upfront,
    scheduledBalanceCents: Math.max(0, totalCents - upfront),
    scheduledBalanceDate: due ? new Date(`${due}T12:00:00Z`) : null,
  };
}

/** The day the rest is charged: 30 days before the ride. Null for plan C (paid in full at booking). */
export function balanceDueOn(plan: PaymentPlan | null, pickupAt: string | null | undefined): string | null {
  if (!plan || plan === "C" || !pickupAt) return null;
  return addDays(rideDay(pickupAt), -BALANCE_DAYS_BEFORE);
}

/** Six months or more ahead: the booking confirms itself. Anything nearer waits for the team. */
export function confirmsAutomatically(plan: PaymentPlan | null | undefined): boolean {
  return plan === "A";
}

/** Under six months (plans B and C): no charge until a person confirms the booking. */
export function requiresManualConfirmation(plan: PaymentPlan | null | undefined): boolean {
  return plan === "B" || plan === "C";
}

/** A charge is allowed only after confirmation. The server checks this again; the page's total is not enough. */
export function chargeAllowed(plan: PaymentPlan | null | undefined, status: string | null | undefined): boolean {
  if (status === "cancelled") return false;
  if (plan != null && !confirmsAutomatically(plan) && !requiresManualConfirmation(plan)) return false;
  return status === "confirmed" || status === "completed";
}

/** The day the customer is told the charge is coming. */
export function noticeOn(plan: PaymentPlan | null, pickupAt: string | null | undefined): string | null {
  const due = balanceDueOn(plan, pickupAt);
  return due ? addDays(due, -NOTICE_DAYS_BEFORE_CHARGE) : null;
}

/** "YYYY-MM-DD" for now in Amsterdam. */
export function amsterdamDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
