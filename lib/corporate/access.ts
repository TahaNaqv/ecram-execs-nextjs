import "server-only";
import { and, desc, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { contactColumns, type CorporateContactPublic } from "./columns";
import { ACCESS_COOKIE, CHALLENGE_COOKIE, MAX_ATTEMPTS, hashToken } from "./otp";

// "Now" is the database's `now()`, not a JavaScript Date: these run while a page renders, where Next.js rejects reading
// the current time in code (it logs "unstable value new Date() while prerendering" and skips the optimisation).

/**
 * The signed-in contact for this request, or null. The cookie alone is never trusted: it is only a token whose hash
 * must match an unexpired row in `corporate_access`, and the contact must have an account (a password). Call this
 * from a Server Component inside <Suspense> (cookies are request-time data) or from a Server Action. The row never
 * includes the password hash.
 */
export const getCorporateContact = cache(async (): Promise<CorporateContactPublic | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ contact: contactColumns })
    .from(schema.corporateAccess)
    .innerJoin(schema.corporateContacts, eq(schema.corporateAccess.contactId, schema.corporateContacts.id))
    .where(
      and(
        eq(schema.corporateAccess.id, hashToken(token)),
        gt(schema.corporateAccess.expiresAt, sql`now()`),
        isNotNull(schema.corporateContacts.passwordHash),
      ),
    )
    .limit(1);
  return row?.contact ?? null;
});

/**
 * A code of this purpose that was sent and can still be entered: lets a reload land on the code step rather than the
 * start. A code sent for one purpose is not offered on the page for the other.
 */
export const getPendingChallenge = cache(async (purpose: "signup" | "reset") => {
  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ id: schema.corporateChallenges.id, email: schema.corporateContacts.email, contactId: schema.corporateContacts.id })
    .from(schema.corporateChallenges)
    .innerJoin(schema.corporateContacts, eq(schema.corporateChallenges.contactId, schema.corporateContacts.id))
    .where(
      and(
        eq(schema.corporateChallenges.id, id),
        eq(schema.corporateChallenges.purpose, purpose),
        isNull(schema.corporateChallenges.consumedAt),
        gt(schema.corporateChallenges.expiresAt, sql`now()`),
        // A challenge whose guesses are spent is dead; a reload shouldn't offer it
        lt(schema.corporateChallenges.attempts, MAX_ATTEMPTS),
      ),
    )
    .orderBy(desc(schema.corporateChallenges.createdAt))
    .limit(1);
  return row ?? null;
});

/** What a partner has already sent us, newest first (the references are the ones the team sees). */
export const listIntroductions = cache(async (contactId: string) =>
  db
    .select({
      reference: schema.quoteRequests.reference,
      company: schema.quoteRequests.entity,
      createdAt: schema.quoteRequests.createdAt,
    })
    .from(schema.quoteRequests)
    .where(eq(schema.quoteRequests.corporateContactId, contactId))
    .orderBy(desc(schema.quoteRequests.createdAt))
    .limit(20),
);
