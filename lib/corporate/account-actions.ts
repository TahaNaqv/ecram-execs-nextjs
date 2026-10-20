"use server";

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { db, schema } from "@/lib/db";
import { sendPasswordChanged } from "@/lib/email";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";
import { safeNext } from "./portal";
import { contactColumns } from "./columns";
import {
  CHALLENGE_COOKIE,
  CODE_MINUTES,
  CONSENT_TEXT_VERSION,
  LOGIN_IP_LIMIT,
  LOGIN_LOCK,
  MAX_ATTEMPTS,
  VERIFIED_COOKIE,
  codeMatches,
  signVerified,
  verifiedValid,
} from "./otp";
import { endSession, startSession } from "./session";
import type { CorporateState } from "./state";
import { PASSWORD_MAX, codeSchema, completeSchema, normalizePassword, type CodeField, type CompleteField } from "./validation";

const formLocale = (formData: FormData): Locale => {
  const value = String(formData.get("locale") ?? "");
  return (LOCALES as readonly string[]).includes(value) ? (value as Locale) : "en";
};

/**
 * The first of the two last steps of sign-up and of a password reset: the emailed code, on its own. A right code is what
 * proves the address. It does not sign anyone in or store anything; it only leaves a signed cookie saying this browser
 * proved this challenge's code, which is what lets the password be chosen next (see completeCode).
 */
export async function verifyCode(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const fail = (message: string, fieldErrors: Partial<Record<CodeField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values: {} }) as const;

  const parsed = codeSchema(c).safeParse({ code: String(formData.get("code") ?? ""), locale: formLocale(formData) });
  if (!parsed.success) return fail(f.checkHighlighted, { code: parsed.error.issues[0]?.message ?? c.codeInvalidFormat });

  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { status: "locked", message: c.codeExpired };

  try {
    // Count the attempt first and atomically, so parallel guesses can't exceed the limit
    const [challenge] = await db
      .update(schema.corporateChallenges)
      .set({ attempts: sql`${schema.corporateChallenges.attempts} + 1` })
      .where(
        and(
          eq(schema.corporateChallenges.id, id),
          isNull(schema.corporateChallenges.consumedAt),
          gt(schema.corporateChallenges.expiresAt, sql`now()`),
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
      const message = interpolate(c.codeInvalid, { remaining: MAX_ATTEMPTS - challenge.attempts });
      return fail(message, { code: message });
    }

    // Good for as long as the code itself, and no longer than a code's lifetime from now
    const until = Math.min(challenge.expiresAt.getTime(), Date.now() + CODE_MINUTES * 60_000);
    (await cookies()).set(VERIFIED_COOKIE, signVerified(challenge.id, until), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(until),
    });
  } catch (err) {
    console.error("[corporate] verify failed", err);
    return fail(c.serverError);
  }
  return { status: "verified" };
}

/**
 * The last step of sign-up and of a password reset: the chosen password. It is only accepted for a challenge whose code
 * this browser has proved (verifyCode), and it is only stored — and the person only signed in — then, together with the
 * challenge being used up. Nothing in the returned state carries a password.
 */
export async function completeCode(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { forms: f, corporatePartner: c } = await dictionaryFromForm(formData);
  const locale = formLocale(formData);
  const fail = (message: string, fieldErrors: Partial<Record<CompleteField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values: {} }) as const;

  const parsed = completeSchema(c).safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
    locale,
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CompleteField, string>> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as CompleteField] ??= issue.message;
    return fail(f.checkHighlighted, fieldErrors);
  }
  const { password } = parsed.data;

  const jar = await cookies();
  const id = jar.get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { status: "locked", message: c.codeExpired };
  // No proof of the code, or proof for another challenge: back to the start
  if (!verifiedValid(id, jar.get(VERIFIED_COOKIE)?.value)) return { status: "locked", message: c.codeExpired };

  try {
    // Read first, change nothing: whose code this is, and whether a password is about to be replaced
    const [before] = await db
      .select({ email: schema.corporateContacts.email, hadPassword: sql<boolean>`(${schema.corporateContacts.passwordHash} is not null)` })
      .from(schema.corporateChallenges)
      .innerJoin(schema.corporateContacts, eq(schema.corporateChallenges.contactId, schema.corporateContacts.id))
      .where(eq(schema.corporateChallenges.id, id))
      .limit(1);
    if (!before) return { status: "locked", message: c.codeExpired };
    if (password.toLowerCase() === before.email) return fail(f.checkHighlighted, { password: c.passwordSameAsEmail });

    // Still usable: not used up, not expired (the code was right a moment ago, but may not have been used since)
    const [challenge] = await db
      .select()
      .from(schema.corporateChallenges)
      .where(and(eq(schema.corporateChallenges.id, id), isNull(schema.corporateChallenges.consumedAt), gt(schema.corporateChallenges.expiresAt, sql`now()`)))
      .limit(1);
    if (!challenge) return { status: "locked", message: c.codeExpired };

    const passwordHash = await hashPassword(password);

    // Single use, and the password lands together with it: either both happen or neither does
    const contact = await db.transaction(async (tx) => {
      const [used] = await tx
        .update(schema.corporateChallenges)
        .set({ consumedAt: new Date() })
        .where(and(eq(schema.corporateChallenges.id, id), isNull(schema.corporateChallenges.consumedAt)))
        .returning({ contactId: schema.corporateChallenges.contactId });
      if (!used) return null;

      // What was typed on the sign-up form only now takes effect, with the address proven; a reset changes none of it
      const signUp = challenge.purpose === "signup";
      const [row] = await tx
        .update(schema.corporateContacts)
        .set({
          passwordHash,
          passwordSetAt: new Date(),
          failedLogins: 0,
          lockedUntil: null,
          verifiedAt: sql`coalesce(${schema.corporateContacts.verifiedAt}, now())`,
          lastLoginAt: new Date(),
          lastAccessAt: new Date(),
          updatedAt: new Date(),
          ...(signUp
            ? {
                name: challenge.pendingName ?? sql`${schema.corporateContacts.name}`,
                position: challenge.pendingPosition ?? sql`${schema.corporateContacts.position}`,
                // Consent is given by ticking the box, and only ever recorded for a verified address
                ...(challenge.pendingConsent
                  ? { marketingConsent: true, consentTextVersion: CONSENT_TEXT_VERSION, consentedAt: new Date() }
                  : {}),
              }
            : {}),
        })
        .where(eq(schema.corporateContacts.id, used.contactId))
        .returning(contactColumns);

      // The first time this address gets an account, requests it was used for earlier become theirs: the code just
      // proved the address, so they are the person those requests were made by. Only now, never when a form is submitted
      // (anyone could type a partner's address there), and never again after this first time.
      if (row && !before.hadPassword) {
        const linked = await tx
          .update(schema.quoteRequests)
          .set({ corporateContactId: row.id })
          .where(and(isNull(schema.quoteRequests.corporateContactId), sql`lower(${schema.quoteRequests.email}) = ${row.email}`))
          .returning({ id: schema.quoteRequests.id });
        if (linked.length > 0) {
          await tx.insert(schema.requestEvents).values(linked.map((l) => ({ requestId: l.id, event: "attached", params: { partner: row.name, by: "signup" as const } })));
        }
      }
      return row;
    });
    if (!contact) return { status: "locked", message: c.codeExpired };

    // A password change ends every other sign-in of this account, and the browser gets a brand-new session
    await startSession(contact.id, { revokeOthers: true });
    jar.delete(CHALLENGE_COOKIE);
    jar.delete(VERIFIED_COOKIE);
    // Whoever owns the address is told when a password that existed is replaced
    if (before.hadPassword) after(() => sendPasswordChanged({ email: contact.email, name: contact.name, locale }));
  } catch (err) {
    console.error("[corporate] complete failed", err);
    return fail(c.serverError);
  }
  // Outside the try: redirect() works by throwing
  redirect(localizedPath("/corporate-partner/account", locale));
}

