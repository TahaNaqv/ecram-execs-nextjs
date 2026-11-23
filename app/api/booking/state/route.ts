import { NextResponse, type NextRequest } from "next/server";
import { refreshOnReturn } from "@/lib/mollie/pay";
import { getGuestBooking, guestState } from "@/lib/quotes/guest";

/**
 * What a visitor's open booking page polls while the booking manager reviews it: the status and when the conversation last
 * changed, nothing else. Needs the booking's private key; anything else is a plain 404.
 * `sync=1` asks Mollie about the latest payment first, so the confirmation screen can show Paid without leaving the page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (params.get("sync") === "1") {
    const booking = await getGuestBooking(params.get("ref"), params.get("k"));
    if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
    await refreshOnReturn(booking.id).catch(() => undefined);
  }
  const state = await guestState(params.get("ref"), params.get("k"));
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json(state, { headers });
}
