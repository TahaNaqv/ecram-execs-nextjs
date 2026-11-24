import { and, eq } from "drizzle-orm";
import { after, NextRequest, NextResponse } from "next/server";
import { runPaymentSteps } from "@/lib/mollie/schedule";
import { getCorporateContact } from "@/lib/corporate/access";
import { partnerOwns, REF_RE } from "@/lib/corporate/bookings";
import { db, schema } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import { siteOrigin } from "@/lib/mollie/config";
import { openCheckoutFor, refreshOnReturn } from "@/lib/mollie/pay";
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
    if (booking && withinLimit(`paid-return:${booking.id}`, 6, 10 * 60_000)) {
      // Asks Mollie; a status in this link is never trusted (anyone with the link could type one); refreshOnReturn also updates the booking's payment status
      await refreshOnReturn(booking.id);
            after(() => runPaymentSteps(booking.id));
    }
    return NextResponse.redirect(target, 303);
  }

  const booking = await getGuestBooking(ref, params.get("k"));
  if (!booking) return home;
  if (withinLimit(`paid-return:${booking.id}`, 6, 10 * 60_000)) {
    // Asks Mollie; a status in this link is never trusted (anyone with the link could type one); refreshOnReturn also updates the booking's payment status
    await refreshOnReturn(booking.id);
        // Approved by itself (6 months or more ahead) and announced: after the customer is on their way to the page
    after(() => runPaymentSteps(booking.id));
  }
  // Book and pay keeps Review your booking in the original tab. This tab is only Mollie's.
  if (params.get("stay") === "1") {
    // Says how the payment ended, so a failed card is not mistaken for done (24 Nov 2026); the booking's tab follows by itself
    const { status } = await openCheckoutFor(booking.id);
    const failed = status === "failed" || status === "canceled" || status === "expired";
    const note =
      status === "paid"
        ? locale === "nl"
          ? "Betaling ontvangen. U kunt dit tabblad sluiten en teruggaan naar uw boeking."
          : "Payment received. You can close this tab and return to your booking."
        : failed
          ? locale === "nl"
            ? "De betaling is niet gelukt. Ga terug naar uw boeking en betaal daar opnieuw."
            : "The payment did not go through. Go back to your booking and pay again from there."
          : locale === "nl"
            ? "U kunt dit tabblad sluiten en teruggaan naar uw boeking."
            : "You can close this tab and return to your booking."
    // Also the way back when this is the customer's only tab (a payment re-opened in the same tab)
    const back = `${origin}${guestPath(booking, locale)}`;
    const backLabel = locale === "nl" ? "Terug naar uw boeking" : "Back to your booking";
    const html = `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${escapeHtml(booking.reference)}</title></head><body style="font-family:Georgia,serif;margin:48px;color:#0a1942"><p>${escapeHtml(note)}</p><p>${escapeHtml(booking.reference)}</p><p><a href="${escapeHtml(back)}" style="color:#0a1942">${escapeHtml(backLabel)}</a></p></body></html>`;
    return new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
  }
  return NextResponse.redirect(`${origin}${guestPath(booking, locale)}`, 303);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
