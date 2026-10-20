import { NextResponse } from "next/server";
import { ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";

/**
 * Which vehicles the team has switched off, for the booking form to hide. Only the keys are returned: nothing about
 * bookings or dates. If the table cannot be read, nothing is hidden (the team still sees every request that comes in).
 */
export async function GET() {
  try {
    const rows = await db.select({ id: vehicles.id }).from(vehicles).where(ne(vehicles.status, "available"));
    const unavailable = rows.map((r) => normalizeVehicleKey(r.id) ?? r.id);
    return NextResponse.json({ unavailable }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to read vehicle availability:", error);
    return NextResponse.json({ unavailable: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
