"use server";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { fillTemplate } from "@/lib/admin/template-tags";
import { TEMPLATE_DEFAULTS, templateOverride } from "@/lib/admin/templates";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { formatCurrency } from "@/lib/pricing/rates";

const BOOKKEEPER = "bookkeeper@ecramexecs.com";

function refreshBoard() {
  revalidatePath("/admin/introducers");
  refresh();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d\s()-]+$/;

type SaveResult = { ok: true } | { error: string };

/**
 * Adds an introducer (no id) or updates one (id), then links the ticked corporate partners to them.
 * Partners unticked in the dialog are unlinked (if still linked here); a ticked partner
 * that belonged to another introducer moves here. Archived partners are never touched.
 */
export async function saveIntroducer(formData: FormData): Promise<SaveResult> {
  await requireArea("/admin/introducers");
  const id = String(formData.get("id") ?? "").trim();
  if (id && !UUID.test(id)) return { error: "This introducer could not be found. Reload the page and try again." };

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 2) return { error: "Enter the introducer's full name." };
  if (name.length > 120) return { error: "The name can be at most 120 characters." };

  const company = String(formData.get("company") ?? "").trim().replace(/\s+/g, " ");
  if (company.length > 120) return { error: "The company name can be at most 120 characters." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // New introducers need an email (commission requests go to it); one added earlier without it can still be edited
  if (!email && !id) return { error: "Enter an email address." };
  if (email && (email.length > 254 || !EMAIL.test(email))) return { error: "Enter a valid email address, like name@company.com." };

  const phone = String(formData.get("phone") ?? "").trim().replace(/\s+/g, " ");
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (!PHONE.test(phone)) return { error: "The phone number may only contain digits, spaces and + - ( )." };
    if (digits < 6 || digits > 15) return { error: "The phone number must have between 6 and 15 digits." };
  }

  const percentText = String(formData.get("percent") ?? "").trim();
  if (!/^\d{1,3}$/.test(percentText)) return { error: "Commission must be a whole number from 0 to 100." };
  const percent = Number(percentText);
  if (percent > 100) return { error: "Commission must be a whole number from 0 to 100." };

  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 500) return { error: "Notes can be at most 500 characters." };

  const active = formData.get("active") === "on";

  const partnerIds = [...new Set(formData.getAll("partner").map((value) => String(value)))];
  const partnerWas = new Set(formData.getAll("partnerWas").map((value) => String(value)).filter((value) => UUID.test(value)));
  if (partnerIds.some((partnerId) => !UUID.test(partnerId))) return { error: "One of the chosen corporate partners could not be found." };
  if (partnerIds.length > 0) {
    const found = await db
      .select({ id: schema.corporateContacts.id })
      .from(schema.corporateContacts)
      .where(and(inArray(schema.corporateContacts.id, partnerIds), isNull(schema.corporateContacts.archivedAt)));
    if (found.length !== partnerIds.length) return { error: "One of the chosen corporate partners was archived or removed. Reload the page and try again." };
  }

  const [duplicate] = email
    ? await db
        .select({ id: schema.introducers.id })
        .from(schema.introducers)
        .where(id ? and(sql`lower(${schema.introducers.email}) = ${email}`, ne(schema.introducers.id, id)) : sql`lower(${schema.introducers.email}) = ${email}`)
        .limit(1)
    : [];
  if (duplicate) return { error: "Another introducer already uses this email address." };

  const values = {
    name,
    company: company || null,
    email: email || null,
    phone: phone || null,
    commissionPercent: percent,
    notes: notes || null,
    active,
  };

  const done = await db.transaction(async (tx) => {
    let introducerId = id;
    if (id) {
      const updated = await tx.update(schema.introducers).set(values).where(eq(schema.introducers.id, id)).returning({ id: schema.introducers.id });
      if (updated.length === 0) return false;
    } else {
      const [created] = await tx.insert(schema.introducers).values(values).returning({ id: schema.introducers.id });
      introducerId = created.id;
    }
    // Only what changed in this dialog: unticked partners leave this introducer (if still theirs), newly ticked ones join it.
    // A partner linked by someone else while the dialog was open is left as it is.
    const removed = [...partnerWas].filter((partnerId) => !partnerIds.includes(partnerId));
    const added = partnerIds.filter((partnerId) => !partnerWas.has(partnerId));
    if (removed.length > 0) {
      await tx
        .update(schema.corporateContacts)
        .set({ introducerId: null })
        .where(and(inArray(schema.corporateContacts.id, removed), eq(schema.corporateContacts.introducerId, introducerId!), isNull(schema.corporateContacts.archivedAt)));
    }
    if (added.length > 0) {
      await tx.update(schema.corporateContacts).set({ introducerId }).where(and(inArray(schema.corporateContacts.id, added), isNull(schema.corporateContacts.archivedAt)));
    }
    return true;
  });
  if (!done) return { error: "This introducer no longer exists. Reload the page." };

  revalidatePath("/admin/corporate");
  refreshBoard();
  return { ok: true };
}

export async function deleteIntroducer(formData: FormData) {
  await requireArea("/admin/introducers");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.delete(schema.introducers).where(eq(schema.introducers.id, id));
  refreshBoard();
}

/** Sends the edited invoice request and records when it went out. The bookkeeper is always copied. */
export async function emailIntroducer(formData: FormData) {
  const admin = await requireArea("/admin/introducers");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const [person] = await db.select().from(schema.introducers).where(eq(schema.introducers.id, id)).limit(1);
  if (!person?.email) return;
  const amount = formatCurrency(Number(formData.get("cents") ?? 0) / 100);
  const netTotal = formatCurrency(Number(formData.get("netCents") ?? 0) / 100);
  const monthYear = new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date());
  const tags = { amount, name: person.name, introducerName: person.name, monthYear, commission: amount, netTotal };
  const savedTemplate = await templateOverride("introducer_commission");
  const fallback = TEMPLATE_DEFAULTS.introducer_commission;
  const subject = String(formData.get("subject") ?? "").trim() || fillTemplate(savedTemplate?.subject ?? fallback.subject, tags);
  const body = String(formData.get("body") ?? "").trim() || fillTemplate(savedTemplate?.body ?? fallback.body, tags);
  const extra = process.env.BOOKKEEPER_EMAIL?.trim().toLowerCase();
  const cc = [BOOKKEEPER, ...(extra && extra !== BOOKKEEPER ? [extra] : [])];
  const { sendIntroducerCommission } = await import("@/lib/email");
  await sendIntroducerCommission({ to: person.email, subject, body, cc, fromName: admin.name });
  await db.update(schema.introducers).set({ lastInvoiceRequestedAt: new Date() }).where(eq(schema.introducers.id, id));
  refreshBoard();
}
