import { companyLookupEnabled } from "@/lib/companies/provider";
import { searchCompanies } from "@/lib/companies/search";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

/**
 * Company search for the booking forms. A GET Route Handler rather than a Server Action on purpose:
 * Server Actions run one at a time per client, so every keystroke would queue behind the last, and an
 * action can't be cancelled when the next letter arrives. The KvK key stays on the server.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 80) return Response.json({ error: "invalid_query" }, { status: 400 });

  if (!companyLookupEnabled()) return Response.json({ items: [], available: false });

  const { ipHash } = await visitor();
  if (!withinLimit(`companies:${ipHash}`, 40, 60_000)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  try {
    const items = await searchCompanies(q, AbortSignal.timeout(5000));
    return Response.json({ items, available: true }, { headers: { "Cache-Control": "private, max-age=60" } });
  } catch (err) {
    // The form still works: the visitor types their company in by hand
    console.error("[companies] search failed", err);
    return Response.json({ items: [], available: false }, { status: 502 });
  }
}
