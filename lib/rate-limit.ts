import "server-only";

/**
 * A fixed-window limit per key, in memory. It holds per server instance only, which is right for a single server
 * and still useful behind several: it stops one browser hammering an endpoint, which is what it is for. For limits
 * that must be exact or survive a restart (form submissions), count rows in the database instead.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function withinLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > 5000) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}
