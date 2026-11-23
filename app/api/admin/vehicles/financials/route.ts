import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { listVehicleFinancials, viewFromRow } from "@/lib/financials/vehicle-financials";

export async function GET() {
  try {
    await requireAdmin();
    const [vehicles, rows] = await Promise.all([
      db.select({ id: schema.vehicles.id, name: schema.vehicles.name, licensePlate: schema.vehicles.licensePlate }).from(schema.vehicles),
      listVehicleFinancials(),
    ]);
    const byId = new Map(rows.map((row) => [row.vehicleId, row]));
    return NextResponse.json({
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        name: vehicle.name,
        licensePlate: vehicle.licensePlate,
        financials: viewFromRow(byId.get(vehicle.id) ?? null, vehicle.id),
      })),
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("[vehicle-financials] list failed", error);
    return NextResponse.json({ error: "EV financials could not be loaded." }, { status: 500 });
  }
}
