/**
 * Where the cars live. After a trip the car is held until it is back here: a drive to Paris holds it for the drive home
 * too (the client, 8 Nov 2026). Read by scripts as well as the site, so it imports nothing.
 *
 * Empty until the client gives the address. Until then the drive back is measured to the trip's own pick-up.
 * `placeId` is optional: a Google place id finds the address exactly.
 */
export const FLEET_BASE: { address: string; placeId: string | null } = { address: "", placeId: null };
