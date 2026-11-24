import { NextResponse, type NextRequest } from "next/server";
import { IN_PROGRESS, refreshOnReturn } from "@/lib/mollie/pay";
import { getGuestBooking, guestState } from "@/lib/quotes/guest";

/**
 * What a visitor's open booking page polls while the booking manager reviews it: the status and when the conversation last
 * changed, nothing else. Needs the booking's private key; anything else is a plain 404.
 * `sync=1` asks Mollie only while a payment is still open, so a review screen does not open a checkout call on every poll.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  let state = await guestState(params.get("ref"), params.get("k"));
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  if (params.get("sync") === "1" && state.payment && (IN_PROGRESS as readonly string[]).includes(state.payment)) {
    const booking = await getGuestBooking(params.get("ref"), params.get("k"));
    if (booking) {
      await refreshOnReturn(booking.id).catch(() => undefined);
      state = (await guestState(params.get("ref"), params.get("k"))) ?? state;
    }
  }
  return NextResponse.json(state, { headers });
}
