"use server";

import { refresh } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export type SettingsResult = { ok: true } | { error: string };

/** A whole number within [min, max], or null. */
function wholeNumber(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const text = String(raw ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

export async function saveBookingRules(formData: FormData): Promise<SettingsResult> {
  const admin = await requireArea("/admin/desk");
  const minNoticeHours = wholeNumber(formData.get("minNoticeHours"), 0, 72);
  if (minNoticeHours === null) return { error: "Minimum notice must be a whole number of hours from 0 to 72." };
  const waitingMinutes = wholeNumber(formData.get("waitingMinutes"), 0, 120);
  if (waitingMinutes === null) return { error: "Included waiting time must be a whole number of minutes from 0 to 120." };
  const cancellationHours = wholeNumber(formData.get("cancellationHours"), 0, 168);
  if (cancellationHours === null) return { error: "Cancellation window must be a whole number of hours from 0 to 168." };

  const value = { minNoticeHours, waitingMinutes, cancellationHours };
  const now = new Date();
  await db
    .insert(schema.appSettings)
    .values({ key: "booking_rules", value, updatedBy: admin.id, updatedAt: now })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedBy: admin.id, updatedAt: now } });
  refresh();
  return { ok: true };
}
