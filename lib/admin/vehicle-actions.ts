"use server";

import { db } from "@/lib/db";
import { quoteRequests, vehicles, vehicleServices } from "@/lib/db/schema";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { heldKeys } from "@/lib/fleet/held";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";
import { amsterdamToday } from "@/lib/admin/financials-shared";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { FLEET_CACHE_TAG } from "@/lib/fleet/catalog";
import { removeFleetImages, saveFleetImages } from "@/lib/fleet/image-store";

/**
 * Refresh the admin list now, and the public fleet in the background.
 * Revalidating the locale layout made the next public visit rebuild every cached page under it.
 * That render outlasted the proxy and came back as a 502; the following refresh then succeeded.
 */
function publishFleetChange() {
  revalidatePath("/admin/vehicles");
  revalidateTag(FLEET_CACHE_TAG, "max");
}

function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Accepts an `<input type="date">` value and rejects anything that is not a real calendar day. */
function optionalIsoDate(formData: FormData, key: string): string | null {
  const value = optionalText(formData, key);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return value;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64);
}

function optionalInt(formData: FormData, key: string, min: number, max: number): number | null {
  const raw = optionalText(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

/** Euros typed in the form, stored as cents. A blank field is left unset. */
function optionalCents(formData: FormData, key: string): number | null {
  const raw = optionalText(formData, key)?.replace(",", ".");
  if (!raw) return null;
  const euros = Number(raw);
  if (!Number.isFinite(euros) || euros < 0 || euros > 10000) return null;
  return Math.round(euros * 100);
}

function imageFiles(formData: FormData): File[] {
  return formData.getAll("images").filter((value): value is File => value instanceof File);
}

export async function addVehicle(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  await requireArea("/admin/vehicles");

  const name = optionalText(formData, "name");
  const existingId = optionalText(formData, "id");
  if (!name) return { ok: false, error: "name" };

  const seats = optionalInt(formData, "seats", 1, 16);
  const luggage = optionalInt(formData, "luggage", 0, 30);
  const rateWeekday = optionalCents(formData, "rateWeekday");
  const rateSaturday = optionalCents(formData, "rateSaturday");
  const rateSunday = optionalCents(formData, "rateSunday");
  if (optionalText(formData, "seats") && seats == null) return { ok: false, error: "seats" };
  if (optionalText(formData, "luggage") && luggage == null) return { ok: false, error: "luggage" };
  if (optionalText(formData, "rateWeekday") && rateWeekday == null) return { ok: false, error: "rate" };

  // APK and insurance run until a day still to come. An expired date already on the car may stay while other details change.
  const today = amsterdamToday();
  const before = existingId
    ? (await db.select({ apkExpiry: vehicles.apkExpiry, insuranceExpiry: vehicles.insuranceExpiry }).from(vehicles).where(eq(vehicles.id, existingId)).limit(1))[0]
    : undefined;
  const apk = optionalIsoDate(formData, "apkExpiry");
  const insurance = optionalIsoDate(formData, "insuranceExpiry");
  if (apk && apk < today && apk !== before?.apkExpiry) return { ok: false, error: "apk-past" };
  if (insurance && insurance < today && insurance !== before?.insuranceExpiry) return { ok: false, error: "insurance-past" };

  const files = imageFiles(formData);
  let id = existingId && slug(existingId) === existingId ? existingId : slug(name);
  if (!id) return { ok: false, error: "name" };

  if (!existingId) {
    const taken = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, id)).limit(1);
    if (taken.length > 0) id = `${id.slice(0, 60)}_${Date.now().toString(36)}`.slice(0, 64);
  }

  const saved = await saveFleetImages(id, files);
  if (!saved.ok) return { ok: false, error: saved.error };

  const catalog = {
    name,
    licensePlate: optionalText(formData, "licensePlate"),
    color: optionalText(formData, "color"),
    apkExpiry: apk,
    insuranceExpiry: insurance,
    seats,
    luggage,
    rateWeekday,
    rateSaturday: rateSaturday || rateWeekday,
    rateSunday: rateSunday || rateWeekday,
    listed: existingId ? saved.urls.length > 0 || seats != null || luggage != null || rateWeekday != null : false,
    updatedAt: new Date(),
    ...(saved.urls.length > 0 ? { images: saved.urls } : {}),
  };

  try {
    if (existingId) {
      await db.update(vehicles).set(catalog).where(eq(vehicles.id, existingId));
    } else {
      await db.insert(vehicles).values({ id, status: "unavailable", ...catalog });
    }
  } catch (error) {
    console.error("Error saving vehicle:", error);
    if (!existingId) await removeFleetImages(id);
    return { ok: false, error: "save" };
  }

  publishFleetChange();
  return { ok: true };
}

