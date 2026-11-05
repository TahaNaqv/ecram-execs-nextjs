import "server-only";
import type { PlaceHit, PlaceKind } from "./types";

/**
 * Google Places API (New), called only from our own route handlers so the key never reaches the browser and the CSP
 * stays 'self'. Google's terms: suggestions are shown with "Powered by Google", and nothing but the place id is kept.
 *
 * Billing works per session: the visitor's keystrokes share one session token, and the session is closed by a details
 * request for the place they picked. Asking that request for the id alone keeps it on Google's free "IDs only" tier.
 */
// PLACES_API_URL points the e2e tests at a stand-in (tests/e2e/global-setup.ts); never set in production
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const API = process.env.PLACES_API_URL && LOOPBACK.test(process.env.PLACES_API_URL) ? process.env.PLACES_API_URL : "https://places.googleapis.com/v1";
// Suggestions are for places in the Netherlands only, for now: to serve Belgium or Germany again, add "be" or "de" here
const REGIONS = ["nl"];
const NETHERLANDS = { low: { latitude: 50.7, longitude: 3.3 }, high: { latitude: 53.6, longitude: 7.3 } };

export const placesEnabled = () => Boolean(process.env.GOOGLE_MAPS_API_KEY);

type Prediction = {
  placeId: string;
  text?: { text: string };
  structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
  types?: string[];
};

function kindOf(types: string[] = []): PlaceKind {
  if (types.some((t) => t === "airport" || t === "international_airport")) return "airport";
  if (types.includes("airstrip")) return "aviation";
  if (types.some((t) => t === "train_station" || t === "transit_station" || t === "subway_station")) return "station";
  if (types.some((t) => t === "lodging" || t === "hotel")) return "hotel";
  return "place";
}

export async function autocomplete(input: string, sessionToken: string, languageCode: string, signal: AbortSignal): Promise<PlaceHit[]> {
  const res = await fetch(`${API}/places:autocomplete`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY! },
    body: JSON.stringify({
      input,
      sessionToken,
      languageCode,
      includedRegionCodes: REGIONS,
      locationBias: { rectangle: NETHERLANDS },
    }),
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { suggestions?: { placePrediction?: Prediction }[] };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is Prediction => Boolean(p?.placeId))
    .slice(0, 5)
    .map((p) => ({
      id: p.placeId,
      name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      detail: p.structuredFormat?.secondaryText?.text ?? "",
      kind: kindOf(p.types),
      source: "google" as const,
    }))
    .filter((p) => p.name);
}

/** Closes the visitor's billing session for the place they picked (id only: free tier). */
export async function closeSession(placeId: string, sessionToken: string, signal: AbortSignal) {
  const url = `${API}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, { signal, headers: { "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, "X-Goog-FieldMask": "id" } });
  if (!res.ok) throw new Error(`Places details ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
