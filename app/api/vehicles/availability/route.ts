import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, quoteRequests } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pickupAtStr = searchParams.get("pickupAt");

  try {
    const allVehicles = await db.select().from(vehicles);

    if (!pickupAtStr) {
      return NextResponse.json({ vehicles: allVehicles });
    }

    const pickupDate = new Date(pickupAtStr);
    if (isNaN(pickupDate.getTime())) {
      return NextResponse.json({ error: "Invalid pickupAt parameter" }, { status: 400 });
    }

    // Find confirmed bookings for this timeframe (within 2-hour buffer)
    const windowStart = new Date(pickupDate.getTime() - 2 * 3600 * 1000).toISOString();
    const windowEnd = new Date(pickupDate.getTime() + 2 * 3600 * 1000).toISOString();

    const conflictingBookings = await db
      .select({ vehicleId: quoteRequests.vehicle })
      .from(quoteRequests)
      .where(
        and(
          eq(quoteRequests.status, "confirmed"),
          sql`${quoteRequests.pickupAt} >= ${windowStart} AND ${quoteRequests.pickupAt} <= ${windowEnd}`
        )
      );

    const bookedIds = new Set(
      conflictingBookings
        .map((b) => (b.vehicleId ? normalizeVehicleKey(b.vehicleId) : null))
        .filter(Boolean)
    );

    // Exclude booked or admin-disabled vehicles (reconciling hyphen/underscore IDs)
    const filtered = allVehicles.filter((v) => {
      const normId = normalizeVehicleKey(v.id);
      return v.status === "available" && !bookedIds.has(normId);
    });

    return NextResponse.json({ vehicles: filtered });
  } catch (error) {
    console.error("Error checking vehicle availability:", error);
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
  }
}
