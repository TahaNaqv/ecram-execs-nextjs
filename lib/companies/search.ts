import "server-only";
import type { CompanyHit } from "./provider";
import { kvkProvider } from "./kvk";

const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; hits: CompanyHit[] }>();

/** Same typing, same answer: lowercased and whitespace-collapsed so "orion  " and "Orion" share an entry. */
export const normaliseQuery = (q: string) => q.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Searches the registry through a small in-memory cache, so a visitor typing "orion" and the next one
 * typing "orion" cost one registry call. The cache is per server instance and short-lived on purpose:
 * it softens the burst of keystrokes; it is not a copy of the register.
 */
export async function searchCompanies(query: string, signal: AbortSignal): Promise<CompanyHit[]> {
  const key = normaliseQuery(query);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.hits;

  const hits = await kvkProvider.search(key, signal);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), hits });
  return hits;
}

/**
 * A fixed-window limit per visitor. In memory, so it holds per server instance only — enough to stop
 * one browser hammering the search, which is what it is for; the registry's own limits are the backstop.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function withinLimit(visitorKey: string, max = 40, windowMs = 60_000) {
  const now = Date.now();
  const bucket = buckets.get(visitorKey);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(visitorKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
