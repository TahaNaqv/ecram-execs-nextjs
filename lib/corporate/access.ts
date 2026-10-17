import "server-only";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import type { CorporateContact } from "@/lib/db/schema";
import { ACCESS_COOKIE, CHALLENGE_COOKIE, MAX_ATTEMPTS, hashToken } from "./otp";

// "Now" is the database's `now()`, not a JavaScript Date: these run while a page renders, where Next.js rejects reading
// the current time in code (it logs "unstable value new Date() while prerendering" and skips the optimisation).

/**
 * The verified contact for this request, or null. The cookie alone is never trusted: it is only a
 * token whose hash must match an unexpired row in `corporate_access`. Call this from a Server
 * Component inside <Suspense> (cookies are request-time data) or from a Server Action.
 */
export const getCorporateContact = cache(async (): Promise<CorporateContact | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ contact: schema.corporateContacts })
    .from(schema.corporateAccess)
    .innerJoin(schema.corporateContacts, eq(schema.corporateAccess.contactId, schema.corporateContacts.id))
    .where(and(eq(schema.corporateAccess.id, hashToken(token)), gt(schema.corporateAccess.expiresAt, sql`now()`)))
    .limit(1);
  return row?.contact ?? null;
});

/** A code that was sent and can still be entered: lets a reload land on the code step rather than the start. */
export const getPendingChallenge = cache(async () => {
  const id = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ id: schema.corporateChallenges.id, email: schema.corporateContacts.email, contactId: schema.corporateContacts.id })
    .from(schema.corporateChallenges)
    .innerJoin(schema.corporateContacts, eq(schema.corporateChallenges.contactId, schema.corporateContacts.id))
    .where(
      and(
        eq(schema.corporateChallenges.id, id),
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
