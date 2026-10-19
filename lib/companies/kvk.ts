import "server-only";
import type { CompanyHit, CompanyProvider } from "./provider";

/**
 * KvK Zoeken API (the Chamber of Commerce register). Needs an API key from developers.kvk.nl.
 * `KVK_API_BASE` points it at the KvK test environment (https://api.kvk.nl/test/api) while the key is
 * being set up; production is the default.
 *
 * Responses are read defensively: anything missing becomes null rather than an error, so a change in
 * what the registry returns degrades the suggestion, never the page.
 */
const BASE = process.env.KVK_API_BASE ?? "https://api.kvk.nl/api";

type Raw = {
  resultaten?: {
    kvkNummer?: string;
    naam?: string;
    type?: string;
    adres?: { binnenlandsAdres?: { plaats?: string } };
  }[];
};

export const kvkProvider: CompanyProvider = {
  async search(query, signal) {
    const url = new URL(`${BASE}/v2/zoeken`);
    url.searchParams.set("naam", query);
    url.searchParams.set("resultatenPerPagina", "10");
    // One entry per company: the head office stands for the company, branches would repeat it
    url.searchParams.set("type", "hoofdvestiging");

    const res = await fetch(url, { headers: { apikey: process.env.KVK_API_KEY! }, signal, cache: "no-store" });
    // The register answers 404 ("no results found") when nothing matches: an answer, not an outage
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`KvK search failed: ${res.status}`);
    const body = (await res.json()) as Raw;

    const hits: CompanyHit[] = [];
    for (const r of body.resultaten ?? []) {
      if (!r.kvkNummer || !/^[0-9]{8}$/.test(r.kvkNummer) || !r.naam) continue;
      hits.push({ kvk: r.kvkNummer, name: r.naam, city: r.adres?.binnenlandsAdres?.plaats ?? null, type: r.type ?? null });
    }
    return hits;
  },
};
