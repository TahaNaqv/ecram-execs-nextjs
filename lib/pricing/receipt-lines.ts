import { hasHighRateExtras, priceNet, VAT_RATE, vatByRate, type Price } from "@/lib/pricing/rates";

/** The words a receipt uses for its lines. Both the booking receipt and the concierge fare read from these. */
export type ReceiptWords = {
  receiptRides: string;
  receiptKm: string;
  priceServiceFee: string;
  priceVat: string;
  priceVatHigh: string;
  priceFeeVat: string;
};

/**
 * The booking receipt's lines, grouped by VAT rate as the client asked (11 Nov 2026): first what carries 9% (the chauffeur
 * service, with extra kilometres on their own line, and the flowers) and the 9% VAT, then what carries 21% (the other
 * add-ons, as "count × name", and the service fee) and the 21% VAT. `divider` marks the first line of the 21% group, so
 * each renderer can draw a line between the two.
 * Null when those lines would not add up to the total, so a receipt never splits a figure it cannot explain.
 * `names` lines up with the price's add-on lines (the same names the booking page stores on the receipt).
 */
export type ReceiptLine = { label: string; cents: number; divider?: boolean };

export function receiptLineItems(p: Price, t: ReceiptWords, names: readonly string[]): ReceiptLine[] | null {
  const vat = vatByRate(p);
  const extrasNet = (p.extras ?? []).reduce((sum, line) => sum + line.amount, 0);
  if (p.rides + extrasNet + p.fee !== priceNet(p) || priceNet(p) + vat.low + vat.high !== p.total) return null;
  const km = p.legs.reduce((sum, leg) => sum + (leg.km?.lines ?? []).reduce((n, line) => n + line.amount, 0), 0);
  const extras = (p.extras ?? []).map((line, i) => ({ low: line.vatRate === VAT_RATE, label: `${line.count} × ${names[i] ?? line.key}`, cents: line.amount }));
  const high: ReceiptLine[] = [
    ...extras.filter((line) => !line.low).map(({ label, cents }) => ({ label, cents })),
    { label: t.priceServiceFee, cents: p.fee },
    ...(vat.high ? [{ label: hasHighRateExtras(p) ? t.priceVatHigh : t.priceFeeVat, cents: vat.high }] : []),
  ];
  high[0] = { ...high[0], divider: true };
  return [
    { label: t.receiptRides, cents: p.rides - km },
    ...(km > 0 ? [{ label: t.receiptKm, cents: km }] : []),
    ...extras.filter((line) => line.low).map(({ label, cents }) => ({ label, cents })),
    { label: t.priceVat, cents: vat.low },
    ...high,
  ];
}
