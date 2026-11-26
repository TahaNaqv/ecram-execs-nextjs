"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/admin/access";
import { addCloseProtection, cancelCharge } from "@/lib/admin/charges";
import { requireAdmin } from "@/lib/auth/session";

const UUID = /^[0-9a-f-]{36}$/i;

/** Close protection on a booking after it was made: staff who may approve bookings only (as the security notes). */
export async function addCloseProtectionAction(formData: FormData): Promise<{ ok: true; billing: "balance" | "separate" } | { error: string }> {
  const admin = await requireAdmin();
  if (!can(admin.role, admin.permissions, "approve")) return { error: "Only staff who can approve bookings can add close protection." };
  const requestId = String(formData.get("requestId") ?? "");
  if (!UUID.test(requestId)) return { error: "This booking could not be found." };
  const text = String(formData.get("amount") ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return { error: "Enter the amount in euros, including VAT (for example 450 or 450.00)." };
  const amountCents = Math.round(Number(text) * 100);
  if (amountCents < 100 || amountCents > 10_000_000) return { error: "Enter an amount from €1 to €100,000." };
  const description = String(formData.get("description") ?? "").trim().replace(/\s+/g, " ") || "Close protection";
  if (description.length > 120) return { error: "The description can be at most 120 characters." };
  const result = await addCloseProtection({ requestId, amountCents, description, adminId: admin.id, notify: formData.get("notify") === "on" });
  if ("ok" in result) refresh();
  return result;
}

export async function cancelChargeAction(formData: FormData): Promise<{ ok: true } | { error: string; needsCredit?: true }> {
  const admin = await requireAdmin();
  if (!can(admin.role, admin.permissions, "approve")) return { error: "Only staff who can approve bookings can change close protection." };
  const chargeId = String(formData.get("chargeId") ?? "");
  if (!UUID.test(chargeId)) return { error: "This charge could not be found." };
  const result = await cancelCharge({ chargeId, adminId: admin.id, credited: formData.get("credited") === "on" });
  if ("ok" in result) refresh();
  return result;
}
