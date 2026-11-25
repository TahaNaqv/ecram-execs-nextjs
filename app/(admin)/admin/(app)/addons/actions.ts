"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { EXTRA_KEYS, type ExtraPick } from "@/lib/pricing/extras";

const known = (key: string) => (EXTRA_KEYS as readonly string[]).includes(key);

export async function saveAddonStock(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  if (!known(key)) return;
  const onHand = Math.max(0, Math.round(Number(formData.get("onHand") ?? 0)));
  const supplierId = String(formData.get("supplierId") ?? "");
  const linked = /^[0-9a-f-]{36}$/i.test(supplierId) ? supplierId : null;
  await db.insert(schema.addonStock).values({ key, onHand, supplierId: linked }).onConflictDoUpdate({ target: schema.addonStock.key, set: { onHand, supplierId: linked } });
  refresh();
}

export async function addSupplier(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return;
  const [supplier] = await db
    .insert(schema.addonSuppliers)
    .values({
      name,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .returning({ id: schema.addonSuppliers.id });
  const key = String(formData.get("key") ?? "");
  if (supplier && known(key)) {
    await db.insert(schema.addonStock).values({ key, onHand: 0, supplierId: supplier.id }).onConflictDoUpdate({
      target: schema.addonStock.key,
      set: { supplierId: supplier.id },
    });
  }
  refresh();
}

export async function updateSupplier(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || name.length < 2) return;
  await db
    .update(schema.addonSuppliers)
    .set({
      name,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    })
    .where(eq(schema.addonSuppliers.id, id));
  refresh();
}

export async function deleteSupplier(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db.delete(schema.addonSuppliers).where(eq(schema.addonSuppliers.id, id));
  refresh();
}

/** Takes the booked quantity off the shelf. Missing stock rows are left alone. */
export async function allocateAddons(picks: ExtraPick[] | null | undefined) {
  for (const extra of picks ?? []) {
    if (!known(extra.key)) continue;
    const count = Math.max(1, extra.count || 1);
    await db
      .update(schema.addonStock)
      .set({ onHand: sql`greatest(${schema.addonStock.onHand} - ${count}, 0)` })
      .where(eq(schema.addonStock.key, extra.key));
  }
}
