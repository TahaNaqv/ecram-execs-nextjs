import { HOURLY_DURATIONS, type Service } from "@/lib/quotes/constants";
import { MAX_STOPS, asWait } from "@/lib/quotes/stops";
import { bagCapacity, FLEET, LARGEST_CAR_SEATS, MAX_CARS, normalizeVehicleKey, vehicleByKey, VEHICLE_CHOICES, type VehicleChoice, type VehicleKey } from "@/lib/fleet/vehicles";
import { curatedKind } from "@/lib/places/curated";
import { isAirportKind, PLACE_KINDS, type PlaceKind } from "@/lib/places/types";
import { cleanExtras, type ExtraPick } from "@/lib/pricing/extras";

/**
 * The journey being booked, as the booking flow holds it between steps. The hero bar sends it to /book in the URL (so it
 * also works without JavaScript, and Back returns to a filled bar); the last step posts it with the visitor's details.
 */
export type Place = { text: string; id: string | null; kind: PlaceKind | null };
export type Stop = { place: string; wait: number };
export type Trip = {
  mode: "oneway" | "hourly";
  from: Place;
  to: Place;
  stops: Stop[];
  /** Hours booked for an hourly trip, or "" when not chosen yet */
  hours: number | "";
  /** Wall-clock "YYYY-MM-DDTHH:mm" in the Netherlands, or "" */
  at: string;
  pax: number;
  /** Large suitcases. Checked against the chosen car's boot. */
  bags: number;
  /** Hand luggage and backpacks. Cabin items, not part of the boot check. */
  small: number;
  /** Whether the visitor has chosen the guests and bags: until then the bar shows a prompt, not a count (QA round 3, bug 7) */
  guestsSet: boolean;
  flight: string;
  /** A fleet key, "advise" for no preference, or "" when not chosen yet. */
  vehicle: VehicleChoice | "";
  /** The cars the visitor chose, with how many of each. Empty when they have not chosen, or when they ask us to choose. */
  cars: { key: VehicleKey; count: number }[];
  /** The add-ons chosen on the step after the car (lib/pricing/extras.ts) */
  extras: ExtraPick[];
};

/** The Cadillac Escalade IQ seats 7, the most in the fleet. The forms that book one car (the partner introduction, the team's own form, the concierge) never take more. */
export const MAX_PASSENGERS = 7;
/** Large suitcases those one-car forms take, before the chosen car's boot is checked. */
export const MAX_BAGS = 6;
/** Hand luggage and backpacks. They ride in the cabin, so the boot does not cap them. */
export const MAX_SMALL_BAGS = 8;
/** How many of one model the booking flow takes. Other models can be added alongside (the client, 7 Nov 2026). */
export const MAX_PER_CAR = MAX_CARS;
/** The booking flow books several cars, so its party can fill `MAX_CARS` of the largest car. */
export const MAX_GROUP = LARGEST_CAR_SEATS * MAX_CARS;
/** Large suitcases the booking flow takes for its party, before the chosen cars' boots are checked. */
export const MAX_GROUP_BAGS = MAX_BAGS * MAX_CARS;

/** Pickup and drop-off, ignoring case and extra spaces. Empty text never matches. */
export function samePlace(a: string, b: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const left = norm(a);
  const right = norm(b);
  return left.length > 0 && left === right;
}

/** Whether the chosen car can seat this party and take these large suitcases. Hand luggage is not part of this. "advise" is not a car yet. */
export function capacityProblem(vehicleKey: string | null | undefined, pax: number, bags: number | null): { passengers: boolean; luggage: boolean } {
  if (!vehicleKey || vehicleKey === "advise") return { passengers: false, luggage: false };
  const car = vehicleByKey(vehicleKey);
  if (!car) return { passengers: false, luggage: false };
  return {
    passengers: pax > (car.specs?.passengers ?? 0),
    luggage: bags != null && bags > bagCapacity(car),
  };
}

