"use server";

import { and, count, eq, gt, isNotNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { confirmToClient, emailPartnerBooking, notifyNewQuote, notifyTeamPartnerActivity } from "@/lib/email";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import { isUniqueViolation, makeReference, visitor } from "@/lib/request-meta";
import { SERVICES } from "@/lib/quotes/constants";
import { quoteSchema, type QuoteField } from "@/lib/quotes/validation";
import { getCorporateContact } from "./access";
import { MESSAGEABLE, REF_RE } from "./bookings";
import type { PortalState } from "./portal-state";

const q = schema.quoteRequests;
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const formLocale = (formData: FormData): Locale => {
  const value = String(formData.get("locale") ?? "");
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : "en";
};

/** Requests and messages a partner can send per hour: far above real use, far below a script. */
const BOOKING_LIMIT = { max: 10, minutes: 60 };
const MESSAGE_LIMIT = { max: 20, minutes: 60 };

const FIELDS = ["collection", "destination", "pickupAt", "service", "passengers", "phoneCountry", "phone", "vehicle", "notes", "locale"] as const;

/** A new booking request from inside the portal: the partner's own details, the usual trip fields. */
export async function createBooking(_prev: PortalState, formData: FormData): Promise<PortalState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const locale = formLocale(formData);
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const stops = formData.getAll("destinations").map((d) => String(d).trim().slice(0, 200)).filter(Boolean).slice(0, 5);
  const fail = (message: string, fieldErrors: Partial<Record<QuoteField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values: { ...values, stops: stops.join("\n") } }) as const;

  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: c.sessionExpired };

  const parsed = quoteSchema(f).safeParse({
    ...values,
    name: contact.name,
    email: contact.email,
    passengers: values.passengers || undefined,
    vehicle: values.vehicle || undefined,
    notes: values.notes || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<QuoteField, string>> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as QuoteField] ??= issue.message;
    return fail(f.checkHighlighted, fieldErrors);
  }
  // A bespoke programme has its own form (it has an itinerary, not one journey)
  if (!(SERVICES as readonly string[]).includes(parsed.data.service) || parsed.data.service === "bespoke") {
    return fail(f.checkHighlighted, { service: f.serviceRequired });
  }

  let created: QuoteRequest | undefined;
  try {
    const { ipHash, userAgent } = await visitor();
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(q)
      .where(and(eq(q.corporateContactId, contact.id), eq(q.source, "portal"), gt(q.createdAt, minutesAgo(BOOKING_LIMIT.minutes))));
    if (recent >= BOOKING_LIMIT.max) return fail(f.quoteRateLimited);

    for (let i = 0; i < 3 && !created; i++) {
      try {
        [created] = await db
          .insert(q)
          .values({
            ...parsed.data,
            destinations: stops.length > 0 ? stops : null,
            entity: contact.companyName,
            entityKvk: contact.kvkNumber,
            corporateContactId: contact.id,
            source: "portal",
            reference: makeReference("EE"),
            ipHash,
            userAgent,
          })
          .returning();
      } catch (err) {
        if (!isUniqueViolation(err) || i === 2) throw err;
      }
    }
    const request = created!;
    await db.insert(schema.requestEvents).values({ requestId: request.id, event: "received" });
    after(() => Promise.all([notifyNewQuote(request), confirmToClient(request)]));
  } catch (err) {
    console.error("[portal] booking failed", err);
    return fail(f.quoteServerError);
  }
  redirect(`${localizedPath("/corporate-partner/account/booking", locale)}?ref=${created!.reference}&created=1`);
}

/**
 * Accepts or declines the quote on a booking. One UPDATE decides it: it only applies to this partner's booking, still
 * quoted, and quoted at the very amount the partner was looking at. If the team changed the quote in the meantime
 * nothing happens and the partner is asked to look again, so nobody accepts a price they have not seen.
 */
