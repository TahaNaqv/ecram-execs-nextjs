"use server";

import { and, eq, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { emailPartnerBooking } from "@/lib/email";
import { VEHICLE_CHOICES } from "@/lib/fleet/vehicles";
import { isUniqueViolation, makeReference } from "@/lib/request-meta";
import { asWait, MAX_STOPS } from "@/lib/quotes/stops";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";

export type NewBookingState = { error?: string; values?: Record<string, string> };

const FIELDS = ["contactId", "service", "collection", "destination", "stops", "pickupAt", "passengers", "vehicle", "name", "email", "phone", "status", "quotedAmount", "notes", "internalNotes"] as const;

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const schemaFor = z.object({
  contactId: z.preprocess(blank, z.uuid().optional()),
  // Bespoke programmes have an itinerary rather than one journey, and were once submitted through their own form on the website
  service: z.enum(["airport_transfer", "business_travel", "hourly", "private_occasion"]),
  collection: z.string().trim().min(1, "Enter the collection point.").max(200),
  destination: z.string().trim().min(1, "Enter the destination.").max(200),
  stops: z.string().max(1200),
  pickupAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter the pick-up date and time."),
  passengers: z.preprocess(blank, z.coerce.number().int().min(1).max(50).optional()),
  vehicle: z.preprocess(blank, z.enum(VEHICLE_CHOICES).optional()),
  name: z.string().trim().max(120),
  email: z.string().trim().toLowerCase().max(200),
  phone: z.string().trim().regex(/^\+\d{1,4} ?[0-9 ()\-.]{5,20}$/, "Enter the phone number with its country code, e.g. +31 6 1234 5678."),
  status: z.enum(REQUEST_STATUSES),
  quotedAmount: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || /^\d{1,8}(\.\d{1,2})?$/.test(v), "Enter an amount like 185 or 185.50")
    .transform((v) => (v === "" ? null : v)),
  notes: z.string().trim().max(2000).transform((v) => v || null),
  internalNotes: z.string().trim().max(5000).transform((v) => v || null),
});

/** A booking entered by the team (it came by phone or email), optionally for a partner so it shows in their portal. */
export async function createBookingForPartner(_prev: NewBookingState, formData: FormData): Promise<NewBookingState> {
  const admin = await requireAdmin();
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const fail = (error: string) => ({ error, values });

  const parsed = schemaFor.safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const input = parsed.data;

  const [partner] = input.contactId
    ? await db
        .select({ id: schema.corporateContacts.id, name: schema.corporateContacts.name, email: schema.corporateContacts.email, locale: schema.corporateContacts.locale, companyName: schema.corporateContacts.companyName, kvkNumber: schema.corporateContacts.kvkNumber })
        .from(schema.corporateContacts)
        .where(and(eq(schema.corporateContacts.id, input.contactId), isNotNull(schema.corporateContacts.passwordSetAt)))
        .limit(1)
    : [];
  if (input.contactId && !partner) return fail("That partner has no account.");

  const name = input.name || partner?.name;
  const email = input.email || partner?.email;
  if (!name) return fail("Enter the contact's name.");
  if (!email || !z.email().safeParse(email).success) return fail("Enter a valid contact email.");

  // One stop per line, optionally "Place | minutes of waiting"
  const stops = input.stops
    .split("\n")
    .map((line) => {
      const [place, wait] = line.split("|");
      return { place: place.trim().slice(0, 200), wait: asWait(wait?.trim()) };
    })
    .filter((s) => s.place)
    .slice(0, MAX_STOPS);
  let created: typeof schema.quoteRequests.$inferSelect | undefined;
  for (let i = 0; i < 3 && !created; i++) {
    try {
      [created] = await db.transaction(async (tx) => {
        const rows = await tx
          .insert(schema.quoteRequests)
          .values({
            service: input.service,
            collection: input.collection,
            destination: input.destination,
            destinations: stops.length > 0 ? stops.map((s) => s.place) : null,
            destinationWaits: stops.length > 0 ? stops.map((s) => s.wait) : null,
            pickupAt: input.pickupAt,
            passengers: input.passengers,
            vehicle: input.vehicle,
            name,
            email,
            phone: input.phone,
            notes: input.notes,
            internalNotes: input.internalNotes,
            status: input.status,
            quotedAmount: input.quotedAmount,
            entity: partner?.companyName ?? null,
            entityKvk: partner?.kvkNumber ?? null,
            corporateContactId: partner?.id ?? null,
            locale: partner?.locale ?? "en",
            source: "admin",
            reference: makeReference("EE"),
          })
          .returning();
        await tx.insert(schema.requestEvents).values({ requestId: rows[0].id, adminId: admin.id, event: "received", params: { by: "team" } });
        if (partner) await tx.insert(schema.requestEvents).values({ requestId: rows[0].id, adminId: admin.id, event: "attached", params: { partner: partner.name, by: "team" } });
        return rows;
      });
    } catch (err) {
      if (!isUniqueViolation(err) || i === 2) {
        console.error("[admin] booking create failed", err);
        return fail("Could not create the booking. Please try again.");
      }
    }
  }
  const request = created!;

  // A partner is told about a booking that is already quoted or confirmed; nothing is sent for a plain new one
  const kind = request.status === "confirmed" ? "confirmed" : request.status === "quoted" && request.quotedAmount ? "quoted" : null;
  if (partner && kind) after(() => emailPartnerBooking({ request, to: partner, kind }));
  redirect(`/admin/requests/${request.id}`);
}
