import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, quoteRequests } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pickupAtStr = searchParams.get("pickupAt");

  try {
    const allVehicles = await db.select().from(vehicles);

    if (!pickupAtStr) {
      return NextResponse.json({ vehicles: allVehicles });
    }

    const pickupDate = new Date(pickupAtStr);

    // Find confirmed bookings for this specific date/time
    const conflictingBookings = await db
      .select({ vehicleId: quoteRequests.vehicle })
      .from(quoteRequests)
      .where(
        and(
          eq(quoteRequests.status, "confirmed"),
          eq(quoteRequests.pickupAt, pickupDate)
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