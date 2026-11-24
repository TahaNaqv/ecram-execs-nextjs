"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { ACCOUNT_AREAS, mayCreateAccounts, readTeamAccount } from "@/lib/admin/access";
import { createStaff } from "@/lib/admin/staff";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroySession, requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export type AccountState = { ok?: boolean; error?: "wrong" | "taken" | "short" | "failed" };
export type CreateAccountState = { ok?: boolean; error?: "taken" | "short" | "denied" | "failed" };
export type SetPasswordState = { ok?: boolean; error?: "short" | "denied" | "failed" };

const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sets a team password without email. The person who sets it passes the password on. */
export async function setTeamPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const admin = await requireAdmin();
  if (!mayCreateAccounts(admin.role, admin.permissions)) return { error: "denied" };
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("temporaryPassword") ?? "");
  if (!ACCOUNT_ID.test(id)) return { error: "failed" };
  if (password.length < 12) return { error: "short" };
  const [user] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.id, id)).limit(1);
  if (!user) return { error: "failed" };
  await db
    .update(schema.adminUsers)
    .set({ passwordHash: await hashPassword(password), failedLogins: 0, lockedUntil: null })
    .where(eq(schema.adminUsers.id, id));
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, id));
  if (id === admin.id) await destroySession();
  refresh();
  return { ok: true };
}

export async function saveAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (name.length < 2 || !email.includes("@")) return { error: "failed" };
  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, admin.id)).limit(1);
  if (!user) return { error: "failed" };
  const sensitive = email !== user.email || next.length > 0;
  if (sensitive && !(await verifyPassword(current, user.passwordHash))) return { error: "wrong" };
  if (next && next.length < 12) return { error: "short" };
  if (email !== user.email) {
    const [taken] = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.email, email)).limit(1);
    if (taken) return { error: "taken" };
  }
  await db
    .update(schema.adminUsers)
    .set({ name, email, ...(next ? { passwordHash: await hashPassword(next) } : {}) })
    .where(eq(schema.adminUsers.id, admin.id));
  if (next) {
    await destroySession();
  }
  refresh();
  return { ok: true };
}

/** Adds a team sign-in. No email is sent; the person who creates the account passes on the password. */
export async function createTeamAccount(_prev: CreateAccountState, formData: FormData): Promise<CreateAccountState> {
  const admin = await requireAdmin();
  if (!mayCreateAccounts(admin.role, admin.permissions)) return { error: "denied" };
  const read = readTeamAccount({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("temporaryPassword") ?? ""),
    role: String(formData.get("role") ?? "staff"),
    permissions: ACCOUNT_AREAS.filter((area) => formData.get(`perm-${area}`) === "on"),
  });
  if (!read.ok) return { error: read.error };
  const result = await createStaff(read);
  refresh();
  return result.status === "taken" ? { error: "taken" } : { ok: true };
}
