"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { SHIFT_CAP_MS } from "@/lib/drivers/shifts";
import { amsterdamWallToUtc } from "@/lib/drivers/time";
import { digitsOnly, phoneLengthOk } from "@/lib/phone";

const { drivers, driverShifts, driverAssignments, driverBreakBlocks, vehicles } = schema;

const addSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the driver's name.").max(120),
    phoneCountry: z.string().trim().min(1).default("31"),
    phone: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    const digits = digitsOnly(v.phone);
    if (!/^\d{8,15}$/.test(digits) || !phoneLengthOk(v.phoneCountry, digits)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Enter a phone number with 8 to 15 digits." });
    }
  })
  .transform((v) => ({ name: v.name, phone: digitsOnly(v.phone) }));

export type AddDriverState = { ok?: boolean; error?: string };

export async function addDriver(_prev: AddDriverState, formData: FormData): Promise<AddDriverState> {
  await requireArea("/admin/drivers");
  const parsed = addSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await db.insert(drivers).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function updateDriver(formData: FormData) {
  await requireArea("/admin/drivers");
  const id = driverId(formData);
  if (!id.success) return;
  const parsed = addSchema.safeParse({ name: formData.get("name") ?? "", phone: formData.get("phone") ?? "", phoneCountry: "31" });
  if (!parsed.success) return;
  await db.update(drivers).set(parsed.data).where(eq(drivers.id, id.data));
  refresh();
}

const driverId = (formData: FormData) => z.uuid().safeParse(formData.get("driverId"));

export async function startShift(formData: FormData) {
  const admin = await requireArea("/admin/drivers");
  const id = driverId(formData);
  if (!id.success) return;
  // The partial unique index makes a double tap a no-op instead of a second open shift
  const vehicleId = String(formData.get("vehicleId") ?? "").trim() || null;
  await db
    .insert(driverShifts)
    .values({ driverId: id.data, startedBy: admin.id, vehicleId, status: "active" })
    .onConflictDoNothing({ target: driverShifts.driverId, where: isNull(driverShifts.endedAt) });
  refresh();
}

export async function endShift(formData: FormData) {
  const admin = await requireArea("/admin/drivers");
  const id = driverId(formData);
  if (!id.success) return;
  await db
    .update(driverShifts)
    .set({ endedAt: sql`least(now(), started_at + interval '10 hours')`, endedBy: admin.id, status: sql`case when now() >= started_at + interval '10 hours' then 'auto_closed' else 'completed' end` })
    .where(and(eq(driverShifts.driverId, id.data), isNull(driverShifts.endedAt)));
  refresh();
}

/** Archiving hides a driver from the board (and closes any open shift); history is kept. */
export async function setDriverActive(formData: FormData) {
  const admin = await requireArea("/admin/drivers");
  const id = driverId(formData);
  if (!id.success) return;
  const active = formData.get("active") === "true";
  await db.transaction(async (tx) => {
    if (!active) {
      await tx
        .update(driverShifts)
        .set({ endedAt: sql`least(now(), started_at + interval '10 hours')`, endedBy: admin.id, status: sql`case when now() >= started_at + interval '10 hours' then 'auto_closed' else 'completed' end` })
        .where(and(eq(driverShifts.driverId, id.data), isNull(driverShifts.endedAt)));
    }
    await tx.update(drivers).set({ active }).where(eq(drivers.id, id.data));
  });
  refresh();
}

const wall = (formData: FormData, dateKey: string, timeKey: string) => {
  const date = String(formData.get(dateKey) ?? "");
  const time = String(formData.get(timeKey) ?? "");
  return amsterdamWallToUtc(date, time);
};

const refreshDrivers = () => {
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/requests/schedule");
  refresh();
};

/** Links a driver to a car for a window, or for the whole 10-hour shift starting at the given time. */
export async function assignDriverVehicle(formData: FormData) {
  await requireArea("/admin/drivers");
  const driver = z.uuid().safeParse(formData.get("driverId"));
  const vehicle = z.string().trim().min(1).safeParse(formData.get("vehicleId"));
  const start = wall(formData, "date", "start");
  if (!driver.success || !vehicle.success || !start) return;
  const entire = formData.get("entireShift") === "on";
  const end = entire ? new Date(start.getTime() + SHIFT_CAP_MS) : wall(formData, "date", "end");
  if (!end || end <= start) return;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const [car] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.id, vehicle.data)).limit(1);
  const [person] = await db.select({ id: drivers.id }).from(drivers).where(and(eq(drivers.id, driver.data), eq(drivers.active, true))).limit(1);
  if (!car || !person) return;
  const clash = await db
    .select({ id: driverAssignments.id })
    .from(driverAssignments)
    .where(
      and(
        sql`${driverAssignments.startTime} < ${end.toISOString()}::timestamptz and ${driverAssignments.endTime} > ${start.toISOString()}::timestamptz`,
        sql`(${driverAssignments.driverId} = ${driver.data} or ${driverAssignments.vehicleId} = ${vehicle.data})`,
      ),
    )
    .limit(1);
  if (clash.length) return;
  await db.insert(driverAssignments).values({
    driverId: driver.data,
    vehicleId: vehicle.data,
    startTime: start,
    endTime: end,
    isEntireShift: entire,
    notes,
  });
  refreshDrivers();
}

