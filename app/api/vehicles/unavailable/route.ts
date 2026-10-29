import { NextResponse, type NextRequest } from "next/server";
import { ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { busyVehicleKeys } from "@/lib/fleet/availability";
import { normalizeVehicleKey, VEHICLE_KEYS } from "@/lib/fleet/vehicles";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { amsterdamNow } from "@/lib/quotes/validation";

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Pick-ups are asked in quarters of an hour, so the question says no more than that about when the fleet is busy. */
const quarterHour = (value: string) => `${value.slice(0, 14)}${String(Math.floor(Number(value.slice(14, 16)) / 15) * 15).padStart(2, "0")}`;

/**
 * Which vehicles the booking form must not offer. `unavailable` are the cars the team has switched off. With `at` (the
 * pick-up as Dutch wall-clock "YYYY-MM-DDTHH:mm", plus `hours` for an hourly trip and `returnAt` for a return journey),
 * `busy` are the cars already held by a confirmed booking at that time. Only keys are returned: nothing about bookings.
 * If the tables cannot be read, nothing is hidden (the team still sees every request that comes in, and a confirmation
 * is checked again when the team makes it).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const headers = { "Cache-Control": "private, max-age=30" };
  let unavailable: string[] = [];
  try {
    const rows = await db.select({ id: vehicles.id }).from(vehicles).where(ne(vehicles.status, "available"));
    unavailable = rows.map((r) => normalizeVehicleKey(r.id) ?? r.id);
  } catch (error) {
    console.error("Failed to read vehicle availability:", error);
  }

  let busy: string[] = [];
  const at = params.get("at") ?? "";
  const returnAt = params.get("returnAt") ?? "";
  const hours = Number(params.get("hours"));
  // Only a real, future pick-up within the booking window is looked up: the question cannot be used to browse the fleet's history
  if (WALL_CLOCK.test(at) && at >= amsterdamNow(-60) && at <= amsterdamNow(60 * 24 * 730)) {
    try {
      const keys = await busyVehicleKeys({
        pickupAt: quarterHour(at),
        // A return journey after the pick-up and inside the booking window, like the pick-up itself
        returnAt: WALL_CLOCK.test(returnAt) && returnAt > at && returnAt <= amsterdamNow(60 * 24 * 730) ? quarterHour(returnAt) : null,
        service: (HOURLY_DURATIONS as readonly number[]).includes(hours) ? "hourly" : undefined,
        durationHours: (HOURLY_DURATIONS as readonly number[]).includes(hours) ? hours : null,
      });
      // Only the fleet's own keys are ever named, whatever a booking has stored
      busy = [...keys].filter((k) => (VEHICLE_KEYS as readonly string[]).includes(k));
    } catch (error) {
      console.error("Failed to read which vehicles are booked:", error);
    }
  }
  return NextResponse.json({ unavailable, busy }, { headers });
}
