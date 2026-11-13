"use server";

import { db } from "@/lib/db";
import { corporateContacts, quoteRequests, requestEvents } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { sendAccountDeleted } from "@/lib/email";
import { digitsOnly, phoneLengthOk } from "@/lib/phone";

const phoneError = "Enter a phone number with 8 to 15 digits for the selected country.";

function nationalPhone(phone: string): { code: string; national: string } | null {
  const parts = /^\+(\d{1,4})\s*(.*)$/.exec(phone.trim());
  if (!parts || /[a-z]/i.test(parts[2])) return null;
  const national = digitsOnly(parts[2]);
  if (national.length < 8 || national.length > 15 || !phoneLengthOk(parts[1], national)) return null;
  return { code: parts[1], national };
}

export async function addCorporatePartner(formData: FormData) {
  await requireAdmin();

  const companyName = (formData.get("companyName") as string)?.trim();
  const kvkNumber = (formData.get("kvk") as string)?.trim() || null;
  const name = (formData.get("bookerName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const position = (formData.get("bookerRole") as string)?.trim() || "Corporate Booker";
  const rawPhone = (formData.get("phone") as string)?.trim() || "";
  const parsedPhone = nationalPhone(rawPhone);

  if (!companyName || !name || !email) {
    console.error("❌ Add corporate partner failed: Missing required fields");
    return { ok: false, error: "Company name, booker name, and email are required." };
  }
  if (!parsedPhone) return { ok: false, error: phoneError };

  const phone = `+${parsedPhone.code} ${parsedPhone.national}`;
  const billingStreet = (formData.get("billingStreet") as string)?.trim() ?? "";
  const billingPostcode = (formData.get("billingPostcode") as string)?.trim() ?? "";
  const billingCity = (formData.get("billingCity") as string)?.trim() ?? "";
  const billingCountry = ((formData.get("billingCountry") as string)?.trim() || "NL").toUpperCase();
  const vatRaw = (formData.get("vatNumber") as string)?.trim() ?? "";
  const invoiceEmail = ((formData.get("invoiceEmail") as string)?.trim() ?? "").toLowerCase();
  if (billingStreet.length < 2 || billingPostcode.length < 2 || !billingCity) {
    return { ok: false, error: "Street, postcode and city are required for billing." };
  }
  if (!/^[A-Z]{2}$/.test(billingCountry)) return { ok: false, error: "Country must be a two-letter code, such as NL." };
  if (vatRaw && !/^[A-Za-z0-9 .-]+$/.test(vatRaw)) return { ok: false, error: "Enter a valid VAT number, or leave it empty." };
  if (invoiceEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invoiceEmail)) return { ok: false, error: "Enter a valid invoice email, or leave it empty." };
  const vatNumber = vatRaw ? vatRaw.replace(/[\s.-]/g, "").toUpperCase() : null;
  const emailDomain = email.split("@")[1] || "corporate.nl";
  const duplicateEmail = "An account with this email address already exists. Please use a unique email.";

  const [existing] = await db
    .select({ id: corporateContacts.id })
    .from(corporateContacts)
    .where(sql`lower(${corporateContacts.email}) = ${email}`)
    .limit(1);
  if (existing) return { ok: false, error: duplicateEmail };

  try {
    const [inserted] = await db
      .insert(corporateContacts)
      .values({
        companyName,
        kvkNumber,
        name,
        email,
        emailDomain,
        position,
        phone,
        billingStreet,
        billingPostcode: billingPostcode.toUpperCase(),
        billingCity,
        billingCountry,
        vatNumber,
        invoiceEmail: invoiceEmail || null,
        verifiedAt: new Date(),
        source: "admin",
      })
      .returning();

    console.log(`🎉 Successfully registered corporate partner: ${companyName} (${inserted.id})`);
    revalidatePath("/admin/corporate");
    return { ok: true, id: inserted.id };
  } catch (error) {
    const top = error as { code?: string; detail?: string; constraint_name?: string; message?: string; cause?: { code?: string; detail?: string; constraint_name?: string; message?: string } };
    const cause = top.cause;
    const code = cause?.code ?? top.code;
    const detail = `${cause?.detail ?? ""} ${cause?.constraint_name ?? ""} ${cause?.message ?? ""} ${top.detail ?? ""} ${top.message ?? ""}`.toLowerCase();
    console.error("❌ Error registering corporate partner:", code ?? top.message);
    if (code === "23505" || detail.includes("unique") || detail.includes("already exists")) {
      if (detail.includes("email")) return { ok: false, error: duplicateEmail };
      if (detail.includes("kvk")) return { ok: false, error: "This KvK number is already registered." };
      return { ok: false, error: "This account or email is already registered." };
    }
    return { ok: false, error: "Failed to register partner in database." };
  }
}

export async function deleteCorporatePartner(id: string) {
  await requireAdmin();

  if (!id) return { ok: false, error: "Missing partner ID" };

  try {
    // 1. Fetch partner details before deletion for auditing/logging
    const [partner] = await db
      .select()
      .from(corporateContacts)
      .where(eq(corporateContacts.id, id))
      .limit(1);

    if (partner?.email) {
      console.log(`🗑️ Deleting corporate partner account for: ${partner.companyName} (${partner.email})`);
      try {
        await sendAccountDeleted({
          email: partner.email,
          name: partner.name,
          locale: partner.locale,
          companyName: partner.companyName,
        });
      } catch (err) {
        console.error("[corporate] account deletion email failed", err);
      }
    }

    // Unlink this account's bookings and mark them, so a later signup with the same email cannot claim them.
    // The rows stay for the team; only the login and its claim on them go.
    await db.transaction(async (tx) => {
      const owned = await tx.select({ id: quoteRequests.id }).from(quoteRequests).where(eq(quoteRequests.corporateContactId, id));
      if (owned.length > 0) {
        await tx.insert(requestEvents).values(owned.map((row) => ({ requestId: row.id, event: "partner_erased" })));
        await tx.update(quoteRequests).set({ corporateContactId: null }).where(eq(quoteRequests.corporateContactId, id));
      }
      await tx.delete(corporateContacts).where(eq(corporateContacts.id, id));
    });
    console.log(`🗑️ Successfully removed corporate partner: ${id}`);
    
    revalidatePath("/admin/corporate");
    return { ok: true };
  } catch (error) {
    console.error("❌ Error deleting corporate partner:", error);
    return { ok: false, error: "Failed to delete partner." };
  }
}

export async function updateCorporateBilling(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const kvkNumber = (formData.get("kvk") as string)?.trim();
  const companyName = (formData.get("companyName") as string)?.trim();

  if (!id) return { ok: false, error: "Missing ID" };

  try {
    await db
      .update(corporateContacts)
      .set({
        kvkNumber: kvkNumber || null,
        companyName: companyName || undefined,
        updatedAt: new Date(),
      })
      .where(eq(corporateContacts.id, id));

    revalidatePath(`/admin/corporate/${id}/billing`);
    revalidatePath(`/admin/corporate/${id}/bookings`);
    revalidatePath("/admin/corporate");
    return { ok: true };
  } catch (error) {
    console.error("❌ Error updating corporate billing:", error);
    return { ok: false, error: "Failed to update billing details." };
  }
}

export async function updateCorporatePartner(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const companyName = (formData.get("companyName") as string)?.trim();
  const kvkNumber = (formData.get("kvk") as string)?.trim() || null;
  const name = (formData.get("bookerName") as string)?.trim();
  const position = (formData.get("bookerRole") as string)?.trim();
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const rawPhone = (formData.get("phone") as string)?.trim() || "";
  const parsedPhone = nationalPhone(rawPhone);
  const status = (formData.get("status") as string)?.trim();

  if (!id || !companyName || !name) {
    return { ok: false, error: "Missing required fields" };
  }
  if (!parsedPhone) return { ok: false, error: phoneError };
  const phone = `+${parsedPhone.code} ${parsedPhone.national}`;

  try {
    const lockedUntil = status === "Suspended" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : status === "Active" ? null : undefined;
    await db
      .update(corporateContacts)
      .set({
        companyName,
        kvkNumber,
        name,
        position: position || undefined,
        ...(email ? { email, emailDomain: email.split("@")[1] || undefined } : {}),
        phone,
        ...(lockedUntil !== undefined ? { lockedUntil } : {}),
        updatedAt: new Date(),
      })
      .where(eq(corporateContacts.id, id));

    revalidatePath(`/admin/corporate/${id}`);
    revalidatePath(`/admin/corporate/${id}/edit`);
    revalidatePath("/admin/corporate");
    return { ok: true };
  } catch (error: any) {
    console.error("❌ Error updating corporate partner:", error);

    if (error?.code === "23505" || error?.message?.includes("unique constraint")) {
      return { ok: false, error: "This email or KvK is already registered to another partner." };
    }

    return { ok: false, error: "Failed to update partner." };
  }
}