export async function removeDriverAssignment(formData: FormData) {
  await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("assignmentId"));
  if (!id.success) return;
  await db.delete(driverAssignments).where(eq(driverAssignments.id, id.data));
  refreshDrivers();
}

/** Records a break the team adds or moves by hand. Only a block of at least 15 minutes counts toward the target. */
export async function saveDriverBreak(formData: FormData) {
  await requireArea("/admin/drivers");
  const driver = z.uuid().safeParse(formData.get("driverId"));
  const start = wall(formData, "date", "start");
  const end = wall(formData, "date", "end");
  if (!driver.success || !start || !end || end <= start) return;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const [open] = await db
    .select({ id: driverShifts.id })
    .from(driverShifts)
    .where(and(eq(driverShifts.driverId, driver.data), isNull(driverShifts.endedAt)))
    .limit(1);
  await db.insert(driverBreakBlocks).values({ driverId: driver.data, shiftId: open?.id ?? null, startTime: start, endTime: end, notes });
  refreshDrivers();
}

export async function removeDriverBreak(formData: FormData) {
  await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("breakId"));
  if (!id.success) return;
  await db.delete(driverBreakBlocks).where(eq(driverBreakBlocks.id, id.data));
  refreshDrivers();
}

/** Moves a shift's start or end. An end past 10 hours is stored on the cap and marked auto-closed. */
export async function adjustDriverShift(formData: FormData) {
  const admin = await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("shiftId"));
  const start = wall(formData, "startDate", "startTime");
  const endRaw = wall(formData, "endDate", "endTime");
  const status = z.enum(["active", "completed", "auto_closed"]).safeParse(formData.get("status"));
  if (!id.success || !start || !status.success) return;
  const [current] = await db.select({ driverId: driverShifts.driverId }).from(driverShifts).where(eq(driverShifts.id, id.data)).limit(1);
  if (!current) return;
  const cap = new Date(start.getTime() + SHIFT_CAP_MS);
  const closing = status.data !== "active";
  const end = closing ? (endRaw && endRaw > start ? (endRaw > cap ? cap : endRaw) : cap) : null;
  if (!end) {
    const [other] = await db
      .select({ id: driverShifts.id })
      .from(driverShifts)
      .where(and(eq(driverShifts.driverId, current.driverId), isNull(driverShifts.endedAt), sql`${driverShifts.id} <> ${id.data}`))
      .limit(1);
    if (other) return;
  }
  const nextStatus = end && end.getTime() >= cap.getTime() ? "auto_closed" : status.data;
  await db
    .update(driverShifts)
    .set({
      startedAt: start,
      endedAt: end,
      status: nextStatus,
      endedBy: end ? admin.id : null,
    })
    .where(eq(driverShifts.id, id.data));
  refreshDrivers();
}
