import { bookingTotalEuros, centsOf, vatByRate, type Price } from "@/lib/pricing/rates";

export type VatSplit = { low: number; high: number; estimated: boolean };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A stored rate-card snapshot, or null when the JSON cannot support a VAT split. */
export function asPrice(value: unknown): Price | null {
  if (!value || typeof value !== "object") return null;
  const price = value as Partial<Price>;
  if (!Array.isArray(price.legs)) return null;
  if (centsOf(price.rides) == null || centsOf(price.vat) == null || centsOf(price.fee) == null || centsOf(price.total) == null) return null;
  return price as Price;
}

/**
 * Inclusive 9% (the Dutch rate on passenger transport) when the booking has no rate-card split.
 * `gross * 9/109` is the VAT inside a price that already includes 9%.
 */
function transportVat(gross: number): VatSplit {
  return { low: round2((gross * 0.09) / 1.09), high: 0, estimated: true };
}

/**
 * VAT in euros for one booking.
 * The rate card stores 9% on the ride (and flowers) and 21% on the service fee and the other add-ons.
 * A later override of the invoiced total keeps that ratio and is marked estimated.
 * With no snapshot, the whole gross is treated as passenger transport at 9%.
 */
export function vatOf(gross: number, priceEstimate: unknown): VatSplit {
  if (!(gross > 0)) return { low: 0, high: 0, estimated: false };
  const price = asPrice(priceEstimate);
  if (!price) return transportVat(gross);
  const snap = (centsOf(price.total) ?? 0) / 100;
  const split = vatByRate(price);
  const low = split.low / 100;
  const high = split.high / 100;
  if (!(snap > 0) || low + high <= 0 || low < 0 || high < 0) return transportVat(gross);
  if (Math.abs(snap - gross) < 0.02) return { low: round2(low), high: round2(high), estimated: false };
  const scale = gross / snap;
  const scaledLow = round2(low * scale);
  const scaledHigh = round2(high * scale);
  if (scaledLow + scaledHigh > gross + 0.05) return transportVat(gross);
  return { low: scaledLow, high: scaledHigh, estimated: true };
}

/** The VAT-inclusive euros stored on the booking (the same figure the rest of the admin adds up). */
export function grossEuros(row: { quotedAmount?: string | number | null; priceEstimate?: { total?: unknown } | null }): number {
  const amount = bookingTotalEuros(row);
  const gross = amount == null ? 0 : Number(amount);
  return Number.isFinite(gross) ? round2(gross) : 0;
}