/** Whether the chosen cars together seat the party and take its large suitcases. No cars (we choose) is no problem. */
export function carsCapacityProblem(cars: readonly { key: string; count: number }[], pax: number, bags: number | null): { passengers: boolean; luggage: boolean } {
  let seats = 0;
  let boots = 0;
  let any = false;
  for (const pick of cars) {
    const car = vehicleByKey(pick.key);
    if (!car || !Number.isInteger(pick.count) || pick.count < 1) continue;
    any = true;
    seats += (car.specs?.passengers ?? 0) * pick.count;
    boots += bagCapacity(car) * pick.count;
  }
  if (!any) return { passengers: false, luggage: false };
  return { passengers: pax > seats, luggage: bags != null && bags > boots };
}

/** The cars chosen, each model once with its count (1 to MAX_PER_CAR), in fleet order. */
export function cleanCars(cars: readonly { key: string; count: number }[]): Trip["cars"] {
  const counts = new Map<VehicleKey, number>();
  for (const pick of cars) {
    const key = normalizeVehicleKey(pick.key);
    const n = Number(pick.count);
    if (!key || !Number.isInteger(n) || n < 1) continue;
    counts.set(key, Math.min(MAX_PER_CAR, (counts.get(key) ?? 0) + n));
  }
  return FLEET.filter((v) => counts.has(v.key)).map((v) => ({ key: v.key, count: counts.get(v.key)! }));
}

const bounded = (n: number, min: number, max: number) => {
  const value = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.min(max, Math.max(min, value));
};

/**
 * The chosen cars, and a party inside the flow's own limits. Cars that cannot take the party stay selected:
 * the form then explains that, instead of quietly switching the cars or the counts.
 */
