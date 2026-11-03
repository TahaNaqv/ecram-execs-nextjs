import { FLEET, fitConvoy, fleetPicks, normalizeVehicleKey, suggestVehicle } from "../fleet/vehicles.ts";

/**
 * The cars a booking is priced for: the ones the visitor chose, or, when they leave the choice to the team, the car (or
 * the set of cars, for a party too large for one) we would suggest from the whole fleet. A suggestion makes the price a
 * "from" price. The browser and the server both ask this, so they price the same cars.
 */
export function carsToPrice(b: { vehicles?: unknown; vehicle?: string | null; passengers?: number | null; luggage?: number | null }): {
  cars: { key: string; count: number }[];
  suggested: boolean;
} {
  const picks = fleetPicks(b.vehicles);
  if (picks.length > 0) return { cars: picks, suggested: false };
  const one = normalizeVehicleKey(b.vehicle);
  if (one) return { cars: [{ key: one, count: 1 }], suggested: false };
  const pax = Math.max(1, b.passengers ?? 1);
  const convoy = fitConvoy(FLEET, pax);
  if (convoy) return { cars: convoy, suggested: true };
  const car = suggestVehicle(FLEET, { pax, bags: b.luggage ?? 0 });
  return { cars: car ? [{ key: car.key, count: 1 }] : [], suggested: true };
}
