import { createHash } from "node:crypto";
import type { Locale } from "@/lib/i18n/config";
import { formatPickup } from "@/lib/corporate/format";
import { convoyTitle, vehicleByKey } from "@/lib/fleet/vehicles";
import { extraName, type ExtraNames } from "@/lib/pricing/extras";
import { bookingTotalEuros, centsOf, SERVICE_FEE_VAT_RATE, VAT_RATE, type Price } from "@/lib/pricing/rates";
import { serviceLabel } from "@/lib/quotes/constants";
import { vatOf } from "@/lib/admin/financials-vat";
import { INVOICE_WORDS } from "./words";

/**
 * What a booking's Moneybird invoice says. Pure, so it is tested on its own (no database, no network).
 *
 * The lines carry prices *including* VAT (`prices_are_incl_tax`), so they add up to the very cents the customer agreed to.
 * The rate card stores each part before VAT with its own VAT (rides and flowers at 9%, the service fee and the other add-ons
 * at 21%), so every line is that part plus its own VAT. Moneybird then works the VAT out of each rate's total, which can
 * differ from our receipt by a cent at most; the total cannot.
 */

export type Rate = "low" | "high";
export type InvoiceLine = { description: string; cents: number; rate: Rate; ledger: "rides" | "extras" };

export type InvoiceBooking = {
  reference: string;
  service: string;
  collection: string | null;
  destination: string | null;
  durationHours: number | null;
  pickupAt: string | null;
  returnAt: string | null;
  passengers: number | null;
  vehicle: string | null;
  vehicles: unknown;
  locale: Locale;
  quotedAmount: string | null;
  priceEstimate: Price | null;
};

export type InvoiceLabels = { services: Record<string, string>; addOns: ExtraNames };

