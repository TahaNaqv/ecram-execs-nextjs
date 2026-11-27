import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { bagCapacity, FLEET, normalizeVehicleKey, VEHICLE_KEYS, vehicleModel, type OfferedVehicle } from "@/lib/fleet/vehicles";
import type { DayKind } from "@/lib/pricing/rates";

/** Tagged so an admin edit can refresh the public fleet without rebuilding the site. */
export const FLEET_CACHE_TAG = "fleet";

export type { OfferedVehicle };

export type CustomRates = Record<string, Partial<Record<DayKind, number>>>;

type CatalogRow = {
  id: string;
  modelKey: string | null;
  name: string;
  status: string;
  images: string[] | null;
  seats: number | null;
  luggage: number | null;
  rateWeekday: number | null;
  rateSaturday: number | null;
  rateSunday: number | null;
};

function ratesOf(row: Pick<CatalogRow, "rateWeekday" | "rateSaturday" | "rateSunday">): OfferedVehicle["rates"] {
  if (row.rateWeekday == null) return null;
  return {
    weekday: row.rateWeekday,
    saturday: row.rateSaturday ?? row.rateWeekday,
    sunday: row.rateSunday ?? row.rateWeekday,
  };
}

async function readListedRows(): Promise<CatalogRow[]> {
  "use cache";
  cacheTag(FLEET_CACHE_TAG);
  cacheLife("hours");
  return db
    .select({
      id: schema.vehicles.id,
      modelKey: schema.vehicles.modelKey,
      name: schema.vehicles.name,
      status: schema.vehicles.status,
      images: schema.vehicles.images,
      seats: schema.vehicles.seats,
      luggage: schema.vehicles.luggage,
      rateWeekday: schema.vehicles.rateWeekday,
      rateSaturday: schema.vehicles.rateSaturday,
      rateSunday: schema.vehicles.rateSunday,
    })
    .from(schema.vehicles)
    .where(eq(schema.vehicles.listed, true));
}

/** Listed cars for the public booking flow. A failed read is not cached, and the printed fleet still renders. */
async function listedRows(): Promise<CatalogRow[]> {
  try {
    return await readListedRows();
  } catch (error) {
    console.error("[fleet] listed vehicles could not be read", error);
    return [];
  }
}

/**
 * Models shown but not yet bookable, with when they are expected ("Q2 2027"), the client 27 Nov 2026: the booking form shows
 * them greyed out and the server refuses them. The team switches a model between "coming soon" and bookable on the
 * vehicles page (app_settings "coming_soon"); until it is first saved, the `expected` printed in lib/fleet/vehicles.ts applies.
 */
export type ComingSoon = Record<string, string>;
export const COMING_SOON_KEY = "coming_soon";
export const MAX_EXPECTED_LENGTH = 40;

export const PRINTED_COMING_SOON: ComingSoon = Object.fromEntries(FLEET.flatMap((vehicle) => (vehicle.expected ? [[vehicle.key, vehicle.expected]] : [])));

/** Only printed models, each with a short wording; anything else stored is ignored. */
export function cleanComingSoon(value: unknown): ComingSoon {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: ComingSoon = {};
  for (const [key, expected] of Object.entries(value as Record<string, unknown>)) {
    if (!(VEHICLE_KEYS as readonly string[]).includes(key) || typeof expected !== "string") continue;
    const text = expected.trim().replace(/\s+/g, " ").slice(0, MAX_EXPECTED_LENGTH);
    if (text) clean[key] = text;
  }
  return clean;
}

async function readComingSoon(): Promise<ComingSoon> {
  "use cache";
  cacheTag(FLEET_CACHE_TAG);
  cacheLife("hours");
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, COMING_SOON_KEY)).limit(1);
  return row ? cleanComingSoon(row.value) : PRINTED_COMING_SOON;
}

/** The models not bookable yet. If the setting cannot be read, the printed default holds (a car is never opened by an error). */
export async function comingSoon(): Promise<ComingSoon> {
  try {
    return await readComingSoon();
  } catch (error) {
    console.error("[fleet] coming-soon models could not be read", error);
    return PRINTED_COMING_SOON;
  }
}

/** The printed fleet, plus vehicles an admin has listed. A listed car whose name matches a printed model updates that model's photographs. */
export async function bookableFleet(): Promise<OfferedVehicle[]> {
  const soon = await comingSoon();
  const offers: OfferedVehicle[] = FLEET.map((vehicle) => ({
    key: vehicle.key,
    name: vehicle.name,
    images: vehicle.images,
    seats: vehicle.specs?.passengers ?? null,
    bags: bagCapacity(vehicle),
    rates: null,
    expected: soon[vehicle.key] ?? null,
  }));
  for (const row of await listedRows()) {
    const known = vehicleModel(row);
    if (known) {
      const offer = offers.find((item) => item.key === known);
      if (!offer) continue;
      // The eSprinter booking gallery is the printed sequence, not whatever order the register stored.
      if (known === "mercedes_esprinter") {
        const printed = FLEET.find((vehicle) => vehicle.key === known);
        if (printed) offer.images = printed.images;
      } else if (row.images && row.images.length > 0) {
        offer.images = row.images;
      }
      continue;
    }
    if (row.status !== "available") continue;
    const rates = ratesOf(row);
    offers.push({
      key: row.id,
      name: row.name,
      images: row.images ?? [],
      seats: row.seats,
      bags: row.luggage,
      rates,
    });
  }
  return offers;
}

/** Hourly rates for listed cars that are not on the printed card. */
export async function customRates(): Promise<CustomRates> {
  const rates: CustomRates = {};
  for (const row of await listedRows()) {
    const priced = ratesOf(row);
    if (vehicleModel(row) || !priced) continue;
    rates[row.id] = priced;
  }
  return rates;
}

/** Keys in a booking that cannot be booked: a custom key that is not a listed, available vehicle, or a model coming soon. */
export async function unknownFleetKeys(keys: string[]): Promise<string[]> {
  const soon = await comingSoon();
  const notYet = keys.filter((key) => key && soon[normalizeVehicleKey(key) ?? ""]);
  const custom = keys.filter((key) => key && key !== "advise" && !normalizeVehicleKey(key));
  if (custom.length === 0) return notYet;
  const known = new Set((await listedRows()).filter((row) => row.status === "available").map((row) => row.id));
  return [...notYet, ...custom.filter((key) => !known.has(key))];
}
