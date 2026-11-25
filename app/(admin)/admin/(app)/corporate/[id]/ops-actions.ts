"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

async function audit(contactId: string, adminId: string, field: string, before: string | null, after: string | null) {
  if (before === after) return;
  await db.insert(schema.corporateAudit).values({ contactId, adminId, field, before, after });
}

export async function savePartnerOps(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const [current] = await db.select().from(schema.corporateContacts).where(eq(schema.corporateContacts.id, id)).limit(1);
  if (!current) return;
  const preferred = String(formData.get("preferredContact") ?? "");
  const terms = Number(formData.get("paymentTermsDays") ?? 0);
  const next = {
    preferredContact: preferred === "email" || preferred === "phone" || preferred === "whatsapp" ? preferred : null,
    paymentTermsDays: terms === 7 || terms === 14 || terms === 30 ? terms : null,
    preferences: String(formData.get("preferences") ?? "").trim() || null,
    accountManagerId: String(formData.get("accountManagerId") ?? "") || null,
    introducerId: String(formData.get("introducerId") ?? "") || null,
    billingStreet: String(formData.get("billingStreet") ?? "").trim() || null,
    billingPostcode: String(formData.get("billingPostcode") ?? "").trim() || null,
    billingCity: String(formData.get("billingCity") ?? "").trim() || null,
    vatNumber: String(formData.get("vatNumber") ?? "").trim() || null,
  };
  await db.update(schema.corporateContacts).set(next).where(eq(schema.corporateContacts.id, id));
  for (const [field, value] of Object.entries(next)) {
    const previous = current[field as keyof typeof current];
    await audit(id, admin.id, field, previous == null ? null : String(previous), value == null ? null : String(value));
  }
  refresh();
}

export async function addBooker(formData: FormData) {
  const admin = await requireAdmin();
  const contactId = String(formData.get("contactId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!contactId || name.length < 2) return;
  await db.insert(schema.corporateBookers).values({
    contactId,
    name,
    email: String(formData.get("email") ?? "").trim() || null,
    phone: String(formData.get("phone") ?? "").trim() || null,
    position: String(formData.get("position") ?? "").trim() || null,
  });
  await audit(contactId, admin.id, "booker", null, name);
  refresh();
}

export async function updateBooker(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || name.length < 2) return;
  const [current] = await db.select().from(schema.corporateBookers).where(eq(schema.corporateBookers.id, id)).limit(1);
  if (!current) return;
  await db
    .update(schema.corporateBookers)
    .set({
      name,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      position: String(formData.get("position") ?? "").trim() || null,
    })
    .where(eq(schema.corporateBookers.id, id));
  await audit(current.contactId, admin.id, "booker", current.name, name);
  refresh();
}

export async function deleteBooker(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [current] = await db.delete(schema.corporateBookers).where(eq(schema.corporateBookers.id, id)).returning();
  if (current) await audit(current.contactId, admin.id, "booker", current.name, null);
  refresh();
}

export async function restorePartner(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.update(schema.corporateContacts).set({ archivedAt: null }).where(eq(schema.corporateContacts.id, id));
  await audit(id, admin.id, "archived", "archived", null);
  refresh();
}

export async function archivePartner(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (formData.get("confirm") !== "archive") return;
  await db.update(schema.corporateContacts).set({ archivedAt: new Date() }).where(eq(schema.corporateContacts.id, id));
  await audit(id, admin.id, "archived", null, "archived");
  refresh();
}
