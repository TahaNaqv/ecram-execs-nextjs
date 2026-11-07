import { fleetPicks, normalizeVehicleKey } from "./vehicles.ts";

/** The key a booking's car is held under, or null when no particular car is meant ("advise me", or none chosen). */
export function carKey(vehicle: string | null | undefined): string | null {
  if (!vehicle || vehicle === "advise") return null;
  return normalizeVehicleKey(vehicle) ?? vehicle;
}

/**
 * Every car a booking holds once it is confirmed: its car (the one the team gave it, else the visitor's first choice), then
 * the other cars of a booking for several (the client, 7 Nov 2026). `vehicles` lists the visitor's choice with the first
 * car leading, so when the team gives the booking another car, that car takes the first one's place. A booking with no
 * particular car ("let us choose") holds nothing until the team gives it one.
 */
export function heldKeys(booking: { vehicle: string | null | undefined; vehicles?: unknown }): Set<string> {
  const lead = carKey(booking.vehicle);
  if (!lead) return new Set();
  const keys = new Set([lead]);
  for (const pick of fleetPicks(booking.vehicles).slice(1)) keys.add(pick.key);
  return keys;
}
