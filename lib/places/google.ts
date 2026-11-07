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
// Home first, then the EU countries the client drives to (all within about ten hours of Amsterdam). Not the UK,
// Switzerland or Liechtenstein: outside the EU, and not served. Google takes at most 15 region codes per request.
const HOME = ["nl"];
const ABROAD = ["be", "de", "lu", "fr", "dk", "at", "cz", "pl"];
const NETHERLANDS = { low: { latitude: 50.7, longitude: 3.3 }, high: { latitude: 53.6, longitude: 7.3 } };
/** Suggestions shown in all, and how many of them are kept for places abroad when there are any */
const SHOWN = 5;
const ABROAD_KEPT = 2;

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

async function predictions(input: string, sessionToken: string, languageCode: string, regions: string[], signal: AbortSignal): Promise<PlaceHit[]> {
  const res = await fetch(`${API}/places:autocomplete`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY! },
    body: JSON.stringify({
      input,
      sessionToken,
      languageCode,
      includedRegionCodes: regions,
      // Ranked from the Netherlands, so the nearest match of a name abroad comes first too
      locationBias: { rectangle: NETHERLANDS },
    }),
  });
  if (!res.ok) throw new Error(`Places autocomplete ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { suggestions?: { placePrediction?: Prediction }[] };
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is Prediction => Boolean(p?.placeId))
    .map((p) => ({
      id: p.placeId,
      name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      detail: p.structuredFormat?.secondaryText?.text ?? "",
      kind: kindOf(p.types),
      source: "google" as const,
    }))
    .filter((p) => p.name);
}

/**
 * Places in the Netherlands first, then abroad. Asked as two searches in the same billing session: in one search the
 * Dutch "Paris" café would crowd out Paris itself, and Google returns only five suggestions. When both have answers,
 * the last two places go to the matches abroad.
 */
export async function autocomplete(input: string, sessionToken: string, languageCode: string, signal: AbortSignal): Promise<PlaceHit[]> {
  const [home, abroad] = await Promise.allSettled([
    predictions(input, sessionToken, languageCode, HOME, signal),
    predictions(input, sessionToken, languageCode, ABROAD, signal),
  ]);
  if (home.status === "rejected" && abroad.status === "rejected") throw home.reason;
  const near = home.status === "fulfilled" ? home.value : [];
  const seen = new Set(near.map((p) => p.id));
  const far = abroad.status === "fulfilled" ? abroad.value.filter((p) => !seen.has(p.id)) : [];
  const keepFar = Math.min(far.length, Math.max(ABROAD_KEPT, SHOWN - near.length));
  return [...near.slice(0, SHOWN - keepFar), ...far.slice(0, keepFar)];
}

/** Closes the visitor's billing session for the place they picked (id only: free tier). */
export async function closeSession(placeId: string, sessionToken: string, signal: AbortSignal) {
  const url = `${API}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`;
  const res = await fetch(url, { signal, headers: { "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!, "X-Goog-FieldMask": "id" } });
  if (!res.ok) throw new Error(`Places details ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
