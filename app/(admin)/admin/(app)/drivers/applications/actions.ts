"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { APPLICATION_STATUSES, makeLabel } from "@/lib/partners/criteria";
import { lookupVehicle } from "@/lib/partners/rdw";

const { driverApplications: a, drivers, driverShifts } = schema;

const updateSchema = z.object({
  id: z.uuid(),
  status: z.enum(APPLICATION_STATUSES),
  internalNotes: z
    .string()
    .trim()
    .max(5000)
    .transform((v) => (v === "" ? null : v)),
});

export type UpdateApplicationState = { ok?: boolean; error?: string };

/**
 * Approving adds the applicant to the drivers board as a partner (or restores them if they were
 * archived); moving an approved application to another status archives that driver again.
 */
export async function updateApplication(_prev: UpdateApplicationState, formData: FormData): Promise<UpdateApplicationState> {
  const admin = await requireAdmin();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, status, internalNotes } = parsed.data;

  const found = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(a).where(eq(a.id, id)).for("update").limit(1);
    if (!before) return false;
    let driverId = before.driverId;

    if (status === "approved" && before.status !== "approved") {
      if (driverId) {
        await tx.update(drivers).set({ active: true }).where(eq(drivers.id, driverId));
      } else {
        const vehicle = [before.make && `${makeLabel(before.make)} ${before.model ?? ""}`.trim(), before.plate].filter(Boolean).join(" · ");
        [{ driverId }] = await tx
          .insert(drivers)
          .values({ name: before.name, phone: before.phone, partner: true, vehicle })
          .returning({ driverId: drivers.id });
      }
    } else if (before.status === "approved" && status !== "approved" && driverId) {
      await tx
        .update(driverShifts)
        .set({ endedAt: sql`now()`, endedBy: admin.id })
        .where(and(eq(driverShifts.driverId, driverId), isNull(driverShifts.endedAt)));
      await tx.update(drivers).set({ active: false }).where(eq(drivers.id, driverId));
    }

    const statusChanged = before.status !== status;
    await tx
      .update(a)
      .set({
        status,
        internalNotes,
        driverId,
        ...(statusChanged && { reviewedBy: admin.id, reviewedAt: sql`now()` }),
        updatedAt: sql`now()`,
      })
      .where(eq(a.id, id));
    return true;
  });
  if (!found) return { error: "Application not found." };
  refresh();
  return { ok: true };
}

/** Re-reads the car from the RDW, e.g. when the register couldn't be reached at submission. */
export async function refreshVehicle(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const [row] = await db.select({ plate: a.plate }).from(a).where(eq(a.id, id.data)).limit(1);
  if (!row) return;
  const v = await lookupVehicle(row.plate);
  if (v === null || v === "unavailable") return;
  await db
    .update(a)
    .set({
      make: v.make,
      model: v.model,
      colour: v.colour,
      seats: v.seats,
      firstRegistered: v.firstRegistered,
      apkExpires: v.apkExpires,
      taxiRegistered: v.taxiRegistered,
      openRecall: v.openRecall,
      rdwCheckedAt: sql`now()`,
    })
    .where(eq(a.id, id.data));
  refresh();
}

/** Permanently removes an application (e.g. a GDPR erasure request). A partner driver it created stays on the board. */
export async function deleteApplication(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const [deleted] = await db.delete(a).where(eq(a.id, id.data)).returning({ reference: a.reference });
  if (deleted) console.info(`[admin] application ${deleted.reference} deleted`);
  redirect("/admin/drivers/applications");
}
