"use server";

import { and, eq, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { cleanCars } from "@/app/[locale]/_components/booking/trip";
import type { RequestEventChange } from "@/lib/admin/events";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { allocationFor, fleetPicks, normalizeVehicleKey } from "@/lib/fleet/vehicles";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { priceForRequest } from "@/lib/pricing/quote";
import { storedQuoteEuros } from "@/lib/pricing/rates";

export type CarsState = { ok?: boolean; error?: string };

const q = schema.quoteRequests;

/** A booking's cars as one comparable line: "audi:2|range_rover:1", in fleet order. */
const carsKey = (cars: readonly { key: string; count: number }[]) => cars.map((c) => `${c.key}:${c.count}`).join("|");

/**
 * The booking manager changes a booking's cars while reviewing it (the client, 8 Nov 2026): "we can't give you five VLEs,
 * but three, and two of another car". Only before it is approved (an approved booking holds its cars, and the car card below
 * changes those under the fleet lock), and only if the booking is still in the status the manager saw. The booking is priced
 * again at its own rates; an amount that came from the rate card follows the new price, one the team typed is kept.
 */
export async function updateCars(_prev: CarsState, formData: FormData): Promise<CarsState> {
  const admin = await requireAdmin();
  const t = (await adminDictionary()).admin.review;
  const input = z.object({ requestId: z.uuid(), seenStatus: z.string(), cars: z.string().max(400) }).safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: t.failed };

  const asked = input.data.cars
    .split("|")
    .map((part) => {
      const [key, count] = part.split(":");
      const car = normalizeVehicleKey(key);
      return car ? { key: car, count: Number(count) } : null;
    })
    .filter((c): c is { key: NonNullable<ReturnType<typeof normalizeVehicleKey>>; count: number } => c !== null && Number.isInteger(c.count) && c.count > 0);
  const cars = cleanCars(asked);
  if (cars.length === 0) return { error: t.carsNone };

  const [before] = await db.select().from(q).where(eq(q.id, input.data.requestId)).limit(1);
  if (!before || before.status !== input.data.seenStatus) return { error: t.stale };
  if (before.status !== "new" && before.status !== "contacted" && before.status !== "quoted") return { error: t.carsLocked };

  const fleet = allocationFor({ passengers: before.passengers, vehicle: cars[0].key, vehicles: cars });
  // Priced outside the transaction (the drive time may be looked up), at the rates the booking was made at
  const segment = before.priceEstimate?.segment ?? (before.corporateContactId ? "corporate" : "public");
  const price = await priceForRequest({ ...before, vehicle: fleet.vehicle ?? null, vehicles: fleet.vehicles }, segment);
  if (price && before.priceEstimate?.purpose) price.purpose = before.priceEstimate.purpose;
  const fromRateCard = before.quotedAmount == null || before.quotedAmount === storedQuoteEuros(before.priceEstimate);
  const quotedAmount = fromRateCard ? storedQuoteEuros(price) : before.quotedAmount;

  const from = carsKey(fleetPicks(before.vehicles).length > 0 ? fleetPicks(before.vehicles) : before.vehicle && before.vehicle !== "advise" ? [{ key: before.vehicle, count: before.vehicleCount }] : []);
  const to = carsKey(cars);
  if (from === to) return { ok: true };

  const saved = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(q)
      .set({ vehicle: fleet.vehicle ?? null, vehicleCount: fleet.vehicleCount, vehicles: fleet.vehicles, priceEstimate: price, quotedAmount, updatedAt: sql`now()` })
      .where(and(eq(q.id, before.id), eq(q.status, before.status)))
      .returning({ id: q.id });
    if (!row) return false;
    const changes: RequestEventChange[] = [{ kind: "cars", from, to }];
    if ((before.quotedAmount ?? null) !== (quotedAmount ?? null)) changes.push({ kind: "quote", from: before.quotedAmount, to: quotedAmount });
    await tx.insert(schema.requestEvents).values({ requestId: before.id, adminId: admin.id, event: "changes", params: { changes } });
    return true;
  });
  if (!saved) return { error: t.stale };
  refresh();
  return { ok: true };
}