/**
 * Signs in with email and password. Every way of not getting in — unknown address, no password yet, wrong password,
 * a paused account — gives the same answer in the same time, so the form says nothing about who has an account.
 */
export async function login(_prev: CorporateState, formData: FormData): Promise<CorporateState> {
  const { corporatePartner: c } = await dictionaryFromForm(formData);
  const locale = formLocale(formData);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = normalizePassword(String(formData.get("password") ?? ""));
  // Only the address is sent back to the form, never the password
  const values = { email };
  const refuse = (message: string) => ({ status: "error", message, fieldErrors: {}, values }) as const;
  const generic = () => refuse(interpolate(c.loginFailed, { max: LOGIN_LOCK.max, minutes: LOGIN_LOCK.minutes }));

  if (String(formData.get("company_website") ?? "") !== "") return generic();
  // Cheap refusals that hash nothing and say nothing about any account
  if (!email || !password || email.length > 200 || password.length > PASSWORD_MAX) return generic();

  try {
    const { ipHash } = await visitor();
    const isDev = process.env.NODE_ENV !== "production";
    // Counted before any hashing: hashing is the expensive part, and this form is linked from the home page
    if (!isDev && !withinLimit(`cp-login:${ipHash}`, LOGIN_IP_LIMIT.max, LOGIN_IP_LIMIT.windowMs)) return refuse(c.rateLimited);

    const t = schema.corporateContacts;
    const [contact] = await db
      .select({ id: t.id, passwordHash: t.passwordHash, locked: sql<boolean>`coalesce(${t.lockedUntil} > now(), false)` })
      .from(t)
      .where(eq(t.email, email))
      .limit(1);

    if (!contact?.passwordHash || contact.locked) {
      if (isDev && contact?.locked) {
        console.warn(`[corporate] [DEV MODE] Account ${email} is currently locked due to failed attempts.`);
      }
      await verifyPassword(password, DUMMY_HASH); // the same work as a real check
      return generic();
    }
    if (!(await verifyPassword(password, contact.passwordHash))) {
      // One atomic statement, so parallel guesses can't all be counted as the first. The pause is a number the visitor
      // is told about in advance and never confirmed afterwards, and a password reset lifts it.
      const next = sql`${t.failedLogins} + 1 >= ${sql.raw(String(LOGIN_LOCK.max))}`;
      await db
        .update(t)
        .set({
          failedLogins: sql`case when ${next} then 0 else ${t.failedLogins} + 1 end`,
          lockedUntil: sql`case when ${next} then now() + interval '${sql.raw(String(LOGIN_LOCK.minutes))} minutes' else ${t.lockedUntil} end`,
        })
        .where(and(eq(t.id, contact.id), sql`(${t.lockedUntil} is null or ${t.lockedUntil} <= now())`));
      return generic();
    }

    await db.update(t).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(), lastAccessAt: new Date() }).where(eq(t.id, contact.id));
    await startSession(contact.id);
  } catch (err) {
    console.error("[corporate] login failed", err);
    return refuse(c.serverError);
  }
  // Back to the page the visitor was sent from, if it is one of the portal's
  redirect(safeNext(String(formData.get("next") ?? ""), locale) ?? localizedPath("/corporate-partner/account", locale));
}

/** Signs this browser out and returns to the Corporate Partner start page. */
export async function logout(formData: FormData) {
  const locale = formLocale(formData);
  await endSession();
  redirect(localizedPath("/corporate-partner", locale));
}
