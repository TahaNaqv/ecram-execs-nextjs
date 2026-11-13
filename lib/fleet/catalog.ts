import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { bagCapacity, FLEET, normalizeVehicleKey, type OfferedVehicle } from "@/lib/fleet/vehicles";
import type { DayKind } from "@/lib/pricing/rates";

export type { OfferedVehicle };

export type CustomRates = Record<string, Partial<Record<DayKind, number>>>;

type CatalogRow = {
  id: string;
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

async function listedRows(): Promise<CatalogRow[]> {
  try {
    return await db
      .select({
        id: schema.vehicles.id,
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
  } catch (error) {
    console.error("[fleet] listed vehicles could not be read", error);
    return [];
  }
}

/** The printed fleet, plus vehicles an admin has listed. A listed car whose name matches a printed model updates that model's photographs. */
export async function bookableFleet(): Promise<OfferedVehicle[]> {
  const offers: OfferedVehicle[] = FLEET.map((vehicle) => ({
    key: vehicle.key,
    name: vehicle.name,
    images: vehicle.images,
    seats: vehicle.specs?.passengers ?? null,
    bags: bagCapacity(vehicle),
    rates: null,
  }));
  for (const row of await listedRows()) {
    const known = normalizeVehicleKey(row.id);
    if (known) {
      const offer = offers.find((item) => item.key === known);
      if (offer && row.images && row.images.length > 0) offer.images = row.images;
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
    if (normalizeVehicleKey(row.id) || !priced) continue;
    rates[row.id] = priced;
  }
  return rates;
}

/** Custom keys in a booking that are not a listed, available vehicle. */
export async function unknownFleetKeys(keys: string[]): Promise<string[]> {
  const custom = keys.filter((key) => key && key !== "advise" && !normalizeVehicleKey(key));
  if (custom.length === 0) return [];
  const known = new Set((await listedRows()).filter((row) => row.status === "available").map((row) => row.id));
  return custom.filter((key) => !known.has(key));
}