export async function updateVehicleName(formData: FormData) {
  await requireArea("/admin/vehicles");

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
    return;
  }

  publishFleetChange();
}

export async function toggleVehicleStatus(formData: FormData) {
  await requireArea("/admin/vehicles");

  const id = formData.get("id") as string;
  const targetStatus = formData.get("status") as string | null;

  if (!id) {
    console.error("❌ Toggle status failed: Missing vehicle ID");
    return;
  }

  let newStatus: string;
  if (targetStatus === "available" || targetStatus === "unavailable" || targetStatus === "maintenance") {
    newStatus = targetStatus;
  } else {
    const existing = await db.query.vehicles.findFirst({ where: eq(vehicles.id, id) });
    newStatus = existing?.status === "available" ? "unavailable" : "available";
  }

  try {
    await db
      .update(vehicles)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(vehicles.id, id));
    console.log(`✔ Successfully toggled vehicle ${id} to ${newStatus}`);
  } catch (error) {
    console.error("❌ Error updating vehicle status:", error);
    return;
  }

  publishFleetChange();
}

export async function deleteVehicle(formData: FormData) {
  await requireArea("/admin/vehicles");

  const id = formData.get("id") as string;

  if (!id) {
    console.error("❌ Delete vehicle failed: Missing vehicle ID");
    return;
  }

  try {
    await db.delete(vehicles).where(eq(vehicles.id, id));
    await removeFleetImages(id);
    console.log(`🗑 Successfully deleted vehicle: ${id}`);
  } catch (error) {
    console.error("❌ Error deleting vehicle:", error);
    return;
  }

  publishFleetChange();
}
const SERVICE_TYPES = ["apk", "battery", "tyres", "detail"] as const;

/**
 * Books a service day for one car. New bookings cannot take the car that day (lib/fleet/availability.ts); bookings of the
 * same model already made for that day are counted in the answer, so the team can check the day schedule.
 */
export async function scheduleVehicleService(formData: FormData): Promise<{ ok: boolean; error?: string; bookingsThatDay?: number }> {
  const admin = await requireArea("/admin/vehicles");
  const vehicleId = optionalText(formData, "vehicleId");
  const serviceType = optionalText(formData, "serviceType");
  const serviceDate = optionalIsoDate(formData, "serviceDate");
  const notes = optionalText(formData, "notes")?.slice(0, 500) ?? null;
  if (!vehicleId) return { ok: false, error: "vehicle" };
  if (!serviceType || !(SERVICE_TYPES as readonly string[]).includes(serviceType)) return { ok: false, error: "type" };
  if (!serviceDate) return { ok: false, error: "date" };
  if (serviceDate < amsterdamToday()) return { ok: false, error: "date-past" };
  const [car] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicleId)).limit(1);
  if (!car) return { ok: false, error: "vehicle" };
  const saved = await db
    .insert(vehicleServices)
    .values({ vehicleId, serviceType, serviceDate, notes, createdBy: admin.id })
    .onConflictDoNothing({ target: [vehicleServices.vehicleId, vehicleServices.serviceDate] })
    .returning({ id: vehicleServices.id });
  if (saved.length === 0) return { ok: false, error: "duplicate" };
  const model = normalizeVehicleKey(vehicleId) ?? vehicleId;
  const sameDay = await db
    .select({ vehicle: quoteRequests.vehicle, vehicles: quoteRequests.vehicles, extras: quoteRequests.extras })
    .from(quoteRequests)
    .where(
      and(
        inArray(quoteRequests.status, ["new", "contacted", "quoted", "confirmed"]),
        sql`(${quoteRequests.pickupAt}::date = ${serviceDate}::date or ${quoteRequests.returnAt}::date = ${serviceDate}::date)`,
      ),
    );
  revalidatePath("/admin/vehicles");
  return { ok: true, bookingsThatDay: sameDay.filter((row) => heldKeys(row).has(model)).length };
}

export async function cancelVehicleService(formData: FormData): Promise<{ ok: boolean }> {
  await requireArea("/admin/vehicles");
  const id = optionalText(formData, "id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
  const gone = await db
    .delete(vehicleServices)
    .where(and(eq(vehicleServices.id, id), gte(vehicleServices.serviceDate, amsterdamToday())))
    .returning({ id: vehicleServices.id });
  revalidatePath("/admin/vehicles");
  return { ok: gone.length > 0 };
}
