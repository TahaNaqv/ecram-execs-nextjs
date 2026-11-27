"use server";

import { eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { STOCKED_EXTRA_KEYS, type ExtraPick } from "@/lib/pricing/extras";
import { parseStock, parseSupplier, UUID } from "./addon-rules";

const known = (key: string) => (STOCKED_EXTRA_KEYS as readonly string[]).includes(key);

type Result = { error: string } | undefined;

async function supplierExists(id: string) {
  const [row] = await db.select({ id: schema.addonSuppliers.id }).from(schema.addonSuppliers).where(eq(schema.addonSuppliers.id, id)).limit(1);
  return Boolean(row);
}

export async function saveAddonStock(formData: FormData): Promise<Result> {
  await requireArea("/admin/addons");
  const key = String(formData.get("key") ?? "");
  if (!known(key)) return { error: "That add-on is not stocked." };
  const stock = parseStock(formData.get("onHand"));
  if ("error" in stock) return stock;
  const onHand = stock.value;
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  if (supplierId && !UUID.test(supplierId)) return { error: "Choose a supplier from the list." };
  if (supplierId && !(await supplierExists(supplierId))) return { error: "That supplier no longer exists. Reload the page and try again." };
  const linked = supplierId || null;
  await db.insert(schema.addonStock).values({ key, onHand, supplierId: linked }).onConflictDoUpdate({ target: schema.addonStock.key, set: { onHand, supplierId: linked } });
  refresh();
}

export async function addSupplier(formData: FormData): Promise<Result> {
  await requireArea("/admin/addons");
  const parsed = parseSupplier(formData);
  if ("error" in parsed) return parsed;
  const { name, email, phone, notes } = parsed.data;
  const key = String(formData.get("key") ?? "");
  if (key && !known(key)) return { error: "Choose an add-on from the list." };
  // One submission can reach the server more than once. The lock makes those retries share a single supplier.
  const supplier = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`addon-supplier:${name.toLowerCase()}:${email ?? ""}`}))`);
    const [existing] = await tx
      .select({ id: schema.addonSuppliers.id })
      .from(schema.addonSuppliers)
      .where(sql`lower(${schema.addonSuppliers.name}) = ${name.toLowerCase()} and ${schema.addonSuppliers.email} is not distinct from ${email}`)
      .limit(1);
    if (existing) return existing;
    const [created] = await tx
      .insert(schema.addonSuppliers)
      .values({ name, email, phone, notes })
      .returning({ id: schema.addonSuppliers.id });
    return created;
  });
  if (supplier && key) {
    await db.insert(schema.addonStock).values({ key, onHand: 0, supplierId: supplier.id }).onConflictDoUpdate({
      target: schema.addonStock.key,
      set: { supplierId: supplier.id },
    });
  }
  refresh();
}

export async function updateSupplier(formData: FormData): Promise<Result> {
  await requireArea("/admin/addons");
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "That supplier could not be found." };
  const parsed = parseSupplier(formData);
  if ("error" in parsed) return parsed;
  const updated = await db
    .update(schema.addonSuppliers)
    .set(parsed.data)
    .where(eq(schema.addonSuppliers.id, id))
    .returning({ id: schema.addonSuppliers.id });
  if (updated.length === 0) return { error: "That supplier no longer exists. Reload the page and try again." };
  refresh();
}

export async function deleteSupplier(formData: FormData): Promise<Result> {
  await requireArea("/admin/addons");
  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return { error: "That supplier could not be found." };
  await db.delete(schema.addonSuppliers).where(eq(schema.addonSuppliers.id, id));
  refresh();
}

/** Confirmed and completed bookings hold their add-ons. Anything earlier, or a cancellation, does not. */
const holdsStock = (status: string | null | undefined) => status === "confirmed" || status === "completed";

async function moveStock(picks: ExtraPick[] | null | undefined, direction: "take" | "return") {
  await Promise.all(
    (picks ?? []).map(async (extra) => {
      if (!known(extra.key)) return;
      const count = Math.max(1, extra.count || 1);
      const delta = direction === "take" ? -count : count;
      await db
        .update(schema.addonStock)
        .set({ onHand: sql`greatest(${schema.addonStock.onHand} + ${delta}, 0)` })
        .where(eq(schema.addonStock.key, extra.key));
    }),
  );
}

/** Takes the booked quantity off the shelf. Missing stock rows are left alone. */
export async function allocateAddons(picks: ExtraPick[] | null | undefined) {
  await moveStock(picks, "take");
}

/** Puts a previously confirmed booking's add-ons back. */
export async function releaseAddons(picks: ExtraPick[] | null | undefined) {
  await moveStock(picks, "return");
}

/** Deducts only when a booking becomes confirmed, and restores when it leaves confirmed without being completed. */
export async function syncAddonStock(from: string | null | undefined, to: string | null | undefined, picks: ExtraPick[] | null | undefined) {
  const held = holdsStock(from);
  const hold = holdsStock(to);
  if (held === hold) return;
  if (hold) await allocateAddons(picks);
  else await releaseAddons(picks);
}
