"use server";

import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { CorporateContact } from "@/lib/db/schema";
import { confirmToClient, notifyNewQuote, sendVerificationCode } from "@/lib/email";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { isUniqueViolation, makeReference, visitor } from "@/lib/request-meta";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { getCorporateContact } from "./access";
import {
  ACCESS_COOKIE,
  ACCESS_HOURS,
  CHALLENGE_COOKIE,
  CODE_MINUTES,
  CONSENT_TEXT_VERSION,
  CONTACT_LIMIT,
  IP_LIMIT,
  MAX_ATTEMPTS,
  RESEND_SECONDS,
  codeHmac,
  codeMatches,
  hashToken,
  newCode,
  newToken,
} from "./otp";
import { codeSchema, onboardingSchema, requestSchema, type OnboardingField, type RequestField } from "./validation";

export type CorporateState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Partial<Record<RequestField | OnboardingField | "code", string>>; values: Record<string, string> }
  | { status: "sent"; email: string; notice?: string }
  | { status: "verified"; name: string; email: string }
  // The verified session ended while the person was filling in the form: back to the start
  | { status: "locked"; message: string }
  | { status: "success"; reference: string; name: string };

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

type IssueResult = "ok" | "rate" | "wait" | "fail";

/**
 * Creates a challenge for `contact`, emails the code and remembers the challenge in a cookie.
 * The email is awaited: someone is waiting for this code, so a failed send must be reported to them
 * and the challenge withdrawn, rather than leaving them with a code that never arrives.
 */
type Pending = { name: string; position: string; consent: boolean };

/** Whether this visitor address has used up its codes for now. Checked before anything is written. */
async function ipLimited(ipHash: string) {
  const [{ fromIp }] = await db
    .select({ fromIp: count() })
    .from(schema.corporateChallenges)
    .where(and(eq(schema.corporateChallenges.ipHash, ipHash), gt(schema.corporateChallenges.createdAt, minutesAgo(IP_LIMIT.windowMinutes))));
  return fromIp >= IP_LIMIT.max;
}

async function issueCode(
  contact: Pick<CorporateContact, "id" | "email" | "name" | "locale">,
  ipHash: string,
  pending: Pending,
): Promise<IssueResult> {
  if (await ipLimited(ipHash)) return "rate";

  const [{ forContact }] = await db
    .select({ forContact: count() })
    .from(schema.corporateChallenges)
    .where(and(eq(schema.corporateChallenges.contactId, contact.id), gt(schema.corporateChallenges.createdAt, minutesAgo(CONTACT_LIMIT.windowMinutes))));
  if (forContact >= CONTACT_LIMIT.max) return "rate";

  const [latest] = await db
    .select({ createdAt: schema.corporateChallenges.createdAt })
    .from(schema.corporateChallenges)
    .where(eq(schema.corporateChallenges.contactId, contact.id))
    .orderBy(desc(schema.corporateChallenges.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_SECONDS * 1000) return "wait";

  const id = randomUUID();
  const code = newCode();
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000);
  await db.insert(schema.corporateChallenges).values({
    id,
    contactId: contact.id,
    codeHmac: codeHmac(id, code),
    pendingName: pending.name,
    pendingPosition: pending.position,
    pendingConsent: pending.consent,
    expiresAt,
    ipHash,
  });

  const sent = await sendVerificationCode({ email: contact.email, name: pending.name, code, locale: contact.locale, minutes: CODE_MINUTES });
  if (!sent) {
    // Withdrawn rather than deleted: it still counts toward the limits, so a broken mail setup can't be
    // used to create contacts without end
    await db.update(schema.corporateChallenges).set({ consumedAt: new Date() }).where(eq(schema.corporateChallenges.id, id));
    return "fail";
  }
  // The cookie outlives the code, so "send a new code" still works a little after the first has expired
  (await cookies()).set(CHALLENGE_COOKIE, id, cookieOptions(new Date(Date.now() + 60 * 60_000)));

  // Opportunistic cleanup, as admin sessions do
  await db.delete(schema.corporateChallenges).where(lt(schema.corporateChallenges.expiresAt, minutesAgo(60 * 24)));
  await db.delete(schema.corporateAccess).where(lt(schema.corporateAccess.expiresAt, new Date()));
  return "ok";
}

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
    // Before anything is written: contact rows can't be created without limit by repeating this form
    if (await ipLimited(ipHash)) return fail(c.rateLimited);

    // A request is only a request. An existing contact is left exactly as it is — nobody can rewrite
    // someone else's details, or record consent on their behalf, by typing their address — and what was
    // typed waits on the challenge until the code is entered.
    await db
      .insert(schema.corporateContacts)
      .values({ email, emailDomain: email.split("@")[1], name, position, locale, ipHash, userAgent })
      .onConflictDoNothing({ target: schema.corporateContacts.email });
    const [contact] = await db.select().from(schema.corporateContacts).where(eq(schema.corporateContacts.email, email)).limit(1);

    const result = await issueCode(contact, ipHash, { name, position, consent: marketingConsent });
    if (result === "rate") return fail(c.rateLimited);
    if (result === "wait") return fail(c.resendWait);
    if (result === "fail") return fail(c.sendFailed);
    return { status: "sent", email };
  } catch (err) {
    console.error("[corporate] request failed", err);
    return fail(c.serverError);
  }
}

