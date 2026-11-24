import { after, NextRequest, NextResponse } from "next/server";
import { runPaymentSteps } from "@/lib/mollie/schedule";
import { paymentByMollieId, refreshPayment, syncBookingPaymentStatus } from "@/lib/mollie/pay";

/**
 * Mollie calls this when a payment (or one of its refunds) changes, with only the payment's id in the body. Anything else
 * in the body is ignored: this address is public, so a posted status or booking id could come from anyone. The status is
 * always asked of Mollie (refreshPayment) and the booking's payment status follows from that (24 Nov 2026).
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const json = !form ? await req.json().catch(() => null) : null;
  const id = (form?.get("id") as string) || (json?.id as string) || undefined;

  if (typeof id !== "string" || !/^tr_\w{4,40}$/.test(id)) {
    return new NextResponse(null, { status: 200 });
  }

  const row = await paymentByMollieId(id);
  if (!row) return new NextResponse(null, { status: 200 });
  try {
    // Busy with this payment right now (the customer's return, the sweep): Mollie is asked to call again shortly
    const done = await refreshPayment(row.id);
    if (row.requestId) {
      await syncBookingPaymentStatus(row.requestId);
    }
    // The booking's own steps follow at once (approved by itself, announced), after the answer to Mollie
    if (done && row.requestId) {
      const requestId = row.requestId;
      after(() => runPaymentSteps(requestId));
    }
    return new NextResponse(null, { status: done === null ? 503 : 200 });
  } catch (err) {
    console.error("[mollie] webhook failed", err instanceof Error ? err.message : err);
    return new NextResponse(null, { status: 500 });
  }
}
