import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { ACCESS_COOKIE, SESSION_DAYS, hashToken, newToken } from "./otp";

export const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

/**
 * Signs the contact in: a new random token each time (a token that existed before sign-in is never reused), stored
 * only as its hash. `revokeOthers` also ends every other sign-in of this contact, which a password change must do.
 * Call from a Server Action.
 */
export async function startSession(contactId: string, { revokeOthers = false }: { revokeOthers?: boolean } = {}) {
  const store = await cookies();
  const previous = store.get(ACCESS_COOKIE)?.value;
  if (previous) await db.delete(schema.corporateAccess).where(eq(schema.corporateAccess.id, hashToken(previous)));
  if (revokeOthers) await db.delete(schema.corporateAccess).where(eq(schema.corporateAccess.contactId, contactId));

  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.corporateAccess).values({ id: hashToken(token), contactId, expiresAt });
  store.set(ACCESS_COOKIE, token, cookieOptions(expiresAt));
}

/** Signs out this browser. Call from a Server Action. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (token) await db.delete(schema.corporateAccess).where(eq(schema.corporateAccess.id, hashToken(token)));
  store.delete(ACCESS_COOKIE);
}