export function normalizeTrip(trip: Trip): Trip {
  const pax = bounded(trip.pax, 1, MAX_GROUP);
  const bags = bounded(trip.bags, 0, MAX_GROUP_BAGS);
  const small = bounded(trip.small, 0, MAX_SMALL_BAGS);
  // A trip saved before add-ons existed has none
  const extras = cleanExtras(trip.extras ?? []);
  const chosen = cleanCars(trip.cars);
  if (chosen.length > 0) return { ...trip, pax, bags, small, extras, cars: chosen, vehicle: chosen[0].key };
  const named = trip.vehicle && trip.vehicle !== "advise" ? vehicleByKey(trip.vehicle) : undefined;
  if (named) return { ...trip, pax, bags, small, extras, cars: [{ key: named.key, count: 1 }], vehicle: named.key };
  return { ...trip, pax, bags, small, extras, cars: [], vehicle: trip.vehicle === "advise" ? "advise" : "" };
}
export const emptyPlace = (): Place => ({ text: "", id: null, kind: null });
export const emptyTrip = (): Trip => ({
  mode: "oneway",
  from: emptyPlace(),
  to: emptyPlace(),
  stops: [],
  hours: "",
  at: "",
  pax: 1,
  bags: 0,
  small: 0,
  guestsSet: false,
  flight: "",
  vehicle: "",
  cars: [],
  extras: [],
});

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
// What the server accepts as a flight (lib/quotes/validation.ts): an airline flight or an aircraft's registration
const FLIGHT = /^[A-Z0-9][A-Z0-9 -]{1,11}$/;
const clampInt = (raw: string | null, min: number, max: number, fallback: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const kindOf = (raw: string | null): PlaceKind | null => ((PLACE_KINDS as readonly string[]).includes(raw ?? "") ? (raw as PlaceKind) : null);
const text = (raw: string | null, max = 200) => (raw ?? "").trim().slice(0, max);

/** The kind of a place: what the suggestion said, else what we can tell from its name ("Schiphol"). */
export const placeKind = (p: Place): PlaceKind | null => p.kind ?? (p.text ? curatedKind(p.text) : null);
export const involvesAirport = (trip: Trip) =>
  isAirportKind(placeKind(trip.from)) || (trip.mode === "oneway" && isAirportKind(placeKind(trip.to)));
export const pickupAtAirport = (trip: Trip) => isAirportKind(placeKind(trip.from));

/**
 * The service the team sees. Not asked of the visitor: an hourly booking is hourly, a trip to or from an airport is an
 * airport transfer, and anything else is business travel unless the visitor says it is a private occasion.
 */
export function serviceFor(trip: Trip, purpose: "business" | "private"): Service {
  if (trip.mode === "hourly") return "hourly";
  if (involvesAirport(trip)) return "airport_transfer";
  return purpose === "private" ? "private_occasion" : "business_travel";
}

/** Reads a trip from /book's query string, ignoring anything malformed (it is typed in by whoever has the link). */
export function tripFromParams(params: URLSearchParams): Trip {
  const trip = emptyTrip();
  trip.mode = params.get("mode") === "hourly" ? "hourly" : "oneway";
  trip.from = { text: text(params.get("from")), id: text(params.get("fromId"), 300) || null, kind: kindOf(params.get("fromKind")) };
  trip.to = { text: text(params.get("to")), id: text(params.get("toId"), 300) || null, kind: kindOf(params.get("toKind")) };
  const waits = params.getAll("wait");
  trip.stops = params
    .getAll("stop")
    .map((place, i) => ({ place: text(place), wait: asWait(waits[i]) }))
    .filter((s) => s.place)
    .slice(0, MAX_STOPS);
  const hours = clampInt(params.get("hours"), 1, 24, 0);
  trip.hours = (HOURLY_DURATIONS as readonly number[]).includes(hours) ? hours : "";
  trip.at = WALL_CLOCK.test(params.get("at") ?? "") ? params.get("at")! : "";
  const pax = Number(params.get("pax"));
  if (Number.isInteger(pax)) trip.pax = pax;
  const bags = Number(params.get("bags"));
  if (Number.isInteger(bags)) trip.bags = bags;
  const small = Number(params.get("small"));
  if (Number.isInteger(small)) trip.small = small;
  trip.guestsSet = params.has("pax");
  trip.flight = text(params.get("flight"), 12);
  const vehicle = normalizeVehicleKey(params.get("vehicle")) ?? params.get("vehicle");
  trip.vehicle = (VEHICLE_CHOICES as readonly string[]).includes(vehicle ?? "") ? (vehicle as VehicleChoice) : "";
  trip.cars = carsFromParam(params.get("cars"));
  // "champagne:1|chocolates.dairy_free:2": the add-ons, kept when the visitor goes back to the bar to change the journey
  trip.extras = cleanExtras(
    (params.get("extras") ?? "").split("|").filter(Boolean).map((part) => {
      const [item, count] = part.split(":");
      const [key, option] = item.split(".");
      return { key, option, count: Number(count) };
    }),
  );
  if (trip.cars.length === 0 && trip.vehicle && trip.vehicle !== "advise") {
    const key = normalizeVehicleKey(trip.vehicle);
    if (key) trip.cars = [{ key, count: 1 }];
  }
  return normalizeTrip(trip);
}

// "audi:2|cadillac_escalade:1"
const carsFromParam = (raw: string | null): Trip["cars"] =>
  cleanCars(
    (raw ?? "").split("|").filter(Boolean).map((part) => {
      const [key, count] = part.split(":");
      return { key, count: Number(count) };
    }),
  );

/** The trip as query parameters for /book: only what is set, so links stay short. */
export function tripToParams(trip: Trip): URLSearchParams {
  const p = new URLSearchParams();
  if (trip.mode === "hourly") p.set("mode", "hourly");
  const place = (key: string, v: Place) => {
    if (!v.text) return;
    p.set(key, v.text);
    if (v.id) p.set(`${key}Id`, v.id);
    if (v.kind) p.set(`${key}Kind`, v.kind);
  };
  place("from", trip.from);
  if (trip.mode === "oneway") {
    place("to", trip.to);
    for (const s of trip.stops.filter((s) => s.place.trim())) {
      p.append("stop", s.place.trim());
      p.append("wait", String(s.wait));
    }
  } else p.set("hours", String(trip.hours));
  if (trip.at) p.set("at", trip.at);
  if (trip.guestsSet) {
    p.set("pax", String(trip.pax));
    p.set("bags", String(trip.bags));
    p.set("small", String(trip.small));
  }
  if (trip.flight.trim() && pickupAtAirport(trip)) p.set("flight", trip.flight.trim());
  if (trip.vehicle) p.set("vehicle", trip.vehicle);
  if (trip.cars.length > 0) p.set("cars", trip.cars.map((c) => `${c.key}:${c.count}`).join("|"));
  if (trip.extras.length > 0) p.set("extras", trip.extras.map((e) => `${e.key}${e.option ? `.${e.option}` : ""}:${e.count}`).join("|"));
  return p;
}

/** The trip as the fields the quote actions read (lib/quotes/actions.ts, lib/corporate/portal-actions.ts). */
export function tripFields(trip: Trip, purpose: "business" | "private"): [string, string][] {
  const fields: [string, string][] = [
    ["collection", trip.from.text],
    ["pickupPlaceId", trip.from.id ?? ""],
    ["pickupAt", trip.at],
    ["service", serviceFor(trip, purpose)],
    ["tripPurpose", purpose],
    ["passengers", String(trip.pax)],
    ["luggage", String(trip.bags)],
    ["handLuggage", String(trip.small)],
    ["flightNumber", pickupAtAirport(trip) ? trip.flight.trim() : ""],
    ["vehicle", trip.cars[0]?.key ?? trip.vehicle],
    ["vehicles", trip.cars.length > 0 ? JSON.stringify(trip.cars) : ""],
    ["extras", trip.extras.length > 0 ? JSON.stringify(trip.extras) : ""],
  ];
  if (trip.mode === "hourly") fields.push(["durationHours", String(trip.hours)]);
  else {
    fields.push(["destination", trip.to.text], ["destinationPlaceId", trip.to.id ?? ""]);
    for (const s of trip.stops.filter((s) => s.place.trim())) fields.push(["destinations", s.place.trim()], ["destinationWaits", String(s.wait)]);
  }
  return fields;
}

/** Which of the trip's fields are missing or wrong, by the action's field names, so the bar can mark them. */
export type TripField = "collection" | "destination" | "samePlace" | "pickupAt" | "durationHours" | "guests" | "flightNumber";
export function tripProblems(trip: Trip, nowWallClock: string): TripField[] {
  const problems: TripField[] = [];
  // The server takes bookings up to two years ahead (lib/quotes/validation.ts); same limit here, so nothing typed later is lost to it
  const latest = new Date(Date.parse(`${nowWallClock}:00Z`) + 730 * 86_400_000).toISOString().slice(0, 16);
  // The server lets a pick-up be up to an hour in the past, for a form that took a while to fill in (lib/quotes/validation.ts); the same
  // here, so the time the bar starts with (the time it is now) is still accepted a few minutes later
  const earliest = new Date(Date.parse(`${nowWallClock}:00Z`) - 60 * 60_000).toISOString().slice(0, 16);
  if (!trip.from.text.trim()) problems.push("collection");
  if (trip.mode === "oneway" && !trip.to.text.trim()) problems.push("destination");
  if (trip.mode === "oneway" && samePlace(trip.from.text, trip.to.text)) problems.push("samePlace");
  if (trip.mode === "hourly" && trip.hours === "") problems.push("durationHours");
  if (!WALL_CLOCK.test(trip.at) || trip.at < earliest || trip.at > latest) problems.push("pickupAt");
  if (!trip.guestsSet) problems.push("guests");
  if (pickupAtAirport(trip) && trip.flight.trim() && !FLIGHT.test(trip.flight.trim().toUpperCase().replace(/\s+/g, " "))) problems.push("flightNumber");
  return problems;
}

/** "Schiphol → Hotel Des Indes" for the trip chip and summaries. */
export const shortPlace = (p: Place) => p.text.split(",")[0].trim();
export const isTripReady = (trip: Trip, nowWallClock: string) => tripProblems(trip, nowWallClock).length === 0;