import { hasHighRateExtras, priceNet, vatByRate, type Price } from "@/lib/pricing/rates";

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
 * The booking receipt's lines, in the order the downloadable receipt prints them: chauffeur service (hours, with extra
 * kilometres taken out onto their own line), each add-on as "count × name", the service fee, then VAT at 9% and at 21%.
 * Null when those lines would not add up to the total, so a receipt never splits a figure it cannot explain.
 * `names` lines up with the price's add-on lines (the same names the booking page stores on the receipt).
 */
export function receiptLineItems(p: Price, t: ReceiptWords, names: readonly string[]): { label: string; cents: number }[] | null {
  const vat = vatByRate(p);
  const extrasNet = (p.extras ?? []).reduce((sum, line) => sum + line.amount, 0);
  if (p.rides + extrasNet + p.fee !== priceNet(p) || priceNet(p) + vat.low + vat.high !== p.total) return null;
  const km = p.legs.reduce((sum, leg) => sum + (leg.km?.lines ?? []).reduce((n, line) => n + line.amount, 0), 0);
  return [
    { label: t.receiptRides, cents: p.rides - km },
    ...(km > 0 ? [{ label: t.receiptKm, cents: km }] : []),
    ...(p.extras ?? []).map((line, i) => ({ label: `${line.count} × ${names[i] ?? line.key}`, cents: line.amount })),
    { label: t.priceServiceFee, cents: p.fee },
    { label: t.priceVat, cents: vat.low },
    ...(vat.high ? [{ label: hasHighRateExtras(p) ? t.priceVatHigh : t.priceFeeVat, cents: vat.high }] : []),
  ];
}
