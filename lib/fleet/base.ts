/**
 * Where the cars live. After a trip the car is held until it is back here: a drive to Paris holds it for the drive home
 * too (the client, 8 Nov 2026). The team sets it on the admin's Fleet page (stored in `app_settings`, see base-store.ts);
 * until it is set the drive back is measured to the trip's own pick-up. Read by scripts as well as the site, so it imports nothing.
 *
 * `placeId` is optional: a Google place id finds the address exactly.
 */
export type FleetBase = { address: string; placeId: string | null };

/** The `app_settings` key the base is kept under */
export const FLEET_BASE_KEY = "fleet_base";

/** A stored value as a base, or null when it is not one (never set, or emptied) */
export function parseFleetBase(value: unknown): FleetBase | null {
  if (!value || typeof value !== "object") return null;
  const { address, placeId } = value as { address?: unknown; placeId?: unknown };
  if (typeof address !== "string" || !address.trim()) return null;
  return { address: address.trim(), placeId: typeof placeId === "string" && placeId ? placeId : null };
}
