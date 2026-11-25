"use server";

import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

async function saveSetting(key: string, value: unknown, adminId: string) {
  await db
    .insert(schema.appSettings)
    .values({ key, value, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedBy: adminId, updatedAt: new Date() } });
}

export async function saveBookingRules(formData: FormData) {
  const admin = await requireArea("/admin/desk");
  const value = {
    minNoticeHours: Number(formData.get("minNoticeHours") ?? 2),
    waitingMinutes: Number(formData.get("waitingMinutes") ?? 15),
    cancellationHours: Number(formData.get("cancellationHours") ?? 24),
  };
  await saveSetting("booking_rules", value, admin.id);
}

export async function saveTerms(formData: FormData) {
  const admin = await requireArea("/admin/desk");
  const version = String(formData.get("version") ?? "").trim() || "1";
  const body = String(formData.get("body") ?? "");
  await saveSetting("terms_en", { version, body }, admin.id);
}

