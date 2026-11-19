import { after, NextRequest, NextResponse } from "next/server";
import { runPaymentSteps } from "@/lib/mollie/schedule";
import { paymentByMollieId, refreshPayment, syncBookingPaymentStatus } from "@/lib/mollie/pay";

/**
 * Mollie calls this when a payment (or one of its refunds) changes, with only the payment's id in the body.
 * Also supports test payment callbacks that post payment status updates.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const json = !form ? await req.json().catch(() => null) : null;
  const id = (form?.get("id") as string) || (json?.id as string) || undefined;
  const rawStatus = (form?.get("status") as string) || (json?.status as string) || (form?.get("paymentStatus") as string) || (json?.paymentStatus as string) || undefined;
  const rawRequestId = (form?.get("requestId") as string) || (json?.requestId as string) || (form?.get("bookingId") as string) || (json?.bookingId as string) || undefined;

  if (rawRequestId && rawStatus) {
    await syncBookingPaymentStatus(rawRequestId, rawStatus);
  }

  if (typeof id !== "string" || !/^tr_\w{4,40}$/.test(id)) {
    return new NextResponse(null, { status: 200 });
  }

  const row = await paymentByMollieId(id);
  if (!row) return new NextResponse(null, { status: 200 });
  try {
    // Busy with this payment right now (the customer's return, the sweep): Mollie is asked to call again shortly
    const done = await refreshPayment(row.id);
    if (row.requestId) {
      await syncBookingPaymentStatus(row.requestId, rawStatus);
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
