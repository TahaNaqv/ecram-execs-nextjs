"use server";

import { sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { cleanComingSoon, COMING_SOON_KEY, FLEET_CACHE_TAG, MAX_EXPECTED_LENGTH } from "@/lib/fleet/catalog";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { FLEET } from "@/lib/fleet/vehicles";

/**
 * Which models the booking form shows as "coming soon" instead of bookable (the client, 27 Nov 2026: the VLE 300 until
 * Q2 2027). Each model has a "soon:<key>" tick and an "expected:<key>" text. The website and the concierge follow at once.
 */
export async function saveComingSoon(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const admin = await requireArea("/admin/vehicles");
  const t = (await adminDictionary()).admin.vehicles;
  const chosen: Record<string, string> = {};
  for (const vehicle of FLEET) {
    if (formData.get(`soon:${vehicle.key}`) !== "on") continue;
    const expected = String(formData.get(`expected:${vehicle.key}`) ?? "").trim();
    if (!expected) return { error: interpolate(t.soonNeedsDate, { car: vehicle.name }) };
    if (expected.length > MAX_EXPECTED_LENGTH) return { error: interpolate(t.soonTooLong, { max: MAX_EXPECTED_LENGTH }) };
    chosen[vehicle.key] = expected;
  }
  if (Object.keys(chosen).length === FLEET.length) return { error: t.soonAllOff };
  const value = cleanComingSoon(chosen);
  await db
    .insert(schema.appSettings)
    .values({ key: COMING_SOON_KEY, value, updatedBy: admin.id })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedBy: admin.id, updatedAt: sql`now()` } });
  // Expired at once: the next visitor to the booking form and the fleet page sees the change
  updateTag(FLEET_CACHE_TAG);
  refresh();
  return { ok: true };
}
