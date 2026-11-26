"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export type SettingsResult = { ok: true } | { error: string };

const MAX_TERMS_LENGTH = 200_000;

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

/** Textareas submit CRLF line breaks; store and compare with plain LF. */
const normalise = (text: string) => text.replace(/\r\n?/g, "\n");

/** Saves the terms and keeps a copy of every saved version in terms_versions. Nothing is ever deleted. */
export async function saveTerms(formData: FormData): Promise<SettingsResult> {
  const admin = await requireArea("/admin/desk");
  const version = String(formData.get("version") ?? "").trim();
  const body = normalise(String(formData.get("body") ?? "")).trim();
  if (!body) return { error: "The terms text cannot be empty." };
  if (body.length > MAX_TERMS_LENGTH) return { error: "The terms text is too long." };
  if (!version) return { error: "Enter a version number for these terms." };
  if (version.length > 40) return { error: "The version is too long (40 characters at most)." };

  const result = await db.transaction(async (tx) => {
    // One save at a time, also before the terms have ever been saved (then there is no row to lock)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('terms-save'))`);
    const [row] = await tx
      .select({ value: schema.appSettings.value, updatedBy: schema.appSettings.updatedBy, updatedAt: schema.appSettings.updatedAt })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "terms_en"))
      .for("update")
      .limit(1);
    const raw = (row?.value && typeof row.value === "object" ? row.value : {}) as { version?: unknown; body?: unknown };
    const currentVersion = typeof raw.version === "string" && raw.version ? raw.version : "1";
    const currentBody = typeof raw.body === "string" ? normalise(raw.body).trim() : "";

    // Terms never written yet may take the version the editor starts with
    if (version === currentVersion && currentBody) {
      if (body === currentBody) return { ok: true } as const;
      return { error: `The text has changed: raise the version (it is ${currentVersion} now) so the previous terms are kept as they were.` } as const;
    }
    const [used] = await tx
      .select({ id: schema.termsVersions.id })
      .from(schema.termsVersions)
      .where(eq(schema.termsVersions.version, version))
      .limit(1);
    if (used) return { error: `Version ${version} was used before. Choose a new version number.` } as const;

    // The history starts empty only when the terms predate it: keep the text being replaced first.
    const [first] = await tx.select({ id: schema.termsVersions.id }).from(schema.termsVersions).limit(1);
    if (!first && currentBody) {
      await tx
        .insert(schema.termsVersions)
        .values({ version: currentVersion, body: currentBody, savedBy: row?.updatedBy ?? null, savedAt: row?.updatedAt ?? new Date() });
    }

    const now = new Date();
    const value = { version, body };
    await tx
      .insert(schema.appSettings)
      .values({ key: "terms_en", value, updatedBy: admin.id, updatedAt: now })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedBy: admin.id, updatedAt: now } });
    await tx.insert(schema.termsVersions).values({ version, body, savedBy: admin.id, savedAt: now });
    return { ok: true } as const;
  });

  if ("ok" in result) refresh();
  return result;
}