/** Sends a fresh code to whoever the current (possibly expired) challenge belongs to. */
export async function resendCode(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { corporatePartner: c } = await dictionaryFromForm(formData);
  const fail = (message: string) => ({ status: "error", message, fieldErrors: {}, values: {} }) as const;
  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { status: "locked", message: c.codeExpired };

  try {
    const [row] = await db
      .select({ contact: schema.corporateContacts, previous: schema.corporateChallenges })
      .from(schema.corporateChallenges)
      .innerJoin(schema.corporateContacts, eq(schema.corporateChallenges.contactId, schema.corporateContacts.id))
      .where(eq(schema.corporateChallenges.id, id))
      .limit(1);
    if (!row) return { status: "locked", message: c.codeExpired };

    const { ipHash } = await visitor();
    const result = await issueCode(row.contact, ipHash, {
      name: row.previous.pendingName ?? row.contact.name,
      position: row.previous.pendingPosition ?? row.contact.position,
      consent: row.previous.pendingConsent,
    });
    if (result === "rate") return fail(c.rateLimited);
    if (result === "wait") return fail(c.resendWait);
    if (result === "fail") return fail(c.sendFailed);
    return { status: "sent", email: row.contact.email, notice: c.codeSentAgain };
  } catch (err) {
    console.error("[corporate] resend failed", err);
    return fail(c.serverError);
  }
}

