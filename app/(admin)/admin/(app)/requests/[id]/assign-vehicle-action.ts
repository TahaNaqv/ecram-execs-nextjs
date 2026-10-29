"use server";

import { eq } from "drizzle-orm";
import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { clashingReference, lockFleet } from "@/lib/fleet/availability";
import { VEHICLE_CHOICES } from "@/lib/fleet/vehicles";

export type AssignState = { ok?: boolean; error?: string };

const input = z.object({
  id: z.uuid(),
  // "" means no car chosen yet
  vehicle: z.union([z.literal(""), z.enum(VEHICLE_CHOICES)]),
});

/**
 * Gives a booking its car. A confirmed booking holds the car, so the change is refused while another confirmed booking
 * holds that car at that time (the look and the save happen together under the fleet lock). Any other booking keeps the
 * choice until it is confirmed.
 */
export async function assignVehicle(_prev: AssignState, formData: FormData): Promise<AssignState> {
  const admin = await requireAdmin();
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose one of the cars in the list." };
  const { id } = parsed.data;
  const vehicle = parsed.data.vehicle || null;

  const result = await db.transaction(async (tx) => {
    // Always under the lock: the status read here decides whether the car is held, and a confirmation could be in flight
    await lockFleet(tx);
    const [before] = await tx.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, id)).limit(1);
    if (!before) return { error: "Request not found." } as const;
    if ((before.vehicle ?? null) === vehicle) return { ok: true } as const;
    if (before.status === "confirmed") {
      const clash = await clashingReference(tx, { ...before, vehicle });
      if (clash) return { error: `That car is already booked at that time (${clash}). Choose another car.` } as const;
    }
    await tx.update(schema.quoteRequests).set({ vehicle }).where(eq(schema.quoteRequests.id, id));
    await tx.insert(schema.requestEvents).values({
      requestId: id,
      adminId: admin.id,
      event: "changes",
      params: { changes: [{ kind: "vehicle", from: before.vehicle, to: vehicle }] },
    });
    return { ok: true } as const;
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/admin/requests/schedule");
  revalidatePath("/admin");
  refresh();
  return { ok: true };
}
