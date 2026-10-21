"use server";

import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";

export async function addVehicle(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();

  if (!name) {
    console.error("❌ Add vehicle failed: Vehicle name is missing");
    return;
  }

  const rawKey = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  try {
    await db.insert(vehicles).values({
      id: rawKey,
      name,
      status: "available",
    });
    console.log(`🎉 Successfully added vehicle: ${name} (${rawKey})`);
  } catch (error) {
    console.error("❌ Error inserting vehicle into database:", error);
  }

  revalidatePath("/admin/vehicles");
  revalidatePath("/[locale]", "layout");
}

export async function updateVehicleName(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();

  if (!id || !name) {
    console.error("❌ Update vehicle name failed: Missing ID or name");
    return;
  }

  try {
    await db
      .update(vehicles)
      .set({ name, updatedAt: new Date() })
      .where(eq(vehicles.id, id));
    console.log(`✏️ Successfully updated vehicle ${id} name to: ${name}`);
  } catch (error) {
    console.error("❌ Error updating vehicle name:", error);
  }

  revalidatePath("/admin/vehicles");
  revalidatePath("/[locale]", "layout");
}

export async function toggleVehicleStatus(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const currentStatus = formData.get("status") as string;

  if (!id || !currentStatus) {
    console.error("❌ Toggle status failed: Missing vehicle ID or status");
    return;
  }

  const newStatus = currentStatus === "available" ? "unavailable" : "available";

  try {
    await db
      .update(vehicles)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(vehicles.id, id));
    console.log(`✔ Successfully toggled vehicle ${id} to ${newStatus}`);
  } catch (error) {
    console.error("❌ Error updating vehicle status:", error);
  }

  revalidatePath("/admin/vehicles");
  revalidatePath("/[locale]", "layout");
}

export async function deleteVehicle(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;

  if (!id) {
    console.error("❌ Delete vehicle failed: Missing vehicle ID");
    return;
  }

  try {
    await db.delete(vehicles).where(eq(vehicles.id, id));
    console.log(`🗑 Successfully deleted vehicle: ${id}`);
  } catch (error) {
    console.error("❌ Error deleting vehicle:", error);
  }

  revalidatePath("/admin/vehicles");
  revalidatePath("/[locale]", "layout");
}