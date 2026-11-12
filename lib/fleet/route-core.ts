import type { FleetBase } from "./base.ts";
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

/**
 * Places the booking form offers by name. Their coordinates skip the geocoder, so a route between them still has a
 * distance when Google is not configured.
 */
const KNOWN_PLACES: { name: string; lat: number; lon: number }[] = [
  { name: "Amsterdam Airport Schiphol", lat: 52.310539, lon: 4.768274 },
  { name: "Schiphol General Aviation Terminal", lat: 52.3186, lon: 4.7894 },
  { name: "Rotterdam The Hague Airport", lat: 51.956944, lon: 4.437222 },
  { name: "Eindhoven Airport", lat: 51.450139, lon: 5.374528 },
  { name: "Groningen Airport Eelde", lat: 53.11972, lon: 6.57944 },
  { name: "Maastricht Aachen Airport", lat: 50.911658, lon: 5.770144 },
  { name: "Schiphol Airport station", lat: 52.3089, lon: 4.7614 },
  { name: "Amsterdam Centraal", lat: 52.378901, lon: 4.900581 },
  { name: "Den Haag Centraal", lat: 52.08095, lon: 4.325 },
  { name: "Rotterdam Centraal", lat: 51.9225, lon: 4.4694 },
  { name: "Utrecht Centraal", lat: 52.08944, lon: 5.10972 },
];

const foldPlace = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const knownPlace = (address: string) => KNOWN_PLACES.find((place) => foldPlace(place.name) === foldPlace(address)) ?? null;

let geocodeQueue: Promise<unknown> = Promise.resolve();
let lastGeocodeAt = 0;

/** One public geocode at a time, a second apart, which is what that service asks for. */
function paced<T>(work: () => Promise<T>): Promise<T> {
  const run = geocodeQueue.then(async () => {
    const wait = lastGeocodeAt + 1100 - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastGeocodeAt = Date.now();
    return work();
  });
  geocodeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function pointFor(address: string): Promise<{ lat: number; lon: number } | null> {
  const known = knownPlace(address);
  if (known) return { lat: known.lat, lon: known.lon };
  return paced(async () => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("q", address);
    // Prefer the Netherlands, where the bookings are, without refusing a place further away
    url.searchParams.set("viewbox", "3.2,53.7,7.3,50.6");
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json", "User-Agent": "EcramExecs/1.0 (booking route estimate)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const lat = Number(data[0]?.lat);
    const lon = Number(data[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < 35 || lat > 72 || lon < -12 || lon > 32) return null;
    return { lat, lon };
  });
}

/**
 * Driving distance when Google is not set up or cannot find the route. The places we know are used directly; anything
 * else is found, then driven. Null when a place cannot be found, so the review says the route is not available.
 */
async function openDrive(b: RoutedBooking): Promise<{ meters: number; seconds: number } | null> {
  const places = [b.collection, ...(b.destinations ?? []).filter(Boolean), b.destination].filter((place): place is string => Boolean(place?.trim()));
  if (places.length < 2) return null;
  try {
    const points: { lat: number; lon: number }[] = [];
    for (const place of places) {
      const point = await pointFor(place.trim());
      if (!point) return null;
      points.push(point);
    }
    const path = points.map((point) => `${point.lon},${point.lat}`).join(";");
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${path}?overview=false`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json", "User-Agent": "EcramExecs/1.0 (booking route estimate)" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { code?: string; routes?: { distance?: number; duration?: number }[] };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    const meters = route?.distance;
    const seconds = route?.duration;
    if (typeof meters !== "number" || typeof seconds !== "number" || meters <= 0 || seconds <= 0) return null;
    if (seconds > MAX_PLAUSIBLE_DRIVE_SECONDS) return null;
    return { meters: Math.round(meters), seconds: Math.round(seconds) };
  } catch (error) {
    console.error("[routes] could not measure the drive another way:", error);
    return null;
  }
}

/** How far and how long a trip drives without traffic, for the visitor's review of a booking; null when it cannot be told. */
export async function routeEstimate(b: RoutedBooking): Promise<{ meters: number; seconds: number } | null> {
  const found = await lookup(b, false, false);
  if (found && found.meters !== null) return { meters: found.meters, seconds: found.seconds };
  if (!ROUTED_SERVICES.has(b.service) || !b.collection || !b.destination) return null;
  return openDrive(b);
}

/** The line a booking's route follows, as Google's encoded polyline; null when it cannot be told. */
export async function routeLine(b: RoutedBooking): Promise<string | null> {
  return (await lookup(b, true))?.line ?? null;
}

/**
 * The minutes the car needs after the trip to drive home: from the drop-off to the fleet's base (until that is set, back to
 * the pick-up), without traffic and rounded up to five minutes. Null when it cannot be told; the buffer then applies on its own.
 */
export async function routeDriveBackMinutes(b: RoutedBooking, base: FleetBase | null): Promise<number | null> {
  const home = base?.address ? base : { address: b.collection ?? "", placeId: b.pickupPlaceId ?? null };
  if (!b.destination || !home.address) return null;
  const found = await lookup(
    { service: b.service, collection: b.destination, pickupPlaceId: b.destinationPlaceId, destination: home.address, destinationPlaceId: home.placeId, destinations: [] },
    false,
    false,
  );
  return found ? Math.ceil(found.seconds / 60 / 5) * 5 : null;
}

/** What confirming a booking needs from the route, asking Google only for what the booking does not have yet. */
export async function routeHold(
  b: RoutedBooking & { blockMinutes?: number | null; driveBackMinutes?: number | null },
  base: FleetBase | null,
): Promise<{ blockMinutes: number | null; driveBackMinutes: number | null }> {
  const [blockMinutes, driveBackMinutes] = await Promise.all([
    b.blockMinutes == null ? routeBlockMinutes(b) : null,
    b.driveBackMinutes == null ? routeDriveBackMinutes(b, base) : null,
  ]);
  return { blockMinutes, driveBackMinutes };
}
