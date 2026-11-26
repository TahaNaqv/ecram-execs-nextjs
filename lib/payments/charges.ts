/** As lib/payments/schedule.ts (kept free of imports so the rule can be tested on its own) */
const BALANCE_DAYS_BEFORE = 30;
const dayMs = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const daysBetween = (from: string, to: string) => Math.round((dayMs(to) - dayMs(from)) / 86_400_000);
const rideDay = (pickupAt: string) => pickupAt.slice(0, 10);

/**
 * How a charge added after booking (close protection) is collected, the client's rule of 27 Nov 2026:
 * - the ride is 30 days away or less, or the booking is already paid in full, or its balance was already taken: it is a
 *   separate charge, with its own invoice;
 * - otherwise it is added to the booking's balance and invoice, collected with the main settlement.
 * Pure; dates are Amsterdam calendar days (YYYY-MM-DD).
 */
export type ChargeBilling = "balance" | "separate";

export function chargeBilling(input: {
  pickupAt: string | null;
  today: string;
  /** Paid so far, net of refunds, in cents */
  paidCents: number;
  /** The booking's total before the charge, in cents (null when it has none yet) */
  totalCents: number | null;
  /** Set once the balance was charged (or tried) */
  balanceAttempted: boolean;
  /** The booking's invoice has nothing left to pay (paid by bank transfer, say: not seen in paidCents) */
  invoicePaid?: boolean;
}): ChargeBilling {
  if (!input.pickupAt) return "separate";
  if (daysBetween(input.today, rideDay(input.pickupAt)) <= BALANCE_DAYS_BEFORE) return "separate";
  if (input.balanceAttempted || input.invoicePaid) return "separate";
  if (input.totalCents != null && input.totalCents > 0 && input.paidCents >= input.totalCents) return "separate";
  return "balance";
}

/** The VAT inside a VAT-inclusive amount. */
export const vatInside = (grossCents: number, basisPoints: number) => grossCents - Math.round((grossCents * 10_000) / (10_000 + basisPoints));
