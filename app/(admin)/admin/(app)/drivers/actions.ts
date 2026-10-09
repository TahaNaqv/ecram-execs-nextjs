"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

const { drivers, driverShifts } = schema;

const addSchema = z.object({
  name: z.string().trim().min(1, "Enter the driver's name.").max(120),
  phone: z
    .string()
    .trim()
    .max(40)
    .transform((v) => (v === "" ? null : v)),
});

export type AddDriverState = { ok?: boolean; error?: string };

export async function addDriver(_prev: AddDriverState, formData: FormData): Promise<AddDriverState> {
  await requireAdmin();
  const parsed = addSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await db.insert(drivers).values(parsed.data);
  refresh();
  return { ok: true };
}

const driverId = (formData: FormData) => z.uuid().safeParse(formData.get("driverId"));

export async function startShift(formData: FormData) {
  const admin = await requireAdmin();
  const id = driverId(formData);
  if (!id.success) return;
  // The partial unique index makes a double tap a no-op instead of a second open shift
  await db
    .insert(driverShifts)
    .values({ driverId: id.data, startedBy: admin.id })
    .onConflictDoNothing({ target: driverShifts.driverId, where: isNull(driverShifts.endedAt) });
  refresh();
}

export async function endShift(formData: FormData) {
  const admin = await requireAdmin();
  const id = driverId(formData);
  if (!id.success) return;
  await db
    .update(driverShifts)
    .set({ endedAt: sql`now()`, endedBy: admin.id })
    .where(and(eq(driverShifts.driverId, id.data), isNull(driverShifts.endedAt)));
  refresh();
}

/** Archiving hides a driver from the board (and closes any open shift); history is kept. */
export async function setDriverActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = driverId(formData);
  if (!id.success) return;
  const active = formData.get("active") === "true";
  await db.transaction(async (tx) => {
    if (!active) {
      await tx
        .update(driverShifts)
        .set({ endedAt: sql`now()`, endedBy: admin.id })
        .where(and(eq(driverShifts.driverId, id.data), isNull(driverShifts.endedAt)));
    }
    await tx.update(drivers).set({ active }).where(eq(drivers.id, id.data));
  });
  refresh();
}
