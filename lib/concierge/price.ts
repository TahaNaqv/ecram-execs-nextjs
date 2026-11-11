import "server-only";
import type { Draft } from "@/lib/concierge/booking";
import { capacityProblem } from "@/app/[locale]/_components/booking/trip";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/types";
import { extraName, type ExtraNames } from "@/lib/pricing/extras";
import { priceForRequest } from "@/lib/pricing/quote";
import { receiptLineItems } from "@/lib/pricing/receipt-lines";
import { formatCents, type Price } from "@/lib/pricing/rates";

/** The fare the concierge card shows. Amounts are already formatted, so the chat does not calculate. */
export type ChatQuote = {
  heading: string;
  exact: boolean;
  lines: { label: string; amount: string }[];
  totalLabel: string;
  total: string;
};

/**
 * The same rate card the booking form stores. Null until the journey can be priced, and null when the chosen car
 * cannot take the party: a price must not be shown for a car the visitor is not allowed to book.
 */
export async function quoteDraft(draft: Draft, booking: Dictionary["booking"], names: ExtraNames, locale: Locale): Promise<ChatQuote | null> {
  if (!draft.at || !draft.from) return null;
  const hourly = draft.mode === "hourly";
  if (hourly && !draft.hours) return null;
  if (!hourly && !draft.to) return null;
  if (draft.vehicle && draft.vehicle !== "advise") {
    const fit = capacityProblem(draft.vehicle, draft.passengers ?? 1, draft.bags ?? null);
    if (fit.passengers || fit.luggage) return null;
  }
  try {
    const price = await priceForRequest(
      {
        service: hourly ? "hourly" : draft.fromKind === "airport" || draft.toKind === "airport" ? "airport_transfer" : "point_to_point",
        collection: draft.from,
        destination: hourly ? null : draft.to,
        destinations: (draft.stops ?? []).map((stop) => stop.place),
        destinationWaits: (draft.stops ?? []).map((stop) => stop.wait),
        pickupAt: draft.at,
        durationHours: hourly ? draft.hours : null,
        passengers: draft.passengers ?? 1,
        luggage: draft.bags ?? 0,
        vehicle: draft.vehicle && draft.vehicle !== "advise" ? draft.vehicle : "advise",
        extras: draft.extras ?? [],
      },
      "public",
    );
    if (!price) return null;
    return present(price, booking, names, locale);
  } catch (error) {
    console.error("[concierge] could not price the draft", error);
    return null;
  }
}

function present(price: Price, booking: Dictionary["booking"], names: ExtraNames, locale: Locale): ChatQuote {
  // The same lines, in the same order, as the receipt a booking made on the website can be downloaded as
  const items = receiptLineItems(price, booking, (price.extras ?? []).map((line) => extraName(names, line))) ?? [];
  return {
    heading: booking.reviewPrice,
    exact: price.exact,
    lines: items.map((line) => ({ label: line.label, amount: formatCents(line.cents, locale) })),
    totalLabel: booking.priceTotal,
    total: `${price.exact ? "" : `${booking.priceFromWord} `}${formatCents(price.total, locale)}`,
  };
}
