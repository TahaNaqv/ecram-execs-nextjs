import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getCorporateContact } from "@/lib/corporate/access";
import { db, schema } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * An invoice, for the partner it belongs to. The sign-in is checked against the database and the invoice must belong
 * to a booking of that partner (anything else, including someone else's invoice, answers exactly like one that doesn't
 * exist). Served as a download, so a stored PDF never runs in the site's own origin.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/portal/invoices/[id]">) {
  const contact = await getCorporateContact();
  if (!contact) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404, headers: NO_STORE });

  const [invoice] = await db
    .select({ path: schema.bookingInvoices.path, fileName: schema.bookingInvoices.fileName })
    .from(schema.bookingInvoices)
    .innerJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.bookingInvoices.requestId))
    .where(and(eq(schema.bookingInvoices.id, id), eq(schema.quoteRequests.corporateContactId, contact.id)))
    .limit(1);
  if (!invoice) return new Response("Not found", { status: 404, headers: NO_STORE });

  const bytes = await readStoredFile(invoice.path);
  if (!bytes) return new Response("Not found", { status: 404, headers: NO_STORE });

  // The name is team-typed; keep it out of the header unescaped
  const ascii = invoice.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(invoice.fileName)}`,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
      ...NO_STORE,
    },
  });
}
