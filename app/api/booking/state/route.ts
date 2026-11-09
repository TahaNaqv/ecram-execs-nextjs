import { NextResponse, type NextRequest } from "next/server";
import { guestState } from "@/lib/quotes/guest";

/**
 * What a visitor's open booking page polls while the booking manager reviews it: the status and when the conversation last
 * changed, nothing else. Needs the booking's private key; anything else is a plain 404.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = await guestState(params.get("ref"), params.get("k"));
  const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404, headers });
  return NextResponse.json(state, { headers });
}
