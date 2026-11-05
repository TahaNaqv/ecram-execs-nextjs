import type { PlaceHit } from "./types";

/**
 * The places our clients are collected from most, offered before (or, without a Google key, instead of) Google's
 * suggestions. Kept short on purpose: anything else is found by Google or typed in by hand. Names are proper nouns,
 * the same in both languages.
 */
const listed = (id: string, name: string, detail: string, kind: PlaceHit["kind"]): PlaceHit => ({
  id: `curated-${id}`,
  name,
  detail,
  kind,
  source: "list",
});

export const CURATED_PLACES: PlaceHit[] = [
  listed("schiphol", "Amsterdam Airport Schiphol", "Schiphol", "airport"),
  listed("schiphol-gat", "Schiphol General Aviation Terminal", "Schiphol-Oost", "aviation"),
  listed("rotterdam", "Rotterdam The Hague Airport", "Rotterdam", "airport"),
  listed("eindhoven", "Eindhoven Airport", "Eindhoven", "airport"),
  listed("eelde", "Groningen Airport Eelde", "Eelde", "airport"),
  listed("maastricht", "Maastricht Aachen Airport", "Beek", "airport"),
  listed("schiphol-station", "Schiphol Airport station", "Schiphol", "station"),
  listed("amsterdam-centraal", "Amsterdam Centraal", "Amsterdam", "station"),
  listed("den-haag-centraal", "Den Haag Centraal", "Den Haag", "station"),
  listed("rotterdam-centraal", "Rotterdam Centraal", "Rotterdam", "station"),
  listed("utrecht-centraal", "Utrecht Centraal", "Utrecht", "station"),
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
