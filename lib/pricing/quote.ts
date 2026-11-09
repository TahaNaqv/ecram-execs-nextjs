import "server-only";
import { cachedDriveEstimate, estimateEnabled } from "@/lib/fleet/estimate";
import { carsToPrice } from "./booking";
import { cleanExtras } from "./extras";
import { priceBooking, type Price, type Segment } from "./rates";

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

type Priced = {
  service: string;
  collection?: string | null;
  destination?: string | null;
  destinations?: string[] | null;
  destinationWaits?: number[] | null;
  pickupAt?: string | null;
  returnAt?: string | null;
  durationHours?: number | null;
  passengers?: number | null;
  luggage?: number | null;
  vehicle?: string | null;
  vehicles?: unknown;
  extras?: unknown;
};

/**
 * The rate-card price of a booking as it is saved, worked out on the server whatever the browser showed. A transfer's
 * hours come from the same cached drive time the review step showed (see /api/route-estimate), so the two agree. Null
 * when it cannot be priced; never throws, so pricing can never stop a booking.
 */
export async function priceForRequest(b: Priced, segment: Segment): Promise<Price | null> {
  if (!b.pickupAt || b.service === "bespoke") return null;
  // An hourly booking without its hours (the team's own form does not ask) is not priced as a transfer
  if (b.service === "hourly" && !b.durationHours) return null;
  try {
    const hourly = b.service === "hourly" && Boolean(b.durationHours);
    const stops = (b.destinations ?? []).map(clean).filter(Boolean);
    let driveSeconds: number | null = null;
    let distanceMeters: number | null = null;
    if (!hourly && b.collection && b.destination && estimateEnabled()) {
      const found = await cachedDriveEstimate(clean(b.collection), clean(b.destination), stops).catch(() => null);
      driveSeconds = found?.seconds ?? null;
      distanceMeters = found?.meters ?? null;
    }
    // Each stop's wait, as the form sent them with the stops (blank stops are dropped with their waits)
    const waitMinutes = hourly ? 0 : (b.destinationWaits ?? []).slice(0, stops.length).reduce((sum, w) => sum + (Number.isFinite(w) && w > 0 ? w : 0), 0);
    const { cars, suggested } = carsToPrice(b);
    return priceBooking({
      segment,
      pickupAt: b.pickupAt,
      returnAt: b.returnAt,
      hours: hourly ? b.durationHours : null,
      driveSeconds,
      distanceMeters,
      waitMinutes,
      cars,
      suggested,
      extras: cleanExtras(b.extras),
    });
  } catch (err) {
    console.error("[pricing] could not price a booking", err);
    return null;
  }
}
