import { FLEET_BASE } from "./base.ts";
import { amsterdamInstant, blockMinutesFor, parseDuration, ROUTED_SERVICES } from "./trip.ts";

/**
 * A real drive from Google's Routes API: how long it takes (so the schedule holds a car for the trip rather than for a
 * guess) and, for the day map, the line it follows. It only ever improves on the estimate: the key missing, Google slow, a
 * place it cannot find, anything at all, gives null and the booking carries on. It is never called while the fleet lock is held.
 *
 * This file is read by scripts as well as the site, so it imports nothing from `@/` and has no `server-only` guard: the site
 * reaches it through lib/fleet/route.ts, which has.
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

/** A place Google can find: its id when the booking kept a Google one, else the address as typed. Our own list uses curated-* ids. */
const waypoint = (address: string, placeId?: string | null) => (placeId && !placeId.startsWith("curated-") ? { placeId } : { address });

/**
 * The longest one-way drive that is believed: the booking takes addresses in the Netherlands and the EU countries within about
 * ten hours' drive (the client, 7 Nov 2026), so more means the wrong place was found.
 */
const MAX_PLAUSIBLE_DRIVE_SECONDS = 11 * 3600;

type Drive = { seconds: number; meters: number | null; line: string | null } | { status: number };

/** `traffic: false` is the cheaper request without traffic, for an estimate that does not depend on the hour */
async function drive(b: RoutedBooking, useIds: boolean, withLine: boolean, traffic = true): Promise<Drive> {
  const stops = (b.destinations ?? []).filter(Boolean);
  // Traffic for the hour of the pick-up; Google only takes a time in the future
  const pickup = traffic ? amsterdamInstant(b.pickupAt) : null;
  const departureTime = pickup && pickup.getTime() > Date.now() + 60_000 ? pickup.toISOString() : undefined;
  const res = await fetch(URL_ROUTES, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
      "X-Goog-FieldMask": withLine ? "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" : "routes.duration,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: waypoint(b.collection!, useIds ? b.pickupPlaceId : null),
      destination: waypoint(b.destination!, useIds ? b.destinationPlaceId : null),
      intermediates: stops.map((address) => ({ address })),
      travelMode: "DRIVE",
      routingPreference: traffic ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE",
      // The map needs the shape of the route, not every bend of it
      ...(withLine ? { polylineQuality: "OVERVIEW" } : {}),
      departureTime,
      regionCode: "NL",
      languageCode: "en",
    }),
  });
  if (!res.ok) {
    console.error(`[routes] Google answered ${res.status} (a 403 usually means the Routes API is not enabled for this key): ${(await res.text()).slice(0, 300)}`);
    return { status: res.status };
  }
  const data = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }[] };
  const seconds = parseDuration(data.routes?.[0]?.duration);
  if (seconds === null) return { status: 204 };
  const meters = data.routes?.[0]?.distanceMeters;
  const line = data.routes?.[0]?.polyline?.encodedPolyline;
  return { seconds, meters: typeof meters === "number" ? meters : null, line: typeof line === "string" && line ? line : null };
}

/** The drive Google finds for a booking, or null when it cannot be told (see above). */
async function lookup(b: RoutedBooking, withLine: boolean, traffic = true): Promise<{ seconds: number; meters: number | null; line: string | null } | null> {
  if (!routesEnabled() || !ROUTED_SERVICES.has(b.service) || !b.collection || !b.destination || (traffic && !b.pickupAt)) return null;
  try {
    let result = await drive(b, true, withLine, traffic);
    // A place id Google no longer knows is found again from the address the booking also carries
    if ("status" in result && (result.status === 404 || result.status === 400) && (b.pickupPlaceId || b.destinationPlaceId)) result = await drive(b, false, withLine, traffic);
    if (!("seconds" in result)) return null;
    // A route that long means an address was found in the wrong place: better the estimate than a car held for half a day
    if (result.seconds > MAX_PLAUSIBLE_DRIVE_SECONDS) {
      console.error(`[routes] ignored an implausible ${Math.round(result.seconds / 60)} minute drive from "${b.collection}" to "${b.destination}"`);
      return null;
    }
    return result;
  } catch (error) {
    console.error("[routes] could not get a drive, the service's estimate is used:", error);
    return null;
  }
}

/** The minutes a booking's car is held for its trip, from the route; null when it cannot be told. */
export async function routeBlockMinutes(b: RoutedBooking): Promise<number | null> {
  const found = await lookup(b, false);
  if (!found) return null;
  const stops = (b.destinations ?? []).filter(Boolean);
  const waitMinutes = (b.destinationWaits ?? []).slice(0, stops.length).reduce((sum, w) => sum + (Number.isFinite(w) ? w : 0), 0);
  return blockMinutesFor({ service: b.service, driveSeconds: found.seconds, waitMinutes });
}

/** How far and how long a trip drives without traffic, for the visitor's review of a booking; null when it cannot be told. */
export async function routeEstimate(b: RoutedBooking): Promise<{ meters: number; seconds: number } | null> {
  const found = await lookup(b, false, false);
  return found && found.meters !== null ? { meters: found.meters, seconds: found.seconds } : null;
}

/** The line a booking's route follows, as Google's encoded polyline; null when it cannot be told. */
export async function routeLine(b: RoutedBooking): Promise<string | null> {
  return (await lookup(b, true))?.line ?? null;
}

/**
 * The minutes the car needs after the trip to drive home: from the drop-off to `FLEET_BASE` (until that is set, back to the
 * pick-up), without traffic and rounded up to five minutes. Null when it cannot be told; the buffer then applies on its own.
 */
export async function routeDriveBackMinutes(b: RoutedBooking): Promise<number | null> {
  const home = FLEET_BASE.address ? FLEET_BASE : { address: b.collection ?? "", placeId: b.pickupPlaceId ?? null };
  if (!b.destination || !home.address) return null;
  const found = await lookup(
    { service: b.service, collection: b.destination, pickupPlaceId: b.destinationPlaceId, destination: home.address, destinationPlaceId: home.placeId, destinations: [] },
    false,
    false,
  );
  return found ? Math.ceil(found.seconds / 60 / 5) * 5 : null;
}

/** What confirming a booking needs from the route, asking Google only for what the booking does not have yet. */
export async function routeHold(b: RoutedBooking & { blockMinutes?: number | null; driveBackMinutes?: number | null }): Promise<{ blockMinutes: number | null; driveBackMinutes: number | null }> {
  const [blockMinutes, driveBackMinutes] = await Promise.all([
    b.blockMinutes == null ? routeBlockMinutes(b) : null,
    b.driveBackMinutes == null ? routeDriveBackMinutes(b) : null,
  ]);
  return { blockMinutes, driveBackMinutes };
}
