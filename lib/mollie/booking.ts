import "server-only";
import { eq } from "drizzle-orm";
import { setBookingStatus } from "@/lib/admin/approve";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { amsterdamDay, confirmsAutomatically, planFor, type PaymentPlan } from "@/lib/payments/schedule";
import type { Price } from "@/lib/pricing/rates";
import { guestKey } from "@/lib/quotes/guest-link";
import { mollieConfigured } from "./config";
import { publicOrigin } from "./origin";
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

/**
 * A ride six months or more ahead is confirmed as soon as it is booked, before the service fee is taken.
 * A nearer ride is left for the team. A car already held comes back unchanged, still unconfirmed, so nothing is charged.
 */
export async function confirmIfAutomatic(request: QuoteRequest, mail = true): Promise<QuoteRequest> {
  if (request.status !== "new" || !confirmsAutomatically(request.paymentPlan)) return request;
  const result = await setBookingStatus(request.id, { newStatus: "confirmed", sendMail: mail, adminId: null, onlyFrom: "new" });
  if (result.status === "ok") {
    await db.insert(schema.requestEvents).values({ requestId: request.id, event: "auto_approved" });
    await db.update(schema.quoteRequests).set({ autoApproveDoneAt: new Date() }).where(eq(schema.quoteRequests.id, request.id));
    await result.followUp();
    const [now] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, request.id)).limit(1);
    return now ?? request;
  }
  if (result.status === "clash") {
    await db.update(schema.quoteRequests).set({ autoApproveStoppedAt: new Date() }).where(eq(schema.quoteRequests.id, request.id));
  }
  return request;
}

/** Where Mollie sends the customer back to: the return route, which asks Mollie and then opens the booking's page. */
export async function returnUrlFor(request: Pick<QuoteRequest, "id" | "reference">, locale: Locale, who: "guest" | "partner", stay = false): Promise<string | null> {
  const origin = await publicOrigin();
  if (!origin) return null;
  const params =
    who === "partner"
      ? new URLSearchParams({ for: "partner", ref: request.reference, locale })
      : new URLSearchParams({ ref: request.reference, k: guestKey(request.id), locale });
  // The website review tab stays where it is. Mollie's own tab must not be sent back over it.
  if (stay && who === "guest") params.set("stay", "1");
  return `${origin}/api/mollie/return?${params}`;
}

/**
 * After a booking is confirmed (by itself, when the ride is six months or more ahead): records the customer's agreement
 * and opens the fee payment. A nearer ride is not confirmed yet, so this opens nothing and no checkout is started.
 */
export async function payAtBooking(
  request: QuoteRequest,
  { consent, ipHash, locale, who, stay = false }: { consent: boolean; ipHash: string | null; locale: Locale; who: "guest" | "partner"; stay?: boolean },
): Promise<string | undefined> {
  if (!request.paymentPlan || !consent) return undefined;
  try {
    await recordConsent(request.id, ipHash);
    const back = await returnUrlFor(request, locale, who, stay);
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
