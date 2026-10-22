import { matchCurated } from "@/lib/places/curated";
import { autocomplete, placesEnabled } from "@/lib/places/google";
import type { PlaceHit } from "@/lib/places/types";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

const SESSION = /^[0-9a-f-]{36}$/;
const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Address suggestions for the booking flow: our own airports and stations first, then Google's. A GET Route Handler,
 * not a Server Action, for the same reason as /api/companies: every keystroke must be cancellable, not queued.
 * `google` tells the field to show Google's attribution, which their terms require wherever their suggestions appear.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const session = params.get("session") ?? "";
  const lang = params.get("lang") === "nl" ? "nl" : "en";
  if (q.length < 2 || q.length > 120 || !SESSION.test(session)) return Response.json({ error: "invalid_query" }, { status: 400 });

  const ours = matchCurated(q);
  const reply = (items: PlaceHit[], google: boolean, status = 200) =>
    Response.json({ items, google }, { status, headers: { "Cache-Control": "private, no-store" } });

  if (!placesEnabled()) return reply(ours, false);

  const { ipHash } = await visitor();
  if (!withinLimit(`places:${ipHash}`, 60, 60_000)) return reply(ours, false, 429);

  try {
    const theirs = await autocomplete(q, session, lang, AbortSignal.timeout(5000));
    // Our own entry wins when Google suggests the same place under the same name
    const seen = new Set(ours.map((p) => fold(p.name)));
    const google = theirs.filter((p) => !seen.has(fold(p.name)));
    return reply([...ours, ...google].slice(0, 6), google.length > 0);
  } catch (err) {
    // The field still works: our own places, or whatever the visitor types
    console.error("[places] autocomplete failed", err);
    return reply(ours, false, 502);
  }
}
