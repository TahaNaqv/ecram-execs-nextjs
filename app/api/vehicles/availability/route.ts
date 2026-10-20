import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, quoteRequests } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

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

    // Find confirmed bookings around this specific date/time (within 2-hour window)
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

    const bookedIds = new Set(conflictingBookings.map((b) => b.vehicleId).filter(Boolean));

    // Exclude booked or admin-disabled vehicles
    const filtered = allVehicles.filter(
      (v) => v.status === "available" && !bookedIds.has(v.id)
    );

    return NextResponse.json({ vehicles: filtered });
  } catch (error) {
    console.error("Error checking vehicle availability:", error);
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 });
  }
}
