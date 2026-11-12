import { buildReceiptPdf } from "@/app/[locale]/_components/booking/receipt-pdf";
import { formatPickup, formatTimestamp } from "@/lib/admin/format";
import { asPrice, grossEuros, vatOf } from "@/lib/admin/financials-vat";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { extraName, type ExtraNames } from "@/lib/pricing/extras";
import { receiptLineItems, type ReceiptWords } from "@/lib/pricing/receipt-lines";
import { centsOf, formatCents, formatCurrency, type Price } from "@/lib/pricing/rates";
import { vehicleByKey } from "@/lib/fleet/vehicles";

export type ReceiptBooking = {
  reference: string;
  name: string;
  email: string;
  phone: string;
  collection: string | null;
  destination: string | null;
  destinations: string[] | null;
  pickupAt: string | null;
  createdAt: Date;
  vehicle: string | null;
  vehicles: { key: string; count: number }[] | null;
  quotedAmount: string | null;
  priceEstimate: unknown;
  service: string;
  durationHours: number | null;
  entity: string | null;
  itinerary: string | null;
};

export type ReceiptCopy = {
  status: string;
  service: string;
  hourly: string;
  net: string;
  vatLow: string;
  vatHigh: string;
  words: ReceiptWords;
  extras: ExtraNames;
};

function routeOf(row: ReceiptBooking, hourly: string): { pickup?: string; stops: string[]; dropoff?: string; route: string } {
  if (row.service === "bespoke") {
    const route = [row.entity, row.itinerary].map((part) => part?.trim()).filter(Boolean).join(" · ");
    return { stops: [], route: route || row.service };
  }
  const stops = [row.collection, ...(row.destinations ?? [])].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  const dropoff = row.destination?.trim();
  if (dropoff && dropoff !== stops[stops.length - 1]) stops.push(dropoff);
  if (stops.length === 0 && row.durationHours) return { stops: [], route: interpolate(hourly, { hours: row.durationHours }) };
  return {
    pickup: stops[0],
    stops: stops.slice(1, -1),
    dropoff: stops.length > 1 ? stops[stops.length - 1] : undefined,
    route: stops.join(" - "),
  };
}

function vehicleLine(row: ReceiptBooking): string | undefined {
  const picked = (row.vehicles ?? [])
    .map((car) => {
      const name = vehicleByKey(car.key)?.name;
      if (!name) return null;
      return car.count > 1 ? `${car.count} x ${name}` : name;
    })
    .filter((name): name is string => Boolean(name));
  if (picked.length > 0) return picked.join(", ");
  return vehicleByKey(row.vehicle)?.name;
}

function rateCardLines(price: Price, gross: number, words: ReceiptWords, names: ExtraNames): { label: string; value: string }[] | null {
  const snap = (centsOf(price.total) ?? 0) / 100;
  if (Math.abs(snap - gross) >= 0.02) return null;
  try {
    const items = receiptLineItems(price, words, (price.extras ?? []).map((line) => extraName(names, line)));
    if (!items) return null;
    return items.map((item) => ({ label: item.label, value: formatCents(item.cents, "nl") }));
  } catch {
    return null;
  }
}

/** The same one-page confirmation the booking flow downloads, filled from the stored booking. */
export function buildBookingReceipt(row: ReceiptBooking, copy: ReceiptCopy, locale: Locale): Uint8Array {
  const gross = grossEuros({ quotedAmount: row.quotedAmount, priceEstimate: asTotal(row.priceEstimate) });
  const price = asPrice(row.priceEstimate);
  const journey = routeOf(row, copy.hourly);
  const card = price ? rateCardLines(price, gross, copy.words, copy.extras) : null;
  const vat = vatOf(gross, row.priceEstimate);
  const lines =
    card ??
    [
      { label: copy.net, value: formatCurrency(Math.round((gross - vat.low - vat.high) * 100) / 100) },
      { label: copy.vatLow, value: formatCurrency(vat.low) },
      ...(vat.high ? [{ label: copy.vatHigh, value: formatCurrency(vat.high) }] : []),
    ];

  return buildReceiptPdf({
    reference: row.reference,
    status: copy.status,
    clientName: row.name,
    clientEmail: row.email,
    clientPhone: row.phone,
    route: journey.route || copy.service,
    when: row.pickupAt ? formatPickup(row.pickupAt, locale) : formatTimestamp(row.createdAt, locale),
    pickup: journey.pickup,
    stops: journey.stops,
    dropoff: journey.dropoff,
    vehicle: vehicleLine(row),
    lines,
    total: formatCurrency(gross),
  });
}

function asTotal(value: unknown): { total?: unknown } | null {
  if (!value || typeof value !== "object" || !("total" in value)) return null;
  return { total: (value as { total?: unknown }).total };
}
