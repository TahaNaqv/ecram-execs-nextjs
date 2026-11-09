"use server";

import { sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { FLEET_BASE_KEY } from "@/lib/fleet/base";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

export type BaseState = { ok?: boolean; error?: string };

/**
 * The team sets where the cars live (the client, 8 Nov 2026): every trip confirmed from then on holds its car for the drive
 * home to here. An empty address clears it, and the drive back is measured to each trip's pick-up again.
 */
export async function saveFleetBase(_prev: BaseState, formData: FormData): Promise<BaseState> {
  const admin = await requireAdmin();
  const t = (await adminDictionary()).admin.vehicles;
  const input = z
    .object({ address: z.string().trim().max(300), placeId: z.string().trim().max(300).optional() })
    .safeParse({ address: formData.get("address") ?? "", placeId: formData.get("placeId") || undefined });
  if (!input.success) return { error: t.baseFailed };

  const value = input.data.address ? { address: input.data.address, placeId: input.data.placeId ?? null } : {};
  await db
    .insert(schema.appSettings)
    .values({ key: FLEET_BASE_KEY, value, updatedBy: admin.id })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedBy: admin.id, updatedAt: sql`now()` } });
  refresh();
  return { ok: true };
}