export async function respondToQuote(_prev: PortalState, formData: FormData): Promise<PortalState> {
  const { corporatePartner: c, portal: p } = await dictionaryFromForm(formData);
  const error = (message: string) => ({ status: "error", message, fieldErrors: {}, values: {} }) as const;

  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: c.sessionExpired };

  const input = z
    .object({
      reference: z.string().regex(REF_RE),
      intent: z.enum(["accept", "decline"]),
      amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return error(c.serverError);
  const { reference, intent, amount, reason } = input.data;
  const accept = intent === "accept";

  let request: QuoteRequest | null = null;
  try {
    request = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(q)
        .set({ status: accept ? "confirmed" : "cancelled", updatedAt: sql`now()` })
        .where(
          and(
            eq(q.reference, reference),
            eq(q.corporateContactId, contact.id),
            eq(q.status, "quoted"),
            isNotNull(q.quotedAmount),
            sql`${q.quotedAmount} = ${amount}::numeric`,
          ),
        )
        .returning();
      if (!row) return null;
      await tx.insert(schema.requestEvents).values({
        requestId: row.id,
        event: accept ? "partner_accepted" : "partner_declined",
        params: accept ? { amount } : reason ? { reason } : {},
      });
      return row;
    });

    if (!request) {
      // Say why, so the partner knows whether to look at the new amount or the quote is simply gone
      const [now] = await db
        .select({ status: q.status, quotedAmount: q.quotedAmount })
        .from(q)
        .where(and(eq(q.reference, reference), eq(q.corporateContactId, contact.id)))
        .limit(1);
      return error(now && now.status === "quoted" && now.quotedAmount !== null ? p.quoteChangedError : p.quoteNotOpenError);
    }
  } catch (err) {
    console.error("[portal] quote response failed", err);
    return error(c.serverError);
  }

  const done = request;
  const locale = formLocale(formData);
  after(() =>
    Promise.all([
      notifyTeamPartnerActivity({ request: done, partner: contact, kind: accept ? "accepted" : "declined", body: reason ?? null }),
      // Accepting confirms the booking, and the partner gets the same confirmation the team's own change would send
      accept ? emailPartnerBooking({ request: done, to: { email: contact.email, name: contact.name, locale }, kind: "confirmed" }) : undefined,
    ]),
  );
  refresh();
  return { status: "ok", notice: accept ? p.quoteAccepted : p.quoteDeclined };
}

const messageSchema = z.object({
  reference: z.string().regex(REF_RE),
  kind: z.enum(["message", "change", "cancel"]),
  body: z.string().trim().min(1).max(2000),
});

/**
 * A message to the team about a booking, or a request to change or cancel it. A request is only a request: it never
 * alters the booking, the team does that. The booking must be the partner's and still open; one INSERT … SELECT checks
 * both, so a booking that closes between the page and the click cannot receive one.
 */
export async function sendBookingMessage(_prev: PortalState, formData: FormData): Promise<PortalState> {
  const { corporatePartner: c, portal: p } = await dictionaryFromForm(formData);
  const error = (message: string, field?: "message") =>
    ({ status: "error", message, fieldErrors: field ? { [field]: message } : {}, values: { kind: String(formData.get("kind") ?? "message") } }) as const;

  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: c.sessionExpired };

  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path[0] === "body" && i.code === "too_big");
    return error(tooLong ? p.messageTooLong : p.messageRequired, "message");
  }
  const { reference, kind, body } = parsed.data;

  try {
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(schema.bookingMessages)
      .where(and(eq(schema.bookingMessages.contactId, contact.id), gt(schema.bookingMessages.createdAt, minutesAgo(MESSAGE_LIMIT.minutes))));
    if (recent >= MESSAGE_LIMIT.max) return error(c.rateLimited);

    const open = sql.join(MESSAGEABLE.map((s) => sql`${s}`), sql`, `);
    const inserted = await db.execute<{ request_id: string }>(sql`
      insert into booking_messages (request_id, author_kind, contact_id, kind, body)
      select ${q.id}, 'partner', ${contact.id}::uuid, ${kind}::text, ${body}::text
      from ${q}
      where ${q.reference} = ${reference} and ${q.corporateContactId} = ${contact.id} and ${q.status}::text in (${open})
      returning request_id`);
    const row = Array.from(inserted)[0];
    if (!row) return error(p.messagesClosed);

    const [request] = await db.select().from(q).where(eq(q.id, row.request_id)).limit(1);
    after(() => notifyTeamPartnerActivity({ request, partner: contact, kind: kind === "message" ? "message" : kind, body }));
  } catch (err) {
    console.error("[portal] message failed", err);
    return error(c.serverError);
  }
  refresh();
  return { status: "ok", notice: p.messageSent };
}
