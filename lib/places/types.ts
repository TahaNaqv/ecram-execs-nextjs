/**
 * Address suggestions for the booking flow. Shared by the server (which asks Google) and the browser (which shows
 * them), so no server-only imports here.
 */

/** What kind of place a suggestion is. An airport (or private-aviation terminal) makes the trip an airport transfer. */
export const PLACE_KINDS = ["airport", "aviation", "station", "hotel", "place"] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

export type PlaceHit = {
  /** Google's place id; null for a place from our own list */
  id: string | null;
  /** The line the visitor recognises: "Hotel Des Indes" */
  name: string;
  /** The line under it: street and town */
  detail: string;
  kind: PlaceKind;
  source: "google" | "list";
};

export const isAirportKind = (kind: PlaceKind | null | undefined) => kind === "airport" || kind === "aviation";
