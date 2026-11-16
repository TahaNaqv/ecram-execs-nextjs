import type { Price } from "@/lib/pricing/rates";
import { SERVICE_FEE_CENTS, SERVICE_FEE_VAT_RATE, centsOf } from "@/lib/pricing/rates";

/**
 * When a booking is paid, and whether it is approved by itself (the client, 15 Nov 2026):
 *
 * | plan | the ride is…                  | at booking                         | later                               | approval  |
 * | A    | 6 calendar months or more away | the service fee (fee + its VAT)    | the rest, 30 days before the ride   | automatic |
 * | B    | 31 days to 6 months away       | the service fee                    | the rest, 30 days before the ride   | by hand   |
 * | C    | 30 days or less away           | the full amount                    | nothing                             | by hand   |
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

/** The service fee with its VAT, from the booking's own price (€12.50 + 21% = €15.13 on the 2027 card). */
export function feeWithVatCents(price: Pick<Price, "fee" | "feeVat"> | null | undefined): number {
  const fee = centsOf(price?.fee) ?? SERVICE_FEE_CENTS;
  const vat = centsOf(price?.feeVat) ?? Math.round(fee * SERVICE_FEE_VAT_RATE);
  return fee + vat;
}

/** What is paid at booking: the fee (plans A and B), or everything (plan C). */
export function upfrontCents(plan: PaymentPlan, totalCents: number, price: Pick<Price, "fee" | "feeVat"> | null | undefined): number {
  return plan === "C" ? totalCents : Math.min(totalCents, feeWithVatCents(price));
}

/** The day the rest is charged: 30 days before the ride. Null for plan C (paid in full at booking). */
export function balanceDueOn(plan: PaymentPlan | null, pickupAt: string | null | undefined): string | null {
  if (!plan || plan === "C" || !pickupAt) return null;
  return addDays(rideDay(pickupAt), -BALANCE_DAYS_BEFORE);
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
