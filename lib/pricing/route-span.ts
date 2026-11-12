import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import type { Price } from "@/lib/pricing/rates";

export type RouteSpan = { meters: number; seconds: number };

export type RouteWords = {
  reviewDistanceValue: string;
  reviewHoursMinutes: string;
  reviewMinutes: string;
};

const positive = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

function timeText(seconds: number, words: RouteWords): string {
  const total = Math.max(1, Math.round(seconds / 60));
  return total >= 60
    ? interpolate(words.reviewHoursMinutes, { hours: Math.floor(total / 60), minutes: total % 60 })
    : interpolate(words.reviewMinutes, { minutes: total });
}

/** "176.8 km · 2 h 13 m" from a distance and a drive, in the visitor's language. */
export function formatRouteSpan(span: RouteSpan, words: RouteWords, locale: Locale): string {
  const km = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 }).format(span.meters / 1000);
  return interpolate(words.reviewDistanceValue, { km, time: timeText(span.seconds, words) });
}

/**
 * The distance and drive kept on the price. Exact when Google's figures were stored.
 * Otherwise the rate card's kilometre total and the billed hours, which older bookings still have.
 */
export function spanFromPrice(price: Price | null | undefined): RouteSpan | null {
  if (!price) return null;
  if (positive(price.distanceMeters) && positive(price.driveSeconds)) {
    return { meters: price.distanceMeters, seconds: price.driveSeconds };
  }
  const leg = price.legs?.find((item) => item.leg === "outward") ?? price.legs?.[0];
  const km = leg?.km?.distance;
  const hours = leg?.hours;
  // Hours alone are the billing minimum when the drive was never timed. They are not a route.
  if (!positive(km) || !positive(hours)) return null;
  return { meters: km * 1000, seconds: hours * 3600 };
}
