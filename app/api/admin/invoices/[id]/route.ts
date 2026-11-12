import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/** An uploaded tax invoice, for a signed-in admin. The same file the partner downloads from their booking. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/invoices/[id]">) {
  await requireAdmin();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404, headers: NO_STORE });

  const [invoice] = await db
    .select({ path: schema.bookingInvoices.path, fileName: schema.bookingInvoices.fileName })
    .from(schema.bookingInvoices)
    .where(eq(schema.bookingInvoices.id, id))
    .limit(1);
  if (!invoice) return new Response("Not found", { status: 404, headers: NO_STORE });

  const bytes = await readStoredFile(invoice.path);
  if (!bytes) return new Response("Not found", { status: 404, headers: NO_STORE });

  const ascii = invoice.fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(invoice.fileName)}`,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      ...NO_STORE,
    },
  });
}
