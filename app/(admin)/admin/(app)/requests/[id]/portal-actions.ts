"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { emailPartnerBooking } from "@/lib/email";
import { attachRestriction } from "@/lib/admin/portal";
import { isUniqueViolation } from "@/lib/request-meta";
import { listFiles, removeFiles, signedUploadUrl, storageConfigured } from "@/lib/storage";

const id = z.uuid();
const q = schema.quoteRequests;

/** Links a request to a partner's account, so it appears in their portal. Only a partner who has an account can be chosen. */
export async function attachPartner(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ requestId: id, contactId: id }).safeParse(Object.fromEntries(formData));
  if (!input.success) return;
  const [partner] = await db
    .select({ id: schema.corporateContacts.id, name: schema.corporateContacts.name })
    .from(schema.corporateContacts)
    .where(and(eq(schema.corporateContacts.id, input.data.contactId), isNotNull(schema.corporateContacts.passwordSetAt)))
    .limit(1);
  if (!partner) return;
  await db.transaction(async (tx) => {
    // A request that already holds a partner's messages or invoices can only go back to that same partner
    const allowed = await attachRestriction(tx, input.data.requestId);
    if (allowed && !allowed.includes(partner.id)) return;
    // Only a request that is not linked yet: moving one to another partner is detach, then attach
    const [row] = await tx
      .update(q)
      .set({ corporateContactId: partner.id })
      .where(and(eq(q.id, input.data.requestId), isNull(q.corporateContactId)))
      .returning({ id: q.id });
    if (row) await tx.insert(schema.requestEvents).values({ requestId: row.id, adminId: admin.id, event: "attached", params: { partner: partner.name, by: "team" } });
  });
  refresh();
}

export async function detachPartner(formData: FormData) {
  const admin = await requireAdmin();
  const requestId = id.safeParse(formData.get("requestId"));
  if (!requestId.success) return;
  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ contactId: q.corporateContactId, partner: schema.corporateContacts.name })
      .from(q)
      .leftJoin(schema.corporateContacts, eq(schema.corporateContacts.id, q.corporateContactId))
      .where(eq(q.id, requestId.data))
      .limit(1);
    if (!before?.contactId) return;
    await tx.update(q).set({ corporateContactId: null }).where(eq(q.id, requestId.data));
    await tx.insert(schema.requestEvents).values({ requestId: requestId.data, adminId: admin.id, event: "detached", params: { partner: before.partner ?? "" } });
  });
  refresh();
}

export type ReplyState = { ok?: boolean; error?: string };

/** The team's reply in a request's conversation with its partner. It is emailed to the partner and shows in their portal. */
export async function replyToPartner(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const admin = await requireAdmin();
  const input = z.object({ requestId: id, body: z.string().trim().min(1, "Write a reply first.").max(2000, "That reply is too long.") }).safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: input.error.issues[0]?.message ?? "Invalid input." };

  const [request] = await db.select().from(q).where(eq(q.id, input.data.requestId)).limit(1);
  if (!request?.corporateContactId) return { error: "This request is not linked to a partner." };
  const [partner] = await db
    .select({ email: schema.corporateContacts.email, name: schema.corporateContacts.name, locale: schema.corporateContacts.locale })
    .from(schema.corporateContacts)
    .where(eq(schema.corporateContacts.id, request.corporateContactId))
    .limit(1);
  if (!partner) return { error: "This request is not linked to a partner." };

  await db.insert(schema.bookingMessages).values({ requestId: request.id, authorKind: "team", adminId: admin.id, kind: "message", body: input.data.body });
  after(() => emailPartnerBooking({ request, to: partner, kind: "reply", message: input.data.body }));
  refresh();
  return { ok: true };
}

