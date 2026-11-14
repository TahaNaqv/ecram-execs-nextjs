import { NextRequest, NextResponse } from "next/server";
import { paymentByMollieId, refreshPayment } from "@/lib/mollie/pay";

/**
 * Mollie calls this when a payment (or one of its refunds) changes, with only the payment's id in the body. Nothing in the
 * call is believed: the payment is asked of Mollie with our own key (refreshPayment). An id that is not one of ours is
 * answered 200 and ignored; a failure on our side answers 500, so Mollie tries again later.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const id = form?.get("id");
  if (typeof id !== "string" || !/^tr_\w{4,40}$/.test(id)) return new NextResponse(null, { status: 200 });
  const row = await paymentByMollieId(id);
  if (!row) return new NextResponse(null, { status: 200 });
  try {
    // Busy with this payment right now (the customer's return, the sweep): Mollie is asked to call again shortly
    const done = await refreshPayment(row.id);
    return new NextResponse(null, { status: done === null ? 503 : 200 });
  } catch (err) {
    console.error("[mollie] webhook failed", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
