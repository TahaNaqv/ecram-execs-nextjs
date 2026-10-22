import type { PlaceHit } from "./types";

/**
 * The places our clients are collected from most, offered before (or, without a Google key, instead of) Google's
 * suggestions. Kept short on purpose: anything else is found by Google or typed in by hand. Names are proper nouns,
 * the same in both languages.
 */
export const CURATED_PLACES: PlaceHit[] = [
  { id: null, name: "Amsterdam Airport Schiphol", detail: "Schiphol", kind: "airport", source: "list" },
  { id: null, name: "Schiphol General Aviation Terminal", detail: "Schiphol-Oost", kind: "aviation", source: "list" },
  { id: null, name: "Rotterdam The Hague Airport", detail: "Rotterdam", kind: "airport", source: "list" },
  { id: null, name: "Eindhoven Airport", detail: "Eindhoven", kind: "airport", source: "list" },
  { id: null, name: "Groningen Airport Eelde", detail: "Eelde", kind: "airport", source: "list" },
  { id: null, name: "Maastricht Aachen Airport", detail: "Beek", kind: "airport", source: "list" },
  { id: null, name: "Brussels Airport", detail: "Zaventem", kind: "airport", source: "list" },
  { id: null, name: "Düsseldorf Airport", detail: "Düsseldorf", kind: "airport", source: "list" },
  { id: null, name: "Schiphol Airport station", detail: "Schiphol", kind: "station", source: "list" },
  { id: null, name: "Amsterdam Centraal", detail: "Amsterdam", kind: "station", source: "list" },
  { id: null, name: "Den Haag Centraal", detail: "Den Haag", kind: "station", source: "list" },
  { id: null, name: "Rotterdam Centraal", detail: "Rotterdam", kind: "station", source: "list" },
  { id: null, name: "Utrecht Centraal", detail: "Utrecht", kind: "station", source: "list" },
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Our own places matching what was typed (every word must appear), airports first as listed. */
export function matchCurated(query: string, limit = 3): PlaceHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return CURATED_PLACES.filter((p) => {
    const text = fold(`${p.name} ${p.detail}`);
    return words.every((w) => text.includes(w));
  }).slice(0, limit);
}

/** The kind of a typed-in place we know by name ("Schiphol" counts as the airport), so an airport is seen without Google. */
export function curatedKind(text: string) {
  const exact = CURATED_PLACES.find((p) => fold(p.name) === fold(text.trim()));
  if (exact) return exact.kind;
  return /\b(airport|luchthaven|schiphol)\b/i.test(text) && !/station/i.test(text) ? "airport" : null;
}