/** Called when a team member opens a request that has partner messages nobody has read. */
export async function markMessagesSeen(requestId: string) {
  await requireAdmin();
  if (!id.safeParse(requestId).success) return;
  await db
    .update(schema.bookingMessages)
    .set({ seenByTeamAt: sql`now()` })
    .where(and(eq(schema.bookingMessages.requestId, requestId), eq(schema.bookingMessages.authorKind, "partner"), isNull(schema.bookingMessages.seenByTeamAt)));
  refresh();
}

// ── Invoices ─────────────────────────────────────────────────────────────────────────────────────────────────
// The same two-step upload as the driver documents: the server hands out a one-time signed link, the browser sends the
// PDF straight to the document store (which checks type, size and free space), then the server records it.

export type InvoiceUpload = { ok: true; url: string; path: string } | { ok: false; error: string };

/** Step one: a signed upload link for one invoice. The file is stored as <new folder>/invoice.pdf. */
export async function prepareInvoiceUpload(requestId: string): Promise<InvoiceUpload> {
  await requireAdmin();
  if (!id.safeParse(requestId).success) return { ok: false, error: "Invalid request." };
  if (!storageConfigured()) return { ok: false, error: "Document storage is not configured." };
  const [request] = await db.select({ contactId: q.corporateContactId }).from(q).where(eq(q.id, requestId)).limit(1);
  if (!request?.contactId) return { ok: false, error: "Link this request to a partner first." };
  const path = `${crypto.randomUUID()}/invoice.pdf`;
  return { ok: true, url: await signedUploadUrl(path), path };
}

/** Step two: the file is on disk; record it against the request and tell the partner. */
export async function recordInvoice(requestId: string, path: string, fileName: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await requireAdmin();
  const input = z
    .object({ requestId: id, path: z.string().regex(/^[0-9a-f-]{36}\/invoice\.pdf$/), fileName: z.string().trim().min(1).max(200) })
    .safeParse({ requestId, path, fileName });
  if (!input.success) return { ok: false, error: "Invalid upload." };

  // What the store actually holds, not what the browser says it sent
  const [stored] = (await listFiles(input.data.path.split("/")[0])).filter((f) => f.name === "invoice.pdf");
  if (!stored) return { ok: false, error: "The file did not arrive. Please try again." };

  const [request] = await db.select().from(q).where(eq(q.id, input.data.requestId)).limit(1);
  if (!request?.corporateContactId) {
    await removeFiles([input.data.path]);
    return { ok: false, error: "Link this request to a partner first." };
  }
  // The name a partner sees: no path, no quotes or line breaks that could end up in a header
  const displayName = input.data.fileName.replace(/^.*[\\/]/, "").replace(/["\r\n]/g, "").slice(0, 120) || "invoice.pdf";
  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.bookingInvoices).values({ requestId: request.id, path: input.data.path, fileName: displayName, size: stored.size, uploadedBy: admin.id });
      await tx.insert(schema.requestEvents).values({ requestId: request.id, adminId: admin.id, event: "invoice_added", params: { fileName: displayName } });
    });
  } catch (err) {
    // The same stored file recorded twice (a file belongs to one invoice): leave the first record and its file alone
    if (isUniqueViolation(err)) return { ok: false, error: "That file is already recorded as an invoice." };
    throw err;
  }
  const [partner] = await db
    .select({ email: schema.corporateContacts.email, name: schema.corporateContacts.name, locale: schema.corporateContacts.locale })
    .from(schema.corporateContacts)
    .where(eq(schema.corporateContacts.id, request.corporateContactId))
    .limit(1);
  if (partner) after(() => emailPartnerBooking({ request, to: partner, kind: "invoice" }));
  refresh();
  return { ok: true };
}

export async function deleteInvoice(formData: FormData) {
  await requireAdmin();
  const invoiceId = id.safeParse(formData.get("invoiceId"));
  if (!invoiceId.success) return;
  const [gone] = await db.delete(schema.bookingInvoices).where(eq(schema.bookingInvoices.id, invoiceId.data)).returning({ path: schema.bookingInvoices.path });
  if (gone) await removeFiles([gone.path]);
  refresh();
}
