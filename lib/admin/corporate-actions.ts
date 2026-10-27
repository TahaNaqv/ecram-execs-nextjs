"use server";

import { db } from "@/lib/db";
import { corporateContacts, quoteRequests } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";

export async function addCorporatePartner(formData: FormData) {
  await requireAdmin();

  const companyName = (formData.get("companyName") as string)?.trim();
  const kvkNumber = (formData.get("kvk") as string)?.trim() || null;
  const name = (formData.get("bookerName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim()?.toLowerCase();
  const position = (formData.get("bookerRole") as string)?.trim() || "Corporate Booker";
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!companyName || !name || !email) {
    console.error("❌ Add corporate partner failed: Missing required fields");
    return { ok: false, error: "Company name, booker name, and email are required." };
  }

  const emailDomain = email.split("@")[1] || "corporate.nl";

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
        verifiedAt: new Date(),
        source: "admin",
      })
      .returning();

    console.log(`🎉 Successfully registered corporate partner: ${companyName} (${inserted.id})`);
    revalidatePath("/admin/corporate");
    return { ok: true, id: inserted.id };
  } catch (error) {
    console.error("❌ Error registering corporate partner:", error);
    return { ok: false, error: "Failed to register partner in database." };
  }
}

export async function deleteCorporatePartner(id: string) {
  await requireAdmin();

  if (!id) return { ok: false, error: "Missing partner ID" };

  try {
    await db.delete(corporateContacts).where(eq(corporateContacts.id, id));
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
