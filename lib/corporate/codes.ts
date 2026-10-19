import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { sendVerificationCode } from "@/lib/email";
import type { CorporateContactPublic } from "./columns";
import {
  CHALLENGE_COOKIE,
  CODE_MINUTES,
  CONTACT_LIMIT,
  IP_LIMIT,
  RESEND_SECONDS,
  codeHmac,
  newCode,
} from "./otp";
import { cookieOptions } from "./session";

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** What the person typed on the sign-up form. It waits on the challenge and only takes effect when the code is entered. */
export type Pending = { name: string; position: string; consent: boolean };

export type IssueResult = "ok" | "rate" | "wait" | "fail";

/** Whether this visitor address has used up its codes for now. Checked before anything is written. */
export async function ipLimited(ipHash: string) {
  if (process.env.NODE_ENV !== "production") return false;
  const [{ fromIp }] = await db
    .select({ fromIp: count() })
    .from(schema.corporateChallenges)
    .where(and(eq(schema.corporateChallenges.ipHash, ipHash), gt(schema.corporateChallenges.createdAt, minutesAgo(IP_LIMIT.windowMinutes))));
  return fromIp >= IP_LIMIT.max;
}

/**
 * Creates a challenge for `contact`, emails the code and remembers the challenge in a cookie.
 * The email is awaited: someone is waiting for this code, so a failed send must be reported to them
 * and the challenge withdrawn, rather than leaving them with a code that never arrives.
 */
export async function issueCode(
  contact: Pick<CorporateContactPublic, "id" | "email" | "locale">,
  ipHash: string,
  pending: Pending,
  purpose: "signup" | "reset",
): Promise<IssueResult> {
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev) {
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
  }

  const id = randomUUID();
  const code = newCode();
  const expiresAt = new Date(Date.now() + CODE_MINUTES * 60_000);
  await db.insert(schema.corporateChallenges).values({
    id,
    contactId: contact.id,
    codeHmac: codeHmac(id, code),
    purpose,
    pendingName: pending.name,
    pendingPosition: pending.position,
    pendingConsent: pending.consent,
    expiresAt,
    ipHash,
  });

  let sent = false;
  try {
    sent = await sendVerificationCode({
      email: contact.email,
      name: pending.name,
      code,
      locale: contact.locale,
      minutes: CODE_MINUTES,
      purpose,
    });
  } catch (err) {
    console.error("[corporate] sendVerificationCode error:", err);
  }

  if (!sent) {
    if (isDev) {
      console.warn(`[corporate] [DEV MODE] Verification code dispatch failed, bypassing for local development. Code: ${code}`);
      sent = true;
    } else {
      // Withdrawn rather than deleted: it still counts toward the limits, so a broken mail setup can't be
      // used to create contacts without end
      await db.update(schema.corporateChallenges).set({ consumedAt: new Date() }).where(eq(schema.corporateChallenges.id, id));
      return "fail";
    }
  }
  // The cookie outlives the code, so "send a new code" still works a little after the first has expired
  (await cookies()).set(CHALLENGE_COOKIE, id, cookieOptions(new Date(Date.now() + 60 * 60_000)));

  // Opportunistic cleanup, as admin sessions do
  await db.delete(schema.corporateChallenges).where(lt(schema.corporateChallenges.expiresAt, minutesAgo(60 * 24)));
  await db.delete(schema.corporateAccess).where(lt(schema.corporateAccess.expiresAt, new Date()));
  return "ok";
}
