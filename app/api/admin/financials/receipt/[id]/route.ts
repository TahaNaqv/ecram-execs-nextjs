import { eq } from "drizzle-orm";
import { z } from "zod";
import { buildBookingReceipt } from "@/lib/admin/financial-receipt";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

const NO_STORE = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

/** The booking confirmation PDF, built with the same receipt the website downloads. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/financials/receipt/[id]">) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404, headers: NO_STORE });

  const [row] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
  if (!row) return new Response("Not found", { status: 404, headers: NO_STORE });

  const dict = await adminDictionary();
  const bytes = buildBookingReceipt(
    row,
    {
      status: dict.admin.statuses[row.status],
      service: dict.services[row.service],
      hourly: dict.admin.requestDetail.durationValue,
      net: dict.admin.financials.receiptNet,
      vatLow: dict.booking.priceVat,
      vatHigh: dict.booking.priceVatHigh,
      words: {
        receiptRides: dict.booking.receiptRides,
        receiptKm: dict.booking.receiptKm,
        priceServiceFee: dict.booking.priceServiceFee,
        priceVat: dict.booking.priceVat,
        priceVatHigh: dict.booking.priceVatHigh,
        priceFeeVat: dict.booking.priceFeeVat,
      },
      extras: dict.addOns,
    },
    admin.locale,
  );

  const filename = `${row.reference.replace(/[^A-Za-z0-9-]/g, "") || "receipt"}.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
      ...NO_STORE,
    },
  });
}
