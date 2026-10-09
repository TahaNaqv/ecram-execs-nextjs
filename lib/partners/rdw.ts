import "server-only";
import type { RdwVehicle } from "./criteria";

// RDW open data (Dutch vehicle register): public, no key needed. https://opendata.rdw.nl
// It often takes several seconds to answer; an optional (free) app token gets priority over anonymous traffic.
const VEHICLES = "https://opendata.rdw.nl/resource/m9d7-ebf2.json";
const FUELS = "https://opendata.rdw.nl/resource/8ys7-d773.json";

/** "hl-z58-n" → "HLZ58N", the form the RDW indexes plates by. */
export const normalisePlate = (plate: string) => plate.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** "20290516" → "2029-05-16" */
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : null);

async function get(url: string, plate: string): Promise<Record<string, string>[]> {
  const res = await fetch(`${url}?kenteken=${encodeURIComponent(plate)}`, {
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
    ...(process.env.RDW_APP_TOKEN && { headers: { "X-App-Token": process.env.RDW_APP_TOKEN } }),
  });
  if (!res.ok) throw new Error(`RDW ${res.status}`);
  return res.json();
}

/**
 * Looks a plate up in the RDW register.
 * Returns null when the plate isn't registered, or "unavailable" when the RDW can't be reached.
 */
export async function lookupVehicle(rawPlate: string): Promise<RdwVehicle | null | "unavailable"> {
  const plate = normalisePlate(rawPlate);
  try {
    const [[v], fuels] = await Promise.all([get(VEHICLES, plate), get(FUELS, plate)]);
    if (!v) return null;
    const seats = Number(v.aantal_zitplaatsen);
    return {
      plate,
      make: (v.merk ?? "").toUpperCase(),
      model: v.handelsbenaming ?? "",
      colour: (v.eerste_kleur ?? "").toUpperCase(),
      seats: Number.isFinite(seats) && seats > 0 ? seats : null,
      firstRegistered: isoDate(v.datum_eerste_toelating),
      apkExpires: isoDate(v.vervaldatum_apk),
      fuels: fuels.map((f) => f.brandstof_omschrijving).filter(Boolean),
      taxiRegistered: v.taxi_indicator === "Ja",
      insured: v.wam_verzekerd === "Ja",
      openRecall: v.openstaande_terugroepactie_indicator === "Ja",
    };
  } catch (err) {
    console.error(`[rdw] lookup for ${plate} failed`, err);
    return "unavailable";
  }
}
