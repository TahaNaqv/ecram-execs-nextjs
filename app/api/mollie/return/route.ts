import { and, eq } from "drizzle-orm";
import { after, NextRequest, NextResponse } from "next/server";
import { runPaymentSteps } from "@/lib/mollie/schedule";
import { getCorporateContact } from "@/lib/corporate/access";
import { partnerOwns, REF_RE } from "@/lib/corporate/bookings";
import { db, schema } from "@/lib/db";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import { isLoopbackOrigin, siteOrigin } from "@/lib/mollie/config";
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
  const configured = siteOrigin();
  // A localhost SITE_URL must not send the customer off the deployed site. The request's own host is the page that exists.
  const origin = configured && !isLoopbackOrigin(configured) ? configured : req.nextUrl.origin;
  const locale: Locale = isLocale(params.get("locale") ?? undefined) ? (params.get("locale") as Locale) : "en";
  const ref = params.get("ref") ?? "";
  const stay = params.get("stay") === "1";
  const home = NextResponse.redirect(`${origin}${localizedPath("/", locale)}`, 303);
  try {
    if (!REF_RE.test(ref)) return stay ? stayResponse(locale, ref || "—", null) : home;

    if (params.get("for") === "partner") {
      const contact = await getCorporateContact();
      const target = `${origin}${localizedPath("/corporate-partner/account/booking", locale)}?ref=${encodeURIComponent(ref)}`;
      if (!contact) return stay ? stayResponse(locale, ref, null) : NextResponse.redirect(target, 303);
      const q = schema.quoteRequests;
      const [booking] = await db.select({ id: q.id }).from(q).where(and(eq(q.reference, ref), partnerOwns(contact.id))).limit(1);
      if (booking && withinLimit(`paid-return:${booking.id}`, 6, 10 * 60_000)) {
        await refreshOnReturn(booking.id);
        after(() => runPaymentSteps(booking.id));
      }
      if (stay) {
        const status = booking ? (await openCheckoutFor(booking.id)).status : null;
        return stayResponse(locale, ref, status);
      }
      return NextResponse.redirect(target, 303);
    }

    const booking = await getGuestBooking(ref, params.get("k"));
    if (!booking) return stay ? stayResponse(locale, ref, null) : home;
    if (withinLimit(`paid-return:${booking.id}`, 6, 10 * 60_000)) {
      await refreshOnReturn(booking.id);
      after(() => runPaymentSteps(booking.id));
    }
    // Book and pay keeps the confirmation in the original tab. This tab stays here and only reports the payment.
    if (stay) {
      const { status } = await openCheckoutFor(booking.id);
      return stayResponse(locale, booking.reference, status);
    }
    return NextResponse.redirect(`${origin}${guestPath(booking, locale)}`, 303);
  } catch (error) {
    console.error("[mollie] return failed", error instanceof Error ? error.message : error);
    if (stay) return stayResponse(locale, REF_RE.test(ref) ? ref : "—", null);
    return home;
  }
}

function stayResponse(locale: Locale, reference: string, status: string | null) {
  return new NextResponse(stayPage(locale, reference, status), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" },
  });
}

/** The payment tab's own result. No link back to the site: the booking tab follows the payment by itself. */
function stayPage(locale: Locale, reference: string, status: string | null): string {
  const kind = status === "paid" ? "paid" : status === "expired" ? "expired" : status === "failed" || status === "canceled" ? "failed" : "open";
  const nl = locale === "nl";
  const title =
    kind === "paid"
      ? nl ? "BETALING GELUKT" : "PAYMENT SUCCESSFUL"
      : kind === "expired"
        ? nl ? "BETALING VERLOPEN" : "PAYMENT EXPIRED"
        : kind === "failed"
          ? nl ? "BETALING MISLUKT" : "PAYMENT FAILED"
          : status
            ? nl ? "BETALING OPEN" : "PAYMENT OPEN"
            : nl ? "BETALING ONBEKEND" : "PAYMENT UNCONFIRMED";
  const close = nl ? "Dit tabblad sluiten" : "Close this tab";
  const note =
    kind === "paid"
      ? ""
      : kind === "expired"
        ? nl ? "Deze betaalpoging is verlopen. U kunt dit tabblad sluiten." : "This payment attempt expired. You can close this tab."
        : kind === "failed"
          ? nl ? "Deze betaalpoging is mislukt. U kunt dit tabblad sluiten." : "This payment attempt failed. You can close this tab."
          : status
            ? nl ? "Deze betaling staat nog open. U kunt dit tabblad sluiten." : "This payment is still open. You can close this tab."
            : nl ? "We konden deze betaling niet bevestigen. U kunt dit tabblad sluiten." : "We could not confirm this payment. You can close this tab.";
  const tone = kind === "paid" ? "#1f8a4c" : kind === "expired" ? "#b7791f" : kind === "failed" ? "#b42318" : "#8d96bb";
  const mark = kind === "paid"
    ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : kind === "open"
      ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="2"/><path d="M12 8v5l3 2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`
      : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#06133f;color:#f6f1e7;font-family:Georgia,"Times New Roman",serif}
    main{width:min(420px,calc(100% - 48px));box-sizing:border-box;margin:24px;padding:40px 32px;text-align:center;background:#0c1d55;border:1px solid rgba(255,255,255,.14);border-radius:24px}
    .mark{width:64px;height:64px;margin:0 auto 20px;display:grid;place-items:center;border-radius:50%;background:${tone}}
    h1{margin:0 0 14px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:18px;font-weight:600;letter-spacing:.16em}
    .ref{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;font-weight:600;letter-spacing:.18em}
    .note{margin:14px 0 0;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;font-weight:400;letter-spacing:0;line-height:1.45;color:#d7deef}
    button{margin-top:28px;border:0;border-radius:999px;padding:12px 22px;background:#f6f1e7;color:#10224f;font:600 12px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer}
  </style></head><body><main><div class="mark">${mark}</div><h1>${escapeHtml(title)}</h1><p class="ref">${escapeHtml(reference)}</p>${note ? `<p class="note">${escapeHtml(note)}</p>` : ""}<button type="button" onclick="window.close()">${escapeHtml(close)}</button></main><script>
    (function () {
      var payload = ${JSON.stringify({ ref: reference, status: kind }).replace(/</g, "\\u003c")};
      try { localStorage.setItem("ee-payment", JSON.stringify(Object.assign({ at: Date.now() }, payload))); } catch (e) {}
      try { var channel = new BroadcastChannel("ee-payment"); channel.postMessage(payload); channel.close(); } catch (e) {}
    })();
  </script></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
