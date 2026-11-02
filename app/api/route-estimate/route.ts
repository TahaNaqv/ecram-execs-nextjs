import { cachedDriveEstimate, estimateEnabled } from "@/lib/fleet/estimate";
import { MAX_STOPS } from "@/lib/quotes/stops";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

const clean = (s: string | null) => (s ?? "").trim().replace(/\s+/g, " ");

/**
 * Distance and driving time for the booking's review step (see lib/fleet/estimate.ts). Nothing is stored; when Google is
 * not set up or cannot find the route, the answer is empty and the review simply leaves the line out.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = clean(params.get("from"));
  const to = clean(params.get("to"));
  const stops = params.getAll("stop").map(clean).filter(Boolean);
  const ok = (s: string) => s.length >= 2 && s.length <= 200;
  if (!ok(from) || !ok(to) || stops.length > MAX_STOPS || !stops.every(ok)) return Response.json({ error: "invalid" }, { status: 400 });
  if (!estimateEnabled()) return Response.json({});

  const { ipHash } = await visitor();
  if (!withinLimit(`route-estimate:${ipHash}`, 20, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429 });

  try {
    const { meters, seconds } = await cachedDriveEstimate(from, to, stops);
    return Response.json({ meters, seconds }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[route-estimate] failed", err);
    return Response.json({});
  }
}
