"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { linkChatToRequest, SESSION_ID } from "@/lib/concierge/store";
import { confirmToClient, notifyNewQuote } from "@/lib/email";
import { unknownFleetKeys } from "@/lib/fleet/catalog";
import { allocationFor } from "@/lib/fleet/vehicles";
import { browserMapKey, routeMapLinks, type RouteMapLinks } from "@/lib/fleet/map";
import { visitor } from "@/lib/request-meta";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { priceForRequest } from "@/lib/pricing/quote";
import { createQuoteRequest } from "./create";
import { guestPath } from "./guest-link";

import { readStops } from "./stops";
import { quoteSchema, type QuoteField } from "./validation";

/** The booking's private page, or nothing when the link cannot be made (no secret configured): the booking is in either way. */
function safeGuestPath(request: { id: string; reference: string; locale: "en" | "nl" }): string | undefined {
  try {
    return guestPath(request, request.locale);
  } catch (err) {
    console.error("[booking] no private link for", request.reference, err);
    return undefined;
  }
}

export type QuoteFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<QuoteField, string>>;
      values: Record<string, string>;
      attempt: number;
    }
  | {
      status: "success";
      reference: string;
      name: string;
      map?: RouteMapLinks | null;
      price?: { total: number; exact: boolean } | null;
      /** The booking's private page, where the visitor follows the review (the client, 8 Nov 2026) */
      href?: string;
    };

const FIELDS = [
  // No "returnAt": the client takes no return journeys, so one sent anyway is not read
  "collection", "destination", "pickupAt", "service", "durationHours", "passengers", "luggage", "handLuggage", "flightNumber",
  "pickupPlaceId", "destinationPlaceId", "name", "email", "phoneCountry", "phone", "passengerName", "passengerPhoneCountry",
  "passengerPhone", "vehicle", "vehicles", "extras", "notes", "locale", "entity", "entityKvk",
] as const;
const RATE_LIMIT = { max: 5, windowMinutes: 15 };

export async function submitQuote(prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  // The visitor's language came in with the form; every message below is theirs to read.
  const { forms: t } = await dictionaryFromForm(formData);
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  
  // The stops on the way, each with the minutes to wait there (at most five; see lib/quotes/stops.ts)
  const { destinations, destinationWaits } = readStops(formData);

  const attempt = prev.status === "error" ? prev.attempt + 1 : 1;
  const fail = (message: string, fieldErrors: Partial<Record<QuoteField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values, attempt }) as const;

  // Honeypot: real visitors never see or fill this field
  if (String(formData.get("company_website") ?? "") !== "") {
    return { status: "success", reference: "EE-RECEIVED", name: values.name };
  }

  const tripPurpose = String(formData.get("tripPurpose") ?? "");
  const parsed = quoteSchema(t, destinations).safeParse({
    ...values,
    passengers: values.passengers || undefined,
    vehicle: values.vehicle || undefined,
    notes: values.notes || undefined,
    // A private occasion is not a company booking, even if a company name was left in the draft
    entity: tripPurpose === "private" ? undefined : values.entity || undefined,
    entityKvk: tripPurpose === "private" ? undefined : values.entityKvk || undefined,
    service: tripPurpose === "private" && values.service === "business_travel" ? "private_occasion" : values.service,
  });
  if (parsed.success) {
    const chosen = [parsed.data.vehicle, ...(parsed.data.vehicles ?? []).map((car) => car.key)].filter((key): key is string => Boolean(key));
    if ((await unknownFleetKeys(chosen)).length > 0) return fail(t.checkHighlighted);
  }

  if (!parsed.success) {
    const fieldErrors: Partial<Record<QuoteField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as QuoteField;
      fieldErrors[key] ??= issue.message;
    }
    return fail(t.checkHighlighted, fieldErrors);
  }

  const { ipHash, userAgent } = await visitor();

  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(schema.quoteRequests)
    .where(and(eq(schema.quoteRequests.ipHash, ipHash), gt(schema.quoteRequests.createdAt, since)));
  if (recent >= RATE_LIMIT.max) {
    return fail(t.quoteRateLimited);
  }

  let request: QuoteRequest;
  try {
    const fleet = allocationFor(parsed.data);
    const stops = { destinations: destinations.length > 0 ? destinations : null, destinationWaits: destinations.length > 0 ? destinationWaits : null };
    // The website's rates: a corporate partner books (at the corporate rates) from the portal
    const priceEstimate = await priceForRequest({ ...parsed.data, ...stops }, "public");
    if (priceEstimate) priceEstimate.purpose = tripPurpose === "private" ? "private" : "business";
    request = await createQuoteRequest({
      ...parsed.data,
      ...(fleet.vehicle ? { vehicle: fleet.vehicle } : {}),
      ...stops,
      priceEstimate,
      vehicleCount: fleet.vehicleCount,
      vehicles: fleet.vehicles,
      internalNotes: fleet.internalNotes,
      ipHash,
      userAgent,
    });
  } catch (err) {
    console.error("[quote] insert failed", err);
    return fail(t.quoteServerError);
  }

  // A request sent from the concierge chat carries that chat's session id, so the team can read what led to it
  const chat = String(formData.get("chatSession") ?? "");
  console.info("[booking] request submitted", {
    reference: request.reference,
    id: request.id,
    collection: request.collection,
    stops: request.destinations ?? [],
    waits: request.destinationWaits ?? [],
    destination: request.destination,
    pickupAt: request.pickupAt,
    email: request.email,
  });
  console.info(`[booking] ${request.reference} dispatching team alert and client confirmation`);
  after(async () => {
    const tasks: Promise<unknown>[] = [
      notifyNewQuote(request).then(
        () => console.info(`[booking] ${request.reference} team alert dispatch finished`),
        (err) => console.error(`[booking] ${request.reference} team alert dispatch failed`, err),
      ),
      confirmToClient(request).then(
        () => console.info(`[booking] ${request.reference} client confirmation dispatch finished`),
        (err) => console.error(`[booking] ${request.reference} client confirmation dispatch failed`, err),
      ),
    ];
    if (SESSION_ID.test(chat)) tasks.push(linkChatToRequest(chat, request.id));
    await Promise.all(tasks);
  });

  // The route is only drawn now that the booking is in: the confirmation shows it, the steps before it never load a map
  return {
    status: "success",
    reference: request.reference,
    name: request.name.split(" ")[0],
    map: routeMapLinks(request, browserMapKey()),
    href: safeGuestPath(request),
    price: request.priceEstimate ? { total: request.priceEstimate.total, exact: request.priceEstimate.exact } : null,
  };
}