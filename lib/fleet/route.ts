import "server-only";
import { amsterdamInstant, blockMinutesFor, parseDuration, ROUTED_SERVICES } from "@/lib/fleet/trip";

/**
 * A real drive time from Google's Routes API, so the schedule holds a car for as long as the trip takes rather than for a
 * guess. It only ever improves the estimate: the key missing, Google slow, a place it cannot find, anything at all, gives
 * null and the booking carries on with the service's estimate. It is never called while the fleet lock is held.
 */
const URL_ROUTES = process.env.ROUTES_API_URL ?? "https://routes.googleapis.com/directions/v2:computeRoutes";

export const routesEnabled = () => Boolean(process.env.GOOGLE_MAPS_API_KEY);

export type RoutedBooking = {
  service: string;
  collection?: string | null;
  destination?: string | null;
  destinations?: string[] | null;
  destinationWaits?: number[] | null;
  pickupAt?: string | null;
  pickupPlaceId?: string | null;
  destinationPlaceId?: string | null;
};

/** A place Google can find: its id when the booking kept one, else the address as typed. */
const waypoint = (address: string, placeId?: string | null) => (placeId ? { placeId } : { address });

/** The longest one-way drive that is believed: clients are collected across the Benelux and its neighbours, so more means the wrong place was found. */
const MAX_PLAUSIBLE_DRIVE_SECONDS = 6 * 3600;

async function drive(b: RoutedBooking, useIds: boolean): Promise<{ seconds: number } | { status: number }> {
  const stops = (b.destinations ?? []).filter(Boolean);
  // Traffic for the hour of the pick-up; Google only takes a time in the future
  const pickup = amsterdamInstant(b.pickupAt);
  const departureTime = pickup && pickup.getTime() > Date.now() + 60_000 ? pickup.toISOString() : undefined;
  const res = await fetch(URL_ROUTES, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, "X-Goog-FieldMask": "routes.duration" },
    body: JSON.stringify({
      origin: waypoint(b.collection!, useIds ? b.pickupPlaceId : null),
      destination: waypoint(b.destination!, useIds ? b.destinationPlaceId : null),
      intermediates: stops.map((address) => ({ address })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime,
      regionCode: "NL",
      languageCode: "en",
    }),
  });
  if (!res.ok) {
    console.error(`[routes] Google answered ${res.status} (a 403 usually means the Routes API is not enabled for this key): ${(await res.text()).slice(0, 300)}`);
    return { status: res.status };
  }
  const data = (await res.json()) as { routes?: { duration?: string }[] };
  const seconds = parseDuration(data.routes?.[0]?.duration);
  return seconds === null ? { status: 204 } : { seconds };
}

/** The minutes a booking's car is held for its trip, from the route; null when it cannot be told (see above). */
export async function routeBlockMinutes(b: RoutedBooking): Promise<number | null> {
  if (!routesEnabled() || !ROUTED_SERVICES.has(b.service) || !b.collection || !b.destination || !b.pickupAt) return null;
  try {
    let result = await drive(b, true);
    // A place id Google no longer knows is found again from the address the booking also carries
    if ("status" in result && (result.status === 404 || result.status === 400) && (b.pickupPlaceId || b.destinationPlaceId)) result = await drive(b, false);
    if (!("seconds" in result)) return null;
    // A route that long means an address was found in the wrong place: better the estimate than a car held for half a day
    if (result.seconds > MAX_PLAUSIBLE_DRIVE_SECONDS) {
      console.error(`[routes] ignored an implausible ${Math.round(result.seconds / 60)} minute drive from "${b.collection}" to "${b.destination}"`);
      return null;
    }
    const stops = (b.destinations ?? []).filter(Boolean);
    const waitMinutes = (b.destinationWaits ?? []).slice(0, stops.length).reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0);
    return blockMinutesFor({ service: b.service, driveSeconds: result.seconds, waitMinutes });
  } catch (error) {
    console.error("[routes] could not get a drive time, the service's estimate is used:", error);
    return null;
  }
}
