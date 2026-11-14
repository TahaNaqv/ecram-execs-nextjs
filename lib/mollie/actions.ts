"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getCorporateContact } from "@/lib/corporate/access";
import { partnerOwns, REF_RE } from "@/lib/corporate/bookings";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { getGuestBooking } from "@/lib/quotes/guest";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";
import { siteOrigin } from "./config";
import { startPayment } from "./pay";

export type PayState = { error?: string; notice?: string };

const localeOf = (formData: FormData): Locale => {
  const value = formData.get("locale");
  return typeof value === "string" && isLocale(value) ? value : "en";
};

/** A few tries per visitor, before anything else (wrong keys included): enough for a changed mind, not for a loop. */
async function visitorLimited(): Promise<boolean> {
  const { ipHash } = await visitor();
  return !withinLimit(`pay:ip:${ipHash}`, 15, 10 * 60_000);
}
const bookingLimited = (bookingId: string) => !withinLimit(`pay:booking:${bookingId}`, 10, 10 * 60_000);

async function go(requestId: string, returnUrl: string, formData: FormData): Promise<PayState> {
  const t = (await dictionaryFromForm(formData)).guestBooking;
  const result = await startPayment(requestId, returnUrl);
  if (result.status === "redirect") redirect(result.url);
  if (result.status === "in_progress") return { notice: t.payInProgress };
  if (result.status === "nothing_due") return { notice: t.payNothingDue };
  return { error: t.payFailed };
}

/** "Pay now" on a website guest's booking page: the private link's key is checked again here. */
export async function payBooking(_prev: PayState, formData: FormData): Promise<PayState> {
  const t = (await dictionaryFromForm(formData)).guestBooking;
  if (await visitorLimited()) return { error: t.payTooMany };
  const booking = await getGuestBooking(formData.get("ref"), formData.get("k"));
  if (!booking) return { error: t.payFailed };
  if (bookingLimited(booking.id)) return { error: t.payTooMany };
  const origin = siteOrigin();
  if (!origin) return { error: t.payFailed };
  const locale = localeOf(formData);
  const back = new URLSearchParams({ ref: booking.reference, k: String(formData.get("k")), locale });
  return go(booking.id, `${origin}/api/mollie/return?${back}`, formData);
}

/** "Pay now" on a partner's booking page in the portal: only a booking of the signed-in partner. */
export async function payPartnerBooking(_prev: PayState, formData: FormData): Promise<PayState> {
  const t = (await dictionaryFromForm(formData)).guestBooking;
  if (await visitorLimited()) return { error: t.payTooMany };
  const contact = await getCorporateContact();
  const reference = formData.get("reference");
  if (!contact || typeof reference !== "string" || !REF_RE.test(reference)) return { error: t.payFailed };
  const q = schema.quoteRequests;
  const [booking] = await db.select({ id: q.id }).from(q).where(and(eq(q.reference, reference), partnerOwns(contact.id))).limit(1);
  if (!booking) return { error: t.payFailed };
  if (bookingLimited(booking.id)) return { error: t.payTooMany };
  const origin = siteOrigin();
  if (!origin) return { error: t.payFailed };
  const locale = localeOf(formData);
  const back = new URLSearchParams({ for: "partner", ref: reference, locale });
  return go(booking.id, `${origin}/api/mollie/return?${back}`, formData);
}
