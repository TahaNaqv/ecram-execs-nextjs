import "server-only";
import { cachedDriveEstimate } from "@/lib/fleet/estimate";
import { routeEstimate } from "@/lib/fleet/route";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import type { Price } from "@/lib/pricing/rates";
import { formatRouteSpan, spanFromPrice, type RouteWords } from "@/lib/pricing/route-span";

type SavedBooking = {
  service: string;
  collection?: string | null;
  destination?: string | null;
  destinations?: string[] | null;
  durationHours?: number | null;
  priceEstimate?: Price | null;
};

/**
 * The Distance, time line for a booking already stored.
 * A snapshot from the price wins. Otherwise the same cached drive the quote used is asked again.
 * Older rows that only kept the rate card's kilometres still produce a line, and a route with no figure at all says so.
 */
export async function savedRouteLine(
  booking: SavedBooking,
  words: RouteWords & { unavailable: string; hourly: string },
  locale: Locale,
): Promise<string> {
  const stored = spanFromPrice(booking.priceEstimate);
  const exact = Boolean(booking.priceEstimate?.distanceMeters && booking.priceEstimate?.driveSeconds);
  if (exact && stored) return formatRouteSpan(stored, words, locale);

  const hourly = booking.service === "hourly";
  const from = booking.collection?.trim() ?? "";
  const to = booking.destination?.trim() ?? "";
  if (!hourly && from && to) {
    const stops = (booking.destinations ?? []).map((place) => place.trim()).filter(Boolean);
    let found: { meters: number; seconds: number } | null = null;
    try {
      found = await cachedDriveEstimate(from, to, stops);
    } catch (err) {
      console.error("[saved-route] cached estimate failed", err);
      found = await routeEstimate({ service: "business_travel", collection: from, destination: to, destinations: stops }).catch(() => null);
    }
    if (found && found.meters > 0 && found.seconds > 0) return formatRouteSpan(found, words, locale);
  }

  if (hourly && booking.durationHours && booking.durationHours > 0) return interpolate(words.hourly, { hours: booking.durationHours });
  if (stored) return formatRouteSpan(stored, words, locale);
  return words.unavailable;
}
