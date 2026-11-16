import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { amsterdamDay, planFor, type PaymentPlan } from "@/lib/payments/schedule";
import type { Price } from "@/lib/pricing/rates";
import { guestKey } from "@/lib/quotes/guest-link";
import { mollieConfigured, siteOrigin } from "./config";
import { recordConsent, startPayment } from "./pay";

/**
 * Paying at the moment of booking (the client's rules of 15 Nov 2026). Only while online payment is on: a booking made
 * while it is off keeps the old way (paid in full after approval), and so does one with no date or price yet (a bespoke
 * programme is quoted by hand).
 */
export function planForNewBooking(pickupAt: string | null | undefined, price: Price | null | undefined): { paymentPlan: PaymentPlan } | Record<string, never> {
  if (!mollieConfigured() || !price || !(price.total > 0)) return {};
  const plan = planFor(pickupAt, amsterdamDay());
  return plan ? { paymentPlan: plan } : {};
}

/** Where Mollie sends the customer back to: the return route, which asks Mollie and then opens the booking's page. */
export function returnUrlFor(request: Pick<QuoteRequest, "id" | "reference">, locale: Locale, who: "guest" | "partner"): string | null {
  const origin = siteOrigin();
  if (!origin) return null;
  const params =
    who === "partner"
      ? new URLSearchParams({ for: "partner", ref: request.reference, locale })
      : new URLSearchParams({ ref: request.reference, k: guestKey(request.id), locale });
  return `${origin}/api/mollie/return?${params}`;
}

/**
 * Right after a booking with a plan is saved: records the customer's agreement (the terms tick, sent with the form) and
 * opens the payment at booking, a first card payment that saves the card. Mollie's page, or nothing when it cannot be
 * opened now (the booking's page then offers the payment, with the tick).
 */
export async function payAtBooking(
  request: QuoteRequest,
  { consent, ipHash, locale, who }: { consent: boolean; ipHash: string | null; locale: Locale; who: "guest" | "partner" },
): Promise<string | undefined> {
  if (!request.paymentPlan || !consent) return undefined;
  try {
    await recordConsent(request.id, ipHash);
    const back = returnUrlFor(request, locale, who);
    if (!back) return undefined;
    const result = await startPayment(request.id, back);
    return result.status === "redirect" ? result.url : undefined;
  } catch (err) {
    console.error(`[mollie] payment at booking for ${request.reference} could not be opened:`, err instanceof Error ? err.message : err);
    return undefined;
  }
}

/** The booking was announced when it came in (no checkout was opened): the payment, when it comes, does not announce it again. */
export async function markAnnounced(requestId: string): Promise<void> {
  await db.update(schema.quoteRequests).set({ paidNotifiedAt: new Date() }).where(eq(schema.quoteRequests.id, requestId));
}

/**
 * The terms tick sent with a new booking counts only for what the customer saw: the payment plan and total shown on the
 * review screen must be the ones the server worked out (a price change, or midnight passing, makes them differ; the
 * customer then agrees on the booking's page instead).
 */
export function consentFromForm(formData: FormData, request: Pick<QuoteRequest, "paymentPlan" | "priceEstimate">): boolean {
  if (String(formData.get("consent") ?? "") !== "1" || !request.paymentPlan) return false;
  return formData.get("consentPlan") === request.paymentPlan && Number(formData.get("consentTotal")) === request.priceEstimate?.total;
}
