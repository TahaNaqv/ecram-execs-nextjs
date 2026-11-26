"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { ACCOUNT_AREAS, isStaffRole, mayCreateAccounts, permissionsFor, readTeamAccount } from "@/lib/admin/access";
import { createStaff, issuePasswordReset } from "@/lib/admin/staff";
import { emailAdminWelcome } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { newTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { clearPendingTotp, readPendingTotp, savePendingTotp } from "@/lib/auth/totp-pending";
import { destroySession, requireAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";

/** How long a new member's "choose your password" link works */
const WELCOME_LINK_HOURS = 72;

export type AccountState = { ok?: boolean; error?: "wrong" | "taken" | "short" | "failed" };
export type CreateAccountState = { ok?: boolean; error?: "taken" | "short" | "denied" | "failed" };
export type SetPasswordState = { ok?: boolean; error?: "short" | "denied" | "failed" };
export type UpdateAccessState = { ok?: boolean; error?: "denied" | "failed" | "last" };
export type RemoveAccountState = { ok?: boolean; error?: "denied" | "failed" | "last" | "self" };

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

/** Changes the access level and the areas a team account can open. */
export async function updateTeamAccess(_prev: UpdateAccessState, formData: FormData): Promise<UpdateAccessState> {
  const admin = await requireAdmin();
  if (!mayCreateAccounts(admin.role, admin.permissions)) return { error: "denied" };
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!ACCOUNT_ID.test(id) || !isStaffRole(role)) return { error: "failed" };
  const [user] = await db.select({ id: schema.adminUsers.id, role: schema.adminUsers.role }).from(schema.adminUsers).where(eq(schema.adminUsers.id, id)).limit(1);
  if (!user) return { error: "failed" };
  if (user.role === "owner" && role !== "owner") {
    const owners = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.role, "owner"));
    if (owners.length < 2) return { error: "last" };
  }
  const permissions = role === "owner" ? permissionsFor("owner", []) : ACCOUNT_AREAS.filter((area) => formData.get(`perm-${area}`) === "on");
  await db.update(schema.adminUsers).set({ role, permissions }).where(eq(schema.adminUsers.id, id));
  refresh();
  return { ok: true };
}

/** Removes a team sign-in. The signed-in account and the last owner stay. */
export async function removeTeamAccount(_prev: RemoveAccountState, formData: FormData): Promise<RemoveAccountState> {
  const admin = await requireAdmin();
  if (!mayCreateAccounts(admin.role, admin.permissions)) return { error: "denied" };
  const id = String(formData.get("id") ?? "");
  if (!ACCOUNT_ID.test(id)) return { error: "failed" };
  if (id === admin.id) return { error: "self" };
  const [user] = await db.select({ id: schema.adminUsers.id, role: schema.adminUsers.role }).from(schema.adminUsers).where(eq(schema.adminUsers.id, id)).limit(1);
  if (!user) return { error: "failed" };
  if (user.role === "owner") {
    const owners = await db.select({ id: schema.adminUsers.id }).from(schema.adminUsers).where(eq(schema.adminUsers.role, "owner"));
    if (owners.length < 2) return { error: "last" };
  }
  await db.delete(schema.adminUsers).where(eq(schema.adminUsers.id, id));
  refresh();
  return { ok: true };
}

/**
 * Adds a team sign-in and emails the new member where to sign in, with a link to choose their own password. The temporary
 * password is never emailed: the person who creates the account passes it on, for when the link has expired.
 */
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
  if (result.status === "taken") return { error: "taken" };
  const origin = process.env.SITE_URL ?? "";
  const issued = await issuePasswordReset(read.email, WELCOME_LINK_HOURS);
  if (issued) {
    after(() =>
      emailAdminWelcome(issued, {
        by: admin.name,
        role: read.role,
        loginUrl: `${origin}/admin/login`,
        setPasswordUrl: `${origin}/admin/reset?token=${encodeURIComponent(issued.token)}`,
        hours: WELCOME_LINK_HOURS,
      }).catch((error) => console.error("[staff] welcome email failed", error)),
    );
  }
  return { ok: true };
}

export async function beginTotp() {
  const admin = await requireAdmin();
  const secret = newTotpSecret();
  await db.update(schema.adminUsers).set({ totpSecret: secret, totpEnabled: false }).where(eq(schema.adminUsers.id, admin.id));
  await savePendingTotp(secret);
  redirect("/admin/account");
}

export async function confirmTotp(formData: FormData) {
  const admin = await requireAdmin();
  const code = String(formData.get("code") ?? "");
  const fromSession = await readPendingTotp();
  const [user] = await db
    .select({ secret: schema.adminUsers.totpSecret, enabled: schema.adminUsers.totpEnabled })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.id, admin.id))
    .limit(1);
  const pending = user && !user.enabled ? fromSession ?? user.secret : null;
  if (!pending || !verifyTotp(pending, code)) {
    return { ok: false as const, error: "That code did not match. Wait for the next code and try again." };
  }
  await db.update(schema.adminUsers).set({ totpSecret: pending, totpEnabled: true }).where(eq(schema.adminUsers.id, admin.id));
  await clearPendingTotp();
  redirect("/admin/account?totp=enabled");
}

/** Turns the authenticator off and ends every session for this account, so a locked-out owner can sign in with the password. */
export async function disableTotp() {
  const admin = await requireAdmin();
  if (admin.role !== "owner") redirect("/admin/account?totp=denied");
  const cleared = await clearTotp(admin.id);
  if (!cleared) redirect("/admin/account?totp=missing");
  await clearPendingTotp();
  await destroySession();
  redirect("/admin/login?totp=cleared");
}

/** An owner clears another account's authenticator and its sessions. The password is unchanged. */
export async function resetTotpFor(formData: FormData) {
  const admin = await requireAdmin();
  if (admin.role !== "owner") redirect("/admin/account?totp=denied");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) redirect("/admin/account?totp=missing");
  const [user] = await db
    .select({ id: schema.adminUsers.id })
    .from(schema.adminUsers)
    .where(sql`lower(${schema.adminUsers.email}) = ${email}`)
    .limit(1);
  if (!user) redirect("/admin/account?totp=missing");
  const cleared = await clearTotp(user.id);
  if (!cleared) redirect("/admin/account?totp=failed");
  if (user.id === admin.id) {
    await clearPendingTotp();
    await destroySession();
    redirect("/admin/login?totp=cleared");
  }
  refresh();
  redirect("/admin/account?totp=cleared");
}

async function clearTotp(adminId: string) {
  const cleared = await db
    .update(schema.adminUsers)
    .set({ totpSecret: null, totpEnabled: false })
    .where(eq(schema.adminUsers.id, adminId))
    .returning({ id: schema.adminUsers.id });
  if (cleared.length === 0) return false;
  await db.delete(schema.adminSessions).where(eq(schema.adminSessions.adminId, adminId));
  return true;
}
