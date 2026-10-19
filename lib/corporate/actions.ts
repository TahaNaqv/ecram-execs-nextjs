"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { confirmToClient, notifyNewQuote } from "@/lib/email";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { withinLimit } from "@/lib/rate-limit";
import { isUniqueViolation, makeReference, visitor } from "@/lib/request-meta";
import { getCorporateContact } from "./access";
import { contactColumns } from "./columns";
import { issueCode, ipLimited, minutesAgo } from "./codes";
import { CHALLENGE_COOKIE, RESET_IP_LIMIT } from "./otp";
import type { CorporateState } from "./state";
import {
  CORPORATE_VEHICLES,
  onboardingSchema,
  requestSchema,
  resetRequestSchema,
  type OnboardingField,
  type RequestField,
} from "./validation";

/** Step one of sign-up: the person's details. Nothing about an existing contact changes until the code is entered. */
export async function requestCode(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const values = Object.fromEntries(["email", "name", "position", "marketingConsent", "locale"].map((k) => [k, String(formData.get(k) ?? "")]));
  const fail = (message: string, fieldErrors: Partial<Record<RequestField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values }) as const;

  // Honeypot: real visitors never see or fill this field
  if (String(formData.get("company_website") ?? "") !== "") return { status: "sent", email: values.email };

  const parsed = requestSchema(f, c).safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<RequestField, string>> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as RequestField] ??= issue.message;
    return fail(f.checkHighlighted, fieldErrors);
  }
  const { email, name, position, marketingConsent, locale } = parsed.data;

  try {
    const { ipHash, userAgent } = await visitor();
    const isDev = process.env.NODE_ENV !== "production";
    // Before anything is written: contact rows can't be created without limit by repeating this form
    if (!isDev && (await ipLimited(ipHash))) return fail(c.rateLimited);

    // A request is only a request. An existing contact is left exactly as it is — nobody can rewrite
    // someone else's details, or record consent on their behalf, by typing their address — and what was
    // typed waits on the challenge until the code is entered. An address that already has an account gets the same
    // code and the same screens: entering the code sets a new password for it, which only the address's owner can do.
    await db
      .insert(schema.corporateContacts)
      .values({ email, emailDomain: email.split("@")[1], name, position, locale, ipHash, userAgent })
      .onConflictDoNothing({ target: schema.corporateContacts.email });
    const [contact] = await db.select(contactColumns).from(schema.corporateContacts).where(eq(schema.corporateContacts.email, email)).limit(1);

    const result = await issueCode(contact, ipHash, { name, position, consent: marketingConsent }, "signup");
    if (result === "rate") return fail(c.rateLimited);
    if (result === "wait") return fail(c.resendWait);
    if (result === "fail") return fail(c.sendFailed);
    return { status: "sent", email };
  } catch (err) {
    console.error("[corporate] request failed", err);
    return fail(c.serverError);
  }
}

/**
 * Step one of a password reset. The answer is the same whether or not the address has an account, so the form can't
 * be used to find out who is a partner; a code is only sent when it does.
 */
export async function requestReset(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const values = Object.fromEntries(["email", "locale"].map((k) => [k, String(formData.get(k) ?? "")]));
  const fail = (message: string, fieldErrors: Partial<Record<RequestField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values }) as const;

  if (String(formData.get("company_website") ?? "") !== "") return { status: "sent", email: values.email };

  const parsed = resetRequestSchema(f).safeParse(values);
  if (!parsed.success) return fail(f.checkHighlighted, { email: parsed.error.issues[0].message });
  const { email } = parsed.data;

  try {
    const { ipHash } = await visitor();
    const isDev = process.env.NODE_ENV !== "production";
    // An unknown address writes nothing, so the database counts below never see it: this limit covers that path
    if (!isDev) {
      if (!withinLimit(`cp-reset:${ipHash}`, RESET_IP_LIMIT.max, RESET_IP_LIMIT.windowMs)) return fail(c.rateLimited);
      if (await ipLimited(ipHash)) return fail(c.rateLimited);
    }

    const [contact] = await db.select(contactColumns).from(schema.corporateContacts).where(eq(schema.corporateContacts.email, email)).limit(1);
    if (!contact) return { status: "sent", email };

    // A reset changes nothing about the person: no details, no consent. Whatever issueCode answers (too soon, too many,
    // not sent) is NOT shown: an unknown address always gets "sent", so a known one must too, or the difference would
    // tell anyone which addresses have an account. A failed send is logged by the mailer; "send a new code" is there.
    await issueCode(contact, ipHash, { name: contact.name, position: contact.position, consent: false }, "reset");
    return { status: "sent", email };
  } catch (err) {
    console.error("[corporate] reset request failed", err);
    return fail(c.serverError);
  }
}

