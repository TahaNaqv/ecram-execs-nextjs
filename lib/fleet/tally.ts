import { FLEET, vehicleModel } from "./vehicles.ts";

/**
 * How many units of each model are registered, and how many of them are on (the client, 27 Nov 2026): registering a
 * second VLE 300 makes it "2× Mercedes-Benz VLE 300", switching one off or removing it brings the count down again.
 * Counted from the vehicles register itself, so it is always what the register says. A car registered without a model
 * counts on its own, under its name. Pure: read by the admin in the browser and on the server.
 */

export type ModelTally = {
  /** The model's key, or "car:<id>" for a car of its own */
  key: string;
  name: string;
  /** Units registered */
  units: number;
  /** Units switched on (bookable) */
  active: number;
};

type Row = { id: string; name: string; modelKey?: string | null; status?: string; available?: boolean };

const isOn = (row: Row) => row.available ?? row.status === "available";

export function modelTally(rows: readonly Row[]): ModelTally[] {
  const tally = new Map<string, ModelTally>();
  for (const row of rows) {
    const model = vehicleModel(row);
    const key = model ?? `car:${row.id}`;
    const name = (model && FLEET.find((vehicle) => vehicle.key === model)?.name) || row.name;
    const entry = tally.get(key) ?? { key, name, units: 0, active: 0 };
    entry.units += 1;
    if (isOn(row)) entry.active += 1;
    tally.set(key, entry);
  }
  // The fleet's own order (as on the website), then the cars of their own by name
  const order = (key: string) => {
    const index = FLEET.findIndex((vehicle) => vehicle.key === key);
    return index === -1 ? FLEET.length : index;
  };
  return [...tally.values()].sort((a, b) => order(a.key) - order(b.key) || a.name.localeCompare(b.name));
}

/** The unit a row belongs to in the tally, to filter a list by it. */
export const tallyKey = (row: { id: string; modelKey?: string | null }) => vehicleModel(row) ?? `car:${row.id}`;
