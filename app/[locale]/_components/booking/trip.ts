import { HOURLY_DURATIONS, type Service } from "@/lib/quotes/constants";
import { MAX_STOPS, asWait } from "@/lib/quotes/stops";
import { normalizeVehicleKey, VEHICLE_CHOICES, type VehicleChoice } from "@/lib/fleet/vehicles";
import { curatedKind } from "@/lib/places/curated";
import { isAirportKind, PLACE_KINDS, type PlaceKind } from "@/lib/places/types";

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
  hours: number;
  /** Wall-clock "YYYY-MM-DDTHH:mm" in the Netherlands, or "" */
  at: string;
  /** The return journey's pick-up, same format; "" when there is none */
  ret: string;
  pax: number;
  bags: number;
  flight: string;
  /** A fleet key, "advise" for no preference, or "" when not chosen yet */
  vehicle: VehicleChoice | "";
};

export const MAX_PASSENGERS = 8; // shown as "8+"
export const MAX_BAGS = 12;
export const emptyPlace = (): Place => ({ text: "", id: null, kind: null });
export const emptyTrip = (): Trip => ({
  mode: "oneway",
  from: emptyPlace(),
  to: emptyPlace(),
  stops: [],
  hours: "",
  at: "",
  ret: "",
  pax: 1,
  bags: 1,
  flight: "",
  vehicle: "",
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
  trip.hours = clampInt(params.get("hours"), 1, 24, trip.hours);
  if (!(HOURLY_DURATIONS as readonly number[]).includes(trip.hours)) trip.hours = 3;
  trip.at = WALL_CLOCK.test(params.get("at") ?? "") ? params.get("at")! : "";
  trip.ret = WALL_CLOCK.test(params.get("ret") ?? "") ? params.get("ret")! : "";
  trip.pax = clampInt(params.get("pax"), 1, MAX_PASSENGERS, trip.pax);
  trip.bags = clampInt(params.get("bags"), 0, MAX_BAGS, trip.bags);
  trip.flight = text(params.get("flight"), 12);
  const vehicle = normalizeVehicleKey(params.get("vehicle")) ?? params.get("vehicle");
  trip.vehicle = (VEHICLE_CHOICES as readonly string[]).includes(vehicle ?? "") ? (vehicle as VehicleChoice) : "";
  return trip;
}

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
  if (trip.ret) p.set("ret", trip.ret);
  p.set("pax", String(trip.pax));
  p.set("bags", String(trip.bags));
  if (trip.flight.trim() && pickupAtAirport(trip)) p.set("flight", trip.flight.trim());
  if (trip.vehicle) p.set("vehicle", trip.vehicle);
  return p;
}

/** The trip as the fields the quote actions read (lib/quotes/actions.ts, lib/corporate/portal-actions.ts). */
export function tripFields(trip: Trip, purpose: "business" | "private"): [string, string][] {
  const fields: [string, string][] = [
    ["collection", trip.from.text],
    ["pickupPlaceId", trip.from.id ?? ""],
    ["pickupAt", trip.at],
    ["returnAt", trip.ret],
    ["service", serviceFor(trip, purpose)],
    ["passengers", String(trip.pax)],
    ["luggage", String(trip.bags)],
    ["flightNumber", pickupAtAirport(trip) ? trip.flight.trim() : ""],
    ["vehicle", trip.vehicle],
  ];
  if (trip.mode === "hourly") fields.push(["durationHours", String(trip.hours)]);
  else {
    fields.push(["destination", trip.to.text], ["destinationPlaceId", trip.to.id ?? ""]);
    for (const s of trip.stops.filter((s) => s.place.trim())) fields.push(["destinations", s.place.trim()], ["destinationWaits", String(s.wait)]);
  }
  return fields;
}

/** Which of the trip's fields are missing or wrong, by the action's field names, so the bar can mark them. */
export type TripField = "collection" | "destination" | "pickupAt" | "returnAt" | "durationHours" | "flightNumber";
export function tripProblems(trip: Trip, nowWallClock: string): TripField[] {
  const problems: TripField[] = [];
  // The server takes bookings up to two years ahead (lib/quotes/validation.ts); same limit here, so nothing typed later is lost to it
  const latest = new Date(Date.parse(`${nowWallClock}:00Z`) + 730 * 86_400_000).toISOString().slice(0, 16);
  if (!trip.from.text.trim()) problems.push("collection");
  if (trip.mode === "oneway" && !trip.to.text.trim()) problems.push("destination");
  if (!WALL_CLOCK.test(trip.at) || trip.at < nowWallClock || trip.at > latest) problems.push("pickupAt");
  if (trip.ret && (!WALL_CLOCK.test(trip.ret) || trip.ret <= trip.at || trip.ret > latest)) problems.push("returnAt");
  if (pickupAtAirport(trip) && trip.flight.trim() && !FLIGHT.test(trip.flight.trim().toUpperCase().replace(/\s+/g, " "))) problems.push("flightNumber");
  return problems;
}

/** "Schiphol → Hotel Des Indes" for the trip chip and summaries. */
export const shortPlace = (p: Place) => p.text.split(",")[0].trim();
export const isTripReady = (trip: Trip, nowWallClock: string) => tripProblems(trip, nowWallClock).length === 0;