/** Sends a fresh code to whoever the current (possibly expired) challenge belongs to, for the same purpose. */
export async function resendCode(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { corporatePartner: c } = await dictionaryFromForm(formData);
  const fail = (message: string) => ({ status: "error", message, fieldErrors: {}, values: {} }) as const;
  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { status: "locked", message: c.codeExpired };

  try {
    const [row] = await db
      .select({ contact: contactColumns, previous: schema.corporateChallenges })
      .from(schema.corporateChallenges)
      .innerJoin(schema.corporateContacts, eq(schema.corporateChallenges.contactId, schema.corporateContacts.id))
      .where(eq(schema.corporateChallenges.id, id))
      .limit(1);
    if (!row) return { status: "locked", message: c.codeExpired };

    const { ipHash } = await visitor();
    const result = await issueCode(
      row.contact,
      ipHash,
      {
        name: row.previous.pendingName ?? row.contact.name,
        position: row.previous.pendingPosition ?? row.contact.position,
        consent: row.previous.pendingConsent,
      },
      row.previous.purpose,
    );
    if (result === "rate") return fail(c.rateLimited);
    if (result === "wait") return fail(c.resendWait);
    if (result === "fail") return fail(c.sendFailed);
    return { status: "sent", email: row.contact.email, notice: c.codeSentAgain };
  } catch (err) {
    console.error("[corporate] resend failed", err);
    return fail(c.serverError);
  }
}

const RATE_LIMIT = { max: 5, windowMinutes: 15 };

export async function submitOnboarding(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const fields = [
    "company", "companyNumber", "phoneCountry", "phone", "contactMethod", "signatory", "pointOfCall",
    "vehicle", "tripTime", "duration", "notes", "locale",
  ] as const;
  const values: Record<string, string> = Object.fromEntries(fields.map((k) => [k, String(formData.get(k) ?? "")]));
  const fail = (message: string, fieldErrors: Partial<Record<OnboardingField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values }) as const;

  // Re-checked against the database, not just the cookie, on every submission
  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: c.sessionExpired };

  if (String(formData.get("company_website") ?? "") !== "") return { status: "success", reference: "EE-RECEIVED", name: contact.name };

  const parsed = onboardingSchema(f, c).safeParse({ ...values, notes: values.notes || undefined });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<OnboardingField, string>> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as OnboardingField] ??= issue.message;
    return fail(f.checkHighlighted, fieldErrors);
  }
  const input = parsed.data;

  try {
    const { ipHash, userAgent } = await visitor();
    const since = minutesAgo(RATE_LIMIT.windowMinutes);
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(schema.quoteRequests)
      .where(and(eq(schema.quoteRequests.ipHash, ipHash), gt(schema.quoteRequests.createdAt, since)));
    if (recent >= RATE_LIMIT.max) return fail(f.quoteRateLimited);

    // The booker's name and email are the verified contact's, never taken from the form
    const chosen = CORPORATE_VEHICLES.find((v) => v.key === input.vehicle)!;
    const label = (word: string) => word.replace(/_/g, " ");
    // Internal text, read by the dispatch team in the admin: always English, like the team alerts
    const itinerary = [
      "Corporate Partner introduction (KYB)",
      `Company number: ${input.companyNumber}`,
      `Signatory: ${input.signatory}`,
      `Point of call: ${input.pointOfCall}`,
      `Preferred contact method: ${label(input.contactMethod)}`,
      `Preferred vehicle: ${chosen.name}`,
      `Majority of trips: ${input.tripTime}`,
      `Average duration needed: ${input.duration.replace("_", "–")} hours`,
      `Booker position: ${contact.position}`,
    ].join("\n");

    let saved: typeof schema.quoteRequests.$inferSelect | undefined;
    for (let i = 0; i < 3 && !saved; i++) {
      try {
        [saved] = await db
          .insert(schema.quoteRequests)
          .values({
            service: "bespoke",
            source: "website-corporate",
            corporateContactId: contact.id,
            entity: input.company,
            entityKvk: input.companyNumber,
            vehicle: chosen.fleetKey,
            itinerary,
            // Where the dispatch manager follows up: the team alert and the admin page both show it
            contactPreference: input.contactMethod,
            name: contact.name,
            email: contact.email,
            phone: input.phone,
            notes: input.notes ?? null,
            locale: input.locale,
            reference: makeReference("EE"),
            ipHash,
            userAgent,
          })
          .returning();
      } catch (err) {
        if (!isUniqueViolation(err) || i === 2) throw err;
      }
    }
    const request = saved!;
    await db.insert(schema.requestEvents).values({ requestId: request.id, event: "received" });
    await db
      .update(schema.corporateContacts)
      .set({ companyName: input.company, kvkNumber: input.companyNumber })
      .where(eq(schema.corporateContacts.id, contact.id));

    after(() => Promise.all([notifyNewQuote(request), confirmToClient(request)]));
    return { status: "success", reference: request.reference, name: contact.name.split(" ")[0] };
  } catch (err) {
    console.error("[corporate] onboarding failed", err);
    return fail(c.serverError);
  }
}
