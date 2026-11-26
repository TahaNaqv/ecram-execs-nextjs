import { customerHourly, hourlyRate, type DayKind, type Segment } from "../pricing/rates.ts";
import { bagCapacity, FLEET } from "./vehicles.ts";

/**
 * The models the team can pick when registering a car (Fleet & Compliance, "Register New Vehicle"): choosing one fills in
 * its standard specs and its rate card, which the team can still change before saving (the client, 27 Nov 2026). Rates
 * are the hourly prices including 9% VAT, as the form asks for them: the published customer price where there is one,
 * else the rate card's net rate plus VAT. A car registered as a model is still priced by the model's rate card in
 * bookings; the figures saved on the car are the team's record. Pure: read by the admin form in the browser.
 */

export type ModelTemplate = {
  key: string;
  name: string;
  seats: number | null;
  /** Large suitcases with the seats in place (lib/fleet/vehicles.ts bagCapacity) */
  luggage: number | null;
  rangeKm: number | null;
  /** Euro cents per hour, including VAT */
  rates: Record<Segment, Record<DayKind, number | null>>;
};

const DAYS: DayKind[] = ["weekday", "saturday", "sunday"];
const RIDE_VAT = 0.09;

function gross(key: string, segment: Segment, day: DayKind): number | null {
  const published = customerHourly(key, segment, day);
  if (published != null) return published;
  const net = hourlyRate(key, segment, day);
  return net == null ? null : Math.round(net * (1 + RIDE_VAT));
}

export const MODEL_TEMPLATES: ModelTemplate[] = FLEET.map((vehicle) => ({
  key: vehicle.key,
  name: vehicle.name,
  seats: vehicle.specs?.passengers ?? null,
  luggage: vehicle.specs ? bagCapacity(vehicle) : null,
  rangeKm: vehicle.specs?.rangeKm ?? null,
  rates: {
    public: Object.fromEntries(DAYS.map((day) => [day, gross(vehicle.key, "public", day)])) as Record<DayKind, number | null>,
    corporate: Object.fromEntries(DAYS.map((day) => [day, gross(vehicle.key, "corporate", day)])) as Record<DayKind, number | null>,
  },
}));

export const modelTemplate = (key: string | null | undefined) => MODEL_TEMPLATES.find((template) => template.key === key);
