import { readFile } from "node:fs/promises";
import { getAdmin } from "@/lib/auth/session";
import { absolutePath, CONTENT_TYPES, extensionOf, verify } from "@/lib/storage-local";

/**
 * Opens a stored document for an admin. Two things are required: a signed, short-lived link (the admin page
 * mints one per document) and a signed-in admin session, so a link that leaks into a log or a forwarded email
 * opens nothing for anyone else.
 */
export async function GET(request: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "private, no-store" } });

  const claim = verify(new URL(request.url).searchParams.get("t"), "get");
  const target = claim && absolutePath(claim.path);
  if (!claim || !target) return new Response("This link has expired. Reload the application page.", { status: 403, headers: { "Cache-Control": "private, no-store" } });

  const bytes = await readFile(target).catch(() => null);
  if (!bytes) return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });

  const ext = extensionOf(claim.path);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext],
      // A download, not a page: a stored PDF is applicant-supplied and must not run in the same origin as the admin panel
      "Content-Disposition": `attachment; filename="${claim.path.split("/")[1]}"`,
      "Content-Length": String(bytes.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
