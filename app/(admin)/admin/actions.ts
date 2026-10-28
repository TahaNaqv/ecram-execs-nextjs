"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { emailEnquiryStatus, emailPartnerBooking, type EnquiryEmailKind } from "@/lib/email";
import { removeFiles } from "@/lib/storage";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";
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
  // The status the form was showing. A partner can answer a quote while the team has the page open, so a save made
  // from a stale form must not put the old status back.
  seenStatus: z.enum(REQUEST_STATUSES),
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

/**
 * Which email, if any, the person gets for a change the team made to their booking (a partner in their account, or someone who
 * asked on the website). A first contact, a quote, a confirmation, completion and cancellation each get one.
 */
function partnerEmailKind(from: RequestStatus, to: RequestStatus, fromAmount: string | null, toAmount: string | null): EnquiryEmailKind | null {
  if (from !== to) {
    if (to === "contacted") return from === "new" ? "contacted" : null; // "we have picked it up": only on the first step, not when a booking moves back
    if (to === "quoted") return toAmount !== null ? "quoted" : null; // a quote with no amount is nothing to answer
    return to === "confirmed" || to === "completed" || to === "cancelled" ? to : null;
  }
  // The same status with a different amount on a quoted booking is a new offer
  return to === "quoted" && toAmount !== null && Number(fromAmount ?? Number.NaN) !== Number(toAmount) ? "quoted" : null;
}

/** Where a request that is not in a partner's account comes from when the person asked for it themselves: the booking bar and the bespoke form. */
const ENQUIRY_SOURCES: ReadonlySet<string> = new Set(["website", "website-bespoke"]);

export async function updateRequest(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const admin = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, status, seenStatus, quotedAmount, internalNotes } = parsed.data;

  const [before] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
  if (!before) return { error: "Request not found." };
  const changedMeanwhile = { error: "This request changed while you had it open (a partner may have answered it). Reload the page to see the latest, then try again." };
  if (before.status !== seenStatus) return changedMeanwhile;

  // Keys and values, never prose — the history has to render in whichever language the admin
  // reading it has chosen, including for changes recorded years earlier.
  const changes: RequestEventChange[] = [];
  if (before.status !== status) changes.push({ kind: "status", from: before.status, to: status });
  if ((before.quotedAmount === null ? null : Number(before.quotedAmount)) !== (quotedAmount === null ? null : Number(quotedAmount))) {
    changes.push({ kind: "quote", from: before.quotedAmount, to: quotedAmount });
  }
  if ((before.internalNotes ?? null) !== internalNotes) changes.push({ kind: "notes" });
  if (changes.length === 0) return { ok: true };

  const saved = await db.transaction(async (tx) => {
    // Applies only while the status is still the one the form showed (checked again here, atomically)
    const [row] = await tx
      .update(schema.quoteRequests)
      .set({ status, quotedAmount, internalNotes, updatedAt: sql`now()` })
      .where(and(eq(schema.quoteRequests.id, id), eq(schema.quoteRequests.status, seenStatus)))
      .returning();
    if (!row) return null;
    await tx.insert(schema.requestEvents).values({ requestId: id, adminId: admin.id, event: "changes", params: { changes } });
    return row;
  });
  if (!saved) return changedMeanwhile;

  // A partner is told when their booking is picked up, quoted, confirmed, completed or cancelled: whatever the team changed
  const told = partnerEmailKind(before.status, status, before.quotedAmount, saved.quotedAmount);
  // An introduction is a request too, but it is not a booking the partner can open: no booking emails for it
  if (told && saved.corporateContactId && saved.source !== "website-corporate") {
    const [partner] = await db
      .select({ email: schema.corporateContacts.email, name: schema.corporateContacts.name, locale: schema.corporateContacts.locale })
      .from(schema.corporateContacts)
      .where(eq(schema.corporateContacts.id, saved.corporateContactId))
      .limit(1);
    if (partner) after(() => emailPartnerBooking({ request: saved, to: partner, kind: told }));
  } else if (told && !saved.corporateContactId && ENQUIRY_SOURCES.has(saved.source)) {
    // Someone who asked on the website has no account to be told in, so the email carries the news itself (QA round 3, tab 2 bug 7).
    // Bookings the team keyed in (source "admin") are not mailed: the team spoke to them, and chose at the time whether to tell them.
    after(() => emailEnquiryStatus({ request: saved, kind: told }));
  }
  revalidatePath("/admin/corporate");
  revalidatePath("/admin");
  if (saved.corporateContactId) revalidatePath(`/admin/corporate/${saved.corporateContactId}`);
  refresh();
  return { ok: true };
}

/** Permanently removes a chat with the concierge and everything said in it (e.g. a request to erase it). */
export async function deleteChat(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await db.delete(schema.conciergeConversations).where(eq(schema.conciergeConversations.id, id.data));
  console.info("[admin] chat deleted");
  redirect("/admin/chats");
}

/** Permanently removes a request and its history (e.g. a GDPR erasure request). */
export async function deleteRequest(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  // The invoice rows go with the request (cascade); the files on disk are removed here, like an application's documents
  const invoices = await db.select({ path: schema.bookingInvoices.path }).from(schema.bookingInvoices).where(eq(schema.bookingInvoices.requestId, id.data));
  const [deleted] = await db
    .delete(schema.quoteRequests)
    .where(eq(schema.quoteRequests.id, id.data))
    .returning({ reference: schema.quoteRequests.reference });
  if (deleted) {
    await removeFiles(invoices.map((i) => i.path));
    console.info(`[admin] request ${deleted.reference} deleted`);
  }
  redirect("/admin/requests");
}

/** Sets the signed-in admin's panel language (D3: admin is not locale-routed). */
export async function setAdminLocale(formData: FormData) {
  const admin = await requireAdmin();
  const parsed = z.enum(LOCALES).safeParse(formData.get("locale"));
  if (!parsed.success) return;
  await db.update(schema.adminUsers).set({ locale: parsed.data }).where(eq(schema.adminUsers.id, admin.id));
  refresh();
}
