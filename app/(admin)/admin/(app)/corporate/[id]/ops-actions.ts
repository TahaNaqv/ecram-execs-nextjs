"use server";

import { eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

async function audit(contactId: string, adminId: string, field: string, before: string | null, after: string | null) {
  if (before === after) return;
  await db.insert(schema.corporateAudit).values({ contactId, adminId, field, before, after });
}

const uuidOrNull = (value: FormDataEntryValue | null) => {
  const raw = String(value ?? "");
  return /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
};

function saved(contactId: string) {
  revalidatePath("/admin/corporate");
  revalidatePath(`/admin/corporate/${contactId}`);
  revalidatePath("/admin/introducers");
  refresh();
}

export async function savePartnerOps(formData: FormData) {
  const admin = await requireArea("/admin/corporate");
  const id = String(formData.get("id") ?? "");
  const [current] = await db.select().from(schema.corporateContacts).where(eq(schema.corporateContacts.id, id)).limit(1);
  if (!current) return;
  const preferredRaw = String(formData.get("preferredContact") ?? "");
  const preferred = preferredRaw === "email" || preferredRaw === "phone" || preferredRaw === "whatsapp" ? preferredRaw : null;
  const termsRaw = Number(formData.get("paymentTermsDays") ?? 0);
  const terms = termsRaw === 7 || termsRaw === 14 || termsRaw === 30 ? termsRaw : null;
  if (formData.has("preferredContact")) {
    await db.update(schema.corporateContacts).set({ preferredContact: preferred, paymentTermsDays: terms }).where(eq(schema.corporateContacts.id, id));
    await audit(id, admin.id, "preferredContact", current.preferredContact, preferred);
    await audit(id, admin.id, "paymentTermsDays", current.paymentTermsDays == null ? null : String(current.paymentTermsDays), terms == null ? null : String(terms));
    saved(id);
    return;
  }
  const next = {
    preferences: String(formData.get("preferences") ?? "").trim() || null,
    accountManagerId: uuidOrNull(formData.get("accountManagerId")),
    introducerId: uuidOrNull(formData.get("introducerId")),
    kvkNumber: String(formData.get("kvkNumber") ?? "").trim() || null,
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
  saved(id);
}

export async function addBooker(formData: FormData) {
  const admin = await requireArea("/admin/corporate");
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
  saved(contactId);
}

export async function updateBooker(formData: FormData) {
  const admin = await requireArea("/admin/corporate");
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
  saved(current.contactId);
}

export async function deleteBooker(formData: FormData) {
  const admin = await requireArea("/admin/corporate");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [current] = await db.delete(schema.corporateBookers).where(eq(schema.corporateBookers.id, id)).returning();
  if (current) {
    await audit(current.contactId, admin.id, "booker", current.name, null);
    saved(current.contactId);
  }
}

export async function restorePartner(formData: FormData) {
  const admin = await requireArea("/admin/corporate");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.update(schema.corporateContacts).set({ archivedAt: null }).where(eq(schema.corporateContacts.id, id));
  await audit(id, admin.id, "archived", "archived", null);
  saved(id);
}

export async function archivePartner(formData: FormData) {
  const admin = await requireArea("/admin/corporate");
  const id = String(formData.get("id") ?? "");
  if (formData.get("confirm") !== "archive") return;
  await db.update(schema.corporateContacts).set({ archivedAt: new Date() }).where(eq(schema.corporateContacts.id, id));
  await audit(id, admin.id, "archived", null, "archived");
  saved(id);
}
