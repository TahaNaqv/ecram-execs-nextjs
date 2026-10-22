import { closeSession, placesEnabled } from "@/lib/places/google";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

const SESSION = /^[0-9a-f-]{36}$/;
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

/**
 * Called once a visitor picks one of Google's suggestions: it ends their Places session so Google bills the session
 * once rather than every keystroke. Nothing comes back but "done"; the address the visitor saw is what we keep.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; session?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const session = typeof body?.session === "string" ? body.session : "";
  if (!PLACE_ID.test(id) || !SESSION.test(session)) return Response.json({ error: "invalid" }, { status: 400 });
  if (!placesEnabled()) return Response.json({ ok: false });

  const { ipHash } = await visitor();
  if (!withinLimit(`places-details:${ipHash}`, 20, 60_000)) return Response.json({ error: "rate_limited" }, { status: 429 });

  try {
    await closeSession(id, session, AbortSignal.timeout(5000));
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[places] details failed", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}
