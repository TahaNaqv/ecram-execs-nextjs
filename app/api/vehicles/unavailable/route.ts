import { NextResponse } from "next/server";
import { ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { normalizeVehicleKey } from "@/lib/fleet/vehicles";

/**
 * Which vehicles the booking form must not offer: the cars the team has switched off. Whether a car is free at a given time
 * is not said to visitors (the client, 8 Nov 2026): every booking is reviewed by hand, and the team checks the fleet then.
 * If the table cannot be read, nothing is hidden.
 */
export async function GET() {
  let unavailable: string[] = [];
  try {
    const rows = await db.select({ id: vehicles.id }).from(vehicles).where(ne(vehicles.status, "available"));
    unavailable = rows.map((r) => normalizeVehicleKey(r.id) ?? r.id);
  } catch (error) {
    console.error("Failed to read vehicle availability:", error);
  }
  return NextResponse.json({ unavailable }, { headers: { "Cache-Control": "private, max-age=30" } });
}
