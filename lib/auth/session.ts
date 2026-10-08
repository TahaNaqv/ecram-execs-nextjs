import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/lib/db";

export const SESSION_COOKIE = "ee_admin_session";
const SESSION_DAYS = 7;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(adminId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.adminSessions).values({ id: hashToken(token), adminId, expiresAt });
  // Opportunistic cleanup of expired sessions
  await db.delete(schema.adminSessions).where(lt(schema.adminSessions.expiresAt, new Date()));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

export type Admin = { id: string; name: string; email: string };

/** Returns the signed-in admin, or null. Deduplicated per request. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: schema.adminUsers.id, name: schema.adminUsers.name, email: schema.adminUsers.email })
    .from(schema.adminSessions)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.adminSessions.adminId))
    .where(and(eq(schema.adminSessions.id, hashToken(token)), gt(schema.adminSessions.expiresAt, sql`now()`)))
    .limit(1);
  return row ?? null;
});

/** Use in every admin page, Server Action and Route Handler. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