export async function verifyCode(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { corporatePartner: c } = await dictionaryFromForm(formData);
  const values = { code: String(formData.get("code") ?? "") };
  const fail = (message: string, field = true) =>
    ({ status: "error", message, fieldErrors: field ? { code: message } : {}, values }) as const;

  const parsed = codeSchema(c).safeParse(values);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const store = await cookies();
  const id = store.get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { status: "locked", message: c.codeExpired };

  try {
    // Count the attempt first and atomically, so parallel guesses can't exceed the limit
    const [challenge] = await db
      .update(schema.corporateChallenges)
      .set({ attempts: sql`${schema.corporateChallenges.attempts} + 1` })
      .where(
        and(
          eq(schema.corporateChallenges.id, id),
          sql`${schema.corporateChallenges.consumedAt} IS NULL`,
          gt(schema.corporateChallenges.expiresAt, new Date()),
          sql`${schema.corporateChallenges.attempts} < ${MAX_ATTEMPTS}`,
        ),
      )
      .returning();
    if (!challenge) {
      // Either it has expired or been used, or the attempts are spent; tell those two apart for the visitor
      const [row] = await db.select().from(schema.corporateChallenges).where(eq(schema.corporateChallenges.id, id)).limit(1);
      if (row && row.attempts >= MAX_ATTEMPTS) return { status: "locked", message: c.tooManyAttempts };
      return { status: "locked", message: c.codeExpired };
    }

    if (!codeMatches(challenge.id, parsed.data.code, challenge.codeHmac)) {
      // The last allowed guess was wrong: say so now, rather than "0 attempts left" and a refusal next time
      if (challenge.attempts >= MAX_ATTEMPTS) return { status: "locked", message: c.tooManyAttempts };
      return fail(interpolate(c.codeInvalid, { remaining: MAX_ATTEMPTS - challenge.attempts }));
    }

    // Single use: only the request that flips `consumed_at` gets in
    const [used] = await db
      .update(schema.corporateChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(schema.corporateChallenges.id, id), sql`${schema.corporateChallenges.consumedAt} IS NULL`))
      .returning({ contactId: schema.corporateChallenges.contactId });
    if (!used) return { status: "locked", message: c.codeExpired };

    const [contact] = await db
      .update(schema.corporateContacts)
      .set({
        verifiedAt: sql`coalesce(${schema.corporateContacts.verifiedAt}, now())`,
        lastAccessAt: new Date(),
        // Only now, with the address proven, does what was typed become the contact's details
        name: challenge.pendingName ?? sql`${schema.corporateContacts.name}`,
        position: challenge.pendingPosition ?? sql`${schema.corporateContacts.position}`,
        updatedAt: new Date(),
        // Consent is given by ticking the box, and only ever recorded for a verified address
        ...(challenge.pendingConsent
          ? { marketingConsent: true, consentTextVersion: CONSENT_TEXT_VERSION, consentedAt: new Date() }
          : {}),
      })
      .where(eq(schema.corporateContacts.id, used.contactId))
      .returning();

    const token = newToken();
    const expiresAt = new Date(Date.now() + ACCESS_HOURS * 60 * 60 * 1000);
    await db.insert(schema.corporateAccess).values({ id: hashToken(token), contactId: contact.id, expiresAt });
    store.set(ACCESS_COOKIE, token, cookieOptions(expiresAt));
    store.delete(CHALLENGE_COOKIE);
    return { status: "verified", name: contact.name, email: contact.email };
  } catch (err) {
    console.error("[corporate] verify failed", err);
    return fail(c.serverError, false);
  }
}

const RATE_LIMIT = { max: 5, windowMinutes: 15 };

export async function submitOnboarding(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const fields = ["company", "kvk", "billingName", "billingEmail", "phone", "volume", "routes", "invoicing", "notes", "locale"] as const;
  const values: Record<string, string> = Object.fromEntries(fields.map((k) => [k, String(formData.get(k) ?? "")]));
  values.vehicles = formData.getAll("vehicles").map(String).join(",");
  const fail = (message: string, fieldErrors: Partial<Record<OnboardingField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values }) as const;

  // Re-checked against the database, not just the cookie, on every submission
  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: c.sessionExpired };

  if (String(formData.get("company_website") ?? "") !== "") return { status: "success", reference: "EE-RECEIVED", name: contact.name };

  const parsed = onboardingSchema(f, c).safeParse({
    ...values,
    kvk: values.kvk || undefined,
    routes: values.routes || undefined,
    notes: values.notes || undefined,
    vehicles: formData.getAll("vehicles").map(String),
  });
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

    // Internal text, read by the team in the admin: always English, like the team alerts
    const chosen = input.vehicles.map((key) => vehicleByKey(key)?.name ?? key);
    const itinerary = [
      "Corporate account request",
      `Expected monthly journeys: ${input.volume.replace("_plus", "+").replace("_", "–")}`,
      input.routes && `Typical routes / airports: ${input.routes}`,
      chosen.length > 0 && `Preferred vehicles: ${chosen.join(", ")}`,
      `Invoicing: ${input.invoicing.replace(/_/g, " ")}`,
      `Billing contact: ${input.billingName} <${input.billingEmail}>`,
      `Position: ${contact.position}`,
    ]
      .filter(Boolean)
      .join("\n");

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
            entityKvk: input.kvk ?? null,
            vehicle: input.vehicles.length === 1 ? input.vehicles[0] : null,
            itinerary,
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
      .set({ companyName: input.company, kvkNumber: input.kvk ?? null })
      .where(eq(schema.corporateContacts.id, contact.id));

    after(() => Promise.all([notifyNewQuote(request), confirmToClient(request)]));
    return { status: "success", reference: request.reference, name: contact.name.split(" ")[0] };
  } catch (err) {
    console.error("[corporate] onboarding failed", err);
    return fail(c.serverError);
  }
}
