import type { Price } from "@/lib/pricing/rates";

/**
 * A booking belongs to a corporate partner when a partner account is attached, it was made in the partner portal
 * or on the partner site, or it was priced on the corporate rate card.
 * A company name on a public booking, and a private occasion, do not make it corporate.
 */
export function isCorporateBooking(r: {
  corporateContactId?: string | null;
  source?: string | null;
  priceEstimate?: Pick<Price, "segment"> | null;
}): boolean {
  if (r.corporateContactId) return true;
  if (r.source === "portal" || r.source === "website-corporate") return true;
  if (r.priceEstimate?.segment === "corporate") return true;
  return false;
}

/** The two kinds the booking form asks for. An airport trip and an hourly booking are still one of these. */
export type TripKind = "business" | "private";

/**
 * Business travel or a private occasion. The stored service can also be an airport transfer or an hourly booking;
 * those describe the car's day, not the kind of trip, so they are not shown as the service.
 */
export function tripKind(r: {
  service: string;
  entity?: string | null;
  entityKvk?: string | null;
  priceEstimate?: Price | null;
}): TripKind {
  const purpose = r.priceEstimate?.purpose;
  if (purpose === "private" || purpose === "business") return purpose;
  if (r.service === "private_occasion") return "private";
  if (r.service === "business_travel") return "business";
  // Older airport and hourly rows did not keep the choice. Business is the one that asks for a company.
  if (r.entity?.trim() || r.entityKvk?.trim()) return "business";
  return "private";
}

/** The name shown in the bookings list: Private Occasion or Business Travel. A bespoke programme keeps its own name. */
export function bookingServiceName(
  r: { service: string; entity?: string | null; entityKvk?: string | null; priceEstimate?: Price | null },
  labels: { private_occasion: string; business_travel: string; bespoke: string },
): string {
  if (r.service === "bespoke") return labels.bespoke;
  return tripKind(r) === "private" ? labels.private_occasion : labels.business_travel;
}
