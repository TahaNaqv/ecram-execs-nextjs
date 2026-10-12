"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";
import { LOCALES } from "@/lib/i18n/config";
import type { RequestEventChange } from "@/lib/admin/events";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const generic = { error: "Incorrect email or password.", email };
  if (!email || !password) return generic;

  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.email, email)).limit(1);
  if (!user) {
    await verifyPassword(password, DUMMY_HASH); // equalise timing
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.`, email };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await db
      .update(schema.adminUsers)
      .set(
        failed >= MAX_FAILED
          ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
          : { failedLogins: failed },
      )
      .where(eq(schema.adminUsers.id, user.id));
    return generic;
  }

  await db
    .update(schema.adminUsers)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(schema.adminUsers.id, user.id));
  await createSession(user.id);

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(REQUEST_STATUSES),
  quotedAmount: z
    .string()
    .trim()
    .transform((v) => v.replace(",", "."))
    .refine((v) => v === "" || /^\d{1,8}(\.\d{1,2})?$/.test(v), "Enter an amount like 185 or 185.50")
    .transform((v) => (v === "" ? null : v)),
  internalNotes: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => (v === "" ? null : v)),
});

export type UpdateState = { ok?: boolean; error?: string };

export async function updateRequest(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const admin = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, status, quotedAmount, internalNotes } = parsed.data;

  const [before] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
  if (!before) return { error: "Request not found." };

  // Keys and values, never prose — the history has to render in whichever language the admin
  // reading it has chosen, including for changes recorded years earlier.
  const changes: RequestEventChange[] = [];
  if (before.status !== status) changes.push({ kind: "status", from: before.status, to: status });
  if ((before.quotedAmount === null ? null : Number(before.quotedAmount)) !== (quotedAmount === null ? null : Number(quotedAmount))) {
    changes.push({ kind: "quote", from: before.quotedAmount, to: quotedAmount });
  }
  if ((before.internalNotes ?? null) !== internalNotes) changes.push({ kind: "notes" });
  if (changes.length === 0) return { ok: true };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.quoteRequests)
      .set({ status, quotedAmount, internalNotes, updatedAt: sql`now()` })
      .where(eq(schema.quoteRequests.id, id));
    await tx.insert(schema.requestEvents).values({ requestId: id, adminId: admin.id, event: "changes", params: { changes } });
  });
  refresh();
  return { ok: true };
}

/** Permanently removes a request and its history (e.g. a GDPR erasure request). */
export async function deleteRequest(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const [deleted] = await db
    .delete(schema.quoteRequests)
    .where(eq(schema.quoteRequests.id, id.data))
    .returning({ reference: schema.quoteRequests.reference });
  if (deleted) console.info(`[admin] request ${deleted.reference} deleted`);
  redirect("/admin");
}

/** Sets the signed-in admin's panel language (D3: admin is not locale-routed). */
export async function setAdminLocale(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.enum(LOCALES).safeParse(formData.get("locale"));
  if (!parsed.success) return;
  await db.update(schema.adminUsers).set({ locale: parsed.data }).where(eq(schema.adminUsers.id, admin.id));
  refresh();
}
