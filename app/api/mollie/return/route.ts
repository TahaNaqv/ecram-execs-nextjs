import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCorporateContact } from "@/lib/corporate/access";
import { partnerOwns, REF_RE } from "@/lib/corporate/bookings";
import { db, schema } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import { siteOrigin } from "@/lib/mollie/config";
import { refreshOnReturn } from "@/lib/mollie/pay";
import { getGuestBooking } from "@/lib/quotes/guest";
import { guestPath } from "@/lib/quotes/guest-link";
import { withinLimit } from "@/lib/rate-limit";

/**
 * Where Mollie sends the customer back after paying (or not): asks Mollie about the booking's payment, so the booking page
 * they land on is right at once, then sends them there. Done here rather than while rendering the page, which may be
 * rendered more than once. A website guest is checked by the private link's key, a partner by their session.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const origin = siteOrigin() ?? req.nextUrl.origin;
  const locale: Locale = isLocale(params.get("locale") ?? undefined) ? (params.get("locale") as Locale) : "en";
  const ref = params.get("ref") ?? "";
  const home = NextResponse.redirect(`${origin}${localizedPath("/", locale)}`, 303);
  if (!REF_RE.test(ref)) return home;

  if (params.get("for") === "partner") {
    const contact = await getCorporateContact();
    const target = `${origin}${localizedPath("/corporate-partner/account/booking", locale)}?ref=${encodeURIComponent(ref)}`;
    if (!contact) return NextResponse.redirect(target, 303);
    const q = schema.quoteRequests;
    const [booking] = await db.select({ id: q.id }).from(q).where(and(eq(q.reference, ref), partnerOwns(contact.id))).limit(1);
    if (booking && withinLimit(`paid-return:${booking.id}`, 6, 10 * 60_000)) await refreshOnReturn(booking.id);
    return NextResponse.redirect(target, 303);
  }

  const booking = await getGuestBooking(ref, params.get("k"));
  if (!booking) return home;
  if (withinLimit(`paid-return:${booking.id}`, 6, 10 * 60_000)) await refreshOnReturn(booking.id);
  return NextResponse.redirect(`${origin}${guestPath(booking, locale)}`, 303);
}