/** The amount the invoice is for, in cents: the booking's final (the team's override, else the rate-card total). */
export function invoiceCents(r: Pick<InvoiceBooking, "quotedAmount" | "priceEstimate">): number | null {
  const euros = bookingTotalEuros(r);
  if (euros == null) return null;
  const cents = Math.round(Number(euros) * 100);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

/** "EE-1234 · Airport Transfer · 14 Nov 2026, 10:00 · Schiphol → Amsterdam · 2 × Audi e-tron GT" */
export function rideSummary(r: InvoiceBooking, labels: InvoiceLabels): string {
  const words = INVOICE_WORDS[r.locale];
  const where = r.collection
    ? r.destination
      ? `${r.collection} → ${r.destination}`
      : r.durationHours
        ? `${r.collection}, ${words.hours(r.durationHours)}`
        : r.collection
    : null;
  const cars = convoyTitle(r) ?? (r.vehicle ? (vehicleByKey(r.vehicle)?.name ?? null) : null);
  const when = r.pickupAt ? formatPickup(r.pickupAt, r.locale) : null;
  const back = r.returnAt ? `${words.returnJourney} ${formatPickup(r.returnAt, r.locale)}` : null;
  return [r.reference, serviceLabel(r.service, labels.services), when, back, where, cars].filter(Boolean).join(" · ");
}

/** The snapshot's lines, each with its own VAT, or null when they do not add up to its total (then the split is used). */
function snapshotLines(p: Price, r: InvoiceBooking, labels: InvoiceLabels): InvoiceLine[] | null {
  const words = INVOICE_WORDS[r.locale];
  const rides = centsOf(p.rides);
  const ridesVat = centsOf(p.vat);
  const fee = centsOf(p.fee);
  const total = centsOf(p.total);
  if (rides == null || ridesVat == null || fee == null || total == null) return null;
  const kmNet = (Array.isArray(p.legs) ? p.legs : []).reduce(
    (sum, leg) => sum + (Array.isArray(leg?.km?.lines) ? leg.km.lines : []).reduce((n, line) => n + (centsOf(line?.amount) ?? 0), 0),
    0,
  );
  // The rides' VAT was worked out on all of them together: the kilometres take their share, the rest stays with the hours
  const kmGross = kmNet > 0 ? kmNet + Math.round(kmNet * VAT_RATE) : 0;
  const ridesGross = rides + ridesVat - kmGross;
  const lines: InvoiceLine[] = [{ description: rideSummary(r, labels), cents: ridesGross, rate: "low", ledger: "rides" }];
  if (kmGross > 0) lines.push({ description: `${r.reference} · ${words.km}`, cents: kmGross, rate: "low", ledger: "rides" });
  for (const line of Array.isArray(p.extras) ? p.extras : []) {
    const amount = centsOf(line?.amount);
    const vat = centsOf(line?.vat);
    if (amount == null || vat == null) return null;
    // An add-on at a rate the invoice does not know cannot be booked right: the amount is split by rate instead
    if (line.vatRate !== VAT_RATE && line.vatRate !== SERVICE_FEE_VAT_RATE) return null;
    const rate: Rate = line.vatRate === VAT_RATE ? "low" : "high";
    lines.push({ description: `${line.count} × ${extraName(labels.addOns, line)}`, cents: amount + vat, rate, ledger: "extras" });
  }
  // A price stored before 4 Nov 2026 has no VAT on the fee; its total did not include any either, so the sum still holds
  lines.push({ description: words.fee, cents: fee + (centsOf(p.feeVat) ?? 0), rate: "high", ledger: "extras" });
  if (lines.some((line) => line.cents < 0)) return null;
  return lines.reduce((sum, line) => sum + line.cents, 0) === total ? lines.filter((line) => line.cents > 0) : null;
}

/**
 * The invoice's lines for `cents`. The rate card's own lines when the booking still costs what they add up to; otherwise
 * (the team set another price, or the snapshot is incomplete) the amount split between the two rates in the snapshot's
 * proportion; and one 9% line when there is no snapshot at all (a bespoke programme).
 */
export function invoiceLines(r: InvoiceBooking, labels: InvoiceLabels, cents: number): InvoiceLine[] {
  const words = INVOICE_WORDS[r.locale];
  const p = r.priceEstimate;
  const exact = p ? snapshotLines(p, r, labels) : null;
  if (exact && exact.reduce((sum, line) => sum + line.cents, 0) === cents) return exact;
  const summary = rideSummary(r, labels);
  if (exact) {
    const low = exact.filter((line) => line.rate === "low").reduce((sum, line) => sum + line.cents, 0);
    const all = exact.reduce((sum, line) => sum + line.cents, 0);
    const lowShare = all > 0 ? Math.round((cents * low) / all) : cents;
    const highShare = cents - lowShare;
    return [
      { description: `${summary} · ${words.agreed}`, cents: lowShare, rate: "low" as const, ledger: "rides" as const },
      ...(highShare > 0 ? [{ description: words.feeAndExtras, cents: highShare, rate: "high" as const, ledger: "extras" as const }] : []),
    ].filter((line) => line.cents > 0);
  }
  if (p) {
    // A snapshot whose lines do not add up (stored before a field existed): its VAT by rate still says how much of the
    // amount carries 21%, so the fee and add-ons are not invoiced at 9%
    const vat = vatOf(cents / 100, p);
    const lowShare = Math.max(0, Math.min(cents, Math.round(((vat.low * 100) / VAT_RATE) * (1 + VAT_RATE))));
    const highShare = cents - lowShare;
    return [
      { description: `${summary} · ${words.agreed}`, cents: lowShare, rate: "low" as const, ledger: "rides" as const },
      { description: words.feeAndExtras, cents: highShare, rate: "high" as const, ledger: "extras" as const },
    ].filter((line) => line.cents > 0);
  }
  return [{ description: summary, cents, rate: "low", ledger: "rides" }];
}

/**
 * What a credit gives back when the team keeps a cancellation fee: the invoice's amount per VAT group (each a tax rate and
 * ledger account) less the fee, the fee taken from each group in proportion so the credit's VAT matches what is returned.
 * Amounts are positive here; the credit invoice carries them as negative lines. A fee of 0 credits everything.
 */
export function creditSplit<T extends { cents: number }>(groups: T[], feeCents: number): (T & { cents: number })[] {
  const live = groups.filter((group) => group.cents > 0);
  const total = live.reduce((sum, group) => sum + group.cents, 0);
  const back = total - Math.max(0, Math.min(Math.round(feeCents), total));
  if (back <= 0) return [];
  let left = back;
  return live.map((group, i) => {
    const share = i === live.length - 1 ? left : Math.round((back * group.cents) / total);
    left -= share;
    return { ...group, cents: share };
  }).filter((group) => group.cents > 0);
}

/** Days until the invoice is due: a partner's term, or for a website booking the days left until the ride (at least 0). */
export function dueInDays(corporate: boolean, pickupAt: string | null, today: string, partnerTermDays: number): number {
  if (corporate) return partnerTermDays;
  if (!pickupAt) return 0;
  const ride = Date.parse(`${pickupAt.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(ride) || !Number.isFinite(now)) return 0;
  return Math.max(0, Math.round((ride - now) / 86_400_000));
}

/** The booking's reference on its Moneybird invoice: EE-1234 the first time, EE-1234-R2 after a credit and a new confirm. */
export const invoiceReference = (reference: string, attempt: number) => (attempt > 1 ? `${reference}-R${attempt}` : reference);

/** A website guest's customer number in Moneybird: the same person (and company) is found again on a later booking. */
export function guestCustomerId(email: string, entity: string | null): string {
  const key = `${email.trim().toLowerCase()}|${(entity ?? "").trim().toLowerCase()}`;
  return `G-${createHash("sha1").update(key).digest("hex").slice(0, 10)}`;
}

export const partnerCustomerId = (contactId: string) => `P-${contactId.replace(/-/g, "").slice(0, 10)}`;

/** Splits "Jan de Vries" into Moneybird's first and last name. */
export function splitName(name: string): { firstname: string; lastname: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { firstname: "", lastname: parts[0] ?? "" };
  return { firstname: parts[0], lastname: parts.slice(1).join(" ") };
}
