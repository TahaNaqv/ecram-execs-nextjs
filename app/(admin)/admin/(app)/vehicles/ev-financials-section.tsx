import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { getAllVehicles } from "@/lib/admin/live-queries";
import { listVehicleFinancials, viewFromRow } from "@/lib/financials/vehicle-financials";
import { EvFinancialsPanel } from "./ev-financials-panel";

export async function EvFinancialsSection() {
  const { admin } = await adminDictionary();
  let records: ReturnType<typeof viewFromRow>[] = [];
  let loadError = false;
  let vehicles: { id: string; name: string; licensePlate: string | null }[] = [];
  try {
    const [fleet, rows] = await Promise.all([getAllVehicles(), listVehicleFinancials()]);
    vehicles = fleet.map((vehicle) => ({ id: vehicle.id, name: vehicle.name, licensePlate: vehicle.licensePlate }));
    const byId = new Map(rows.map((row) => [row.vehicleId, row]));
    records = vehicles.map((vehicle) => viewFromRow(byId.get(vehicle.id) ?? null, vehicle.id));
  } catch (error) {
    console.error("[ev-financials] could not load", error);
    loadError = true;
  }
  return <EvFinancialsPanel vehicles={vehicles} records={records} copy={admin.vehicles.ev} loadError={loadError} />;
}
