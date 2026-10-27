"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClockIcon, PlusIcon, XIcon, TrashIcon } from "../../_components/icons";
import type { VehicleRow } from "@/lib/admin/live-queries";
import { addVehicle, toggleVehicleStatus, deleteVehicle } from "@/lib/admin/vehicle-actions";

export function FleetComplianceSentinel({ vehicles }: { vehicles: VehicleRow[] }) {
  const router = useRouter();
  const [vehicleList, setVehicleList] = useState<VehicleRow[]>(vehicles);
  const [activeTab, setActiveTab] = useState<"snapshot" | "reminders">("snapshot");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setVehicleList(vehicles);
  }, [vehicles]);

  // Derived stats from real database data
  const available = vehicleList.filter((v) => v.status === "available").length;
  const maintenance = vehicleList.filter((v) => v.status === "maintenance" || v.status === "unavailable").length;
  const total = vehicleList.length;
  const complianceRate =
    total > 0 ? Math.round((vehicleList.filter((v) => v.iltPermitStatus === "Valid").length / total) * 100) : 0;

  const handleToggle = (vehId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "available" ? "unavailable" : "available";
    setVehicleList((prev) =>
      prev.map((v) => (v.id === vehId ? { ...v, status: nextStatus } : v))
    );

    const formData = new FormData();
    formData.append("id", vehId);
    formData.append("status", nextStatus);

    startTransition(async () => {
      await toggleVehicleStatus(formData);
      router.refresh();
    });
  };

  const handleDelete = (vehId: string, name: string) => {
    if (!confirm(`Remove ${name} from the fleet?`)) return;
    setVehicleList((prev) => prev.filter((v) => v.id !== vehId));
    const formData = new FormData();
    formData.append("id", vehId);
    startTransition(async () => {
      await deleteVehicle(formData);
      router.refresh();
    });
  };

  const handleDownloadReport = () => {
    setReportStatus("Compiling telemetry report...");
    const headers =
      "Vehicle ID,Name,License Plate,Battery SoC,Range km,Status,ILT Permit,APK Expiry,Insurance Expiry\n";
    const rows = vehicleList
      .map(
        (v) =>
          `"${v.id}","${v.name}","${v.licensePlate ?? ""}","${v.batterySoC}%","${v.evRangeKm} km","${v.status}","${v.iltPermitStatus}","${v.apkExpiry ?? ""}","${v.insuranceExpiry ?? ""}"`,
      )
      .join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", "data:text/csv;charset=utf-8," + encodeURI(headers + rows));
    link.setAttribute("download", `EcramExecs_Fleet_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setReportStatus("Fleet report downloaded.");
    setTimeout(() => setReportStatus(null), 3000);
  };

  return (
    <div className="space-y-6 relative">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Registered", value: total, color: "text-zinc-950" },
          { label: "Available Now", value: available, color: "text-emerald-600" },
          { label: "Unavailable / Maint.", value: maintenance, color: "text-amber-600" },
          { label: "ILT Compliance", value: `${complianceRate}%`, color: "text-zinc-950" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
            <p className={`text-3xl font-bold font-mono mt-2 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {reportStatus && (
        <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          {reportStatus}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/50">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">Executive Fleet Telemetry</h3>
              <p className="text-[11px] text-zinc-500">Live battery SoC, dispatch availability, and ILT compliance</p>
            </div>
            <div className="flex gap-1 bg-zinc-200/60 p-1 rounded-lg text-xs">
              {(["snapshot", "reminders"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${activeTab === tab ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600"}`}
                >
                  {tab === "snapshot" ? "Live Fleet & Availability" : "APK / Insurance"}
                </button>
              ))}
            </div>
          </div>

          {vehicleList.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-400">No vehicles registered yet.</p>
          ) : activeTab === "snapshot" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-3 py-3">Plate</th>
                    <th className="px-3 py-3">Battery</th>
                    <th className="px-3 py-3">Range</th>
                    <th className="px-3 py-3">ILT</th>
                    <th className="px-4 py-3 text-center">Availability Toggle</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {vehicleList.map((veh) => {
                    const isAvailable = veh.status === "available";
                    return (
                      <tr key={veh.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-zinc-950 truncate max-w-[160px]">{veh.name}</td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">{veh.licensePlate ?? "—"}</td>
                        <td className="px-3 py-3.5 font-mono">
                          <span className={veh.batterySoC < 25 ? "text-rose-600 font-bold" : "text-zinc-900"}>
                            {veh.batterySoC}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">{veh.evRangeKm} km</td>
                        <td className="px-3 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${veh.iltPermitStatus === "Valid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                          >
                            {veh.iltPermitStatus}
                          </span>
                        </td>
                        
                        {/* Interactive Optimistic Pretty Toggle Switch */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(veh.id, veh.status)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isAvailable ? "bg-emerald-600" : "bg-zinc-300 hover:bg-zinc-400"
                            }`}
                            title={isAvailable ? "Click to set unavailable" : "Click to set available"}
                          >
                            <span
                              className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                                isAvailable ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Delete Vehicle Action */}
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(veh.id, veh.name)}
                            className="text-zinc-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                            title="Delete Vehicle"
                          >
                            <TrashIcon size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-3 py-3">APK Expiry</th>
                    <th className="px-3 py-3">Insurance</th>
                    <th className="px-3 py-3">ILT</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {vehicleList.map((veh) => (
                    <tr key={veh.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-zinc-950 truncate max-w-[180px]">{veh.name}</td>
                      <td className="px-3 py-3.5 font-mono text-zinc-700">{veh.apkExpiry ?? "—"}</td>
                      <td className="px-3 py-3.5 font-mono text-zinc-700">{veh.insuranceExpiry ?? "—"}</td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${veh.iltPermitStatus === "Valid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                        >
                          {veh.iltPermitStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(veh.id, veh.name)}
                          className="text-zinc-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                          title="Delete Vehicle"
                        >
                          <TrashIcon size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">Fleet Quick Actions</h3>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="w-full bg-zinc-900 hover:bg-black text-white font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-between cursor-pointer"
              >
                <span>[ + Add New Vehicle ]</span>
                <PlusIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(true)}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-between cursor-pointer"
              >
                <span>[ Schedule Service ]</span>
                <ClockIcon size={14} />
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-between cursor-pointer"
              >
                <span>[ Export Fleet CSV ]</span>
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 mb-3">Fleet Summary</h3>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 space-y-2 text-xs font-mono">
              {[
                { label: "Total Registered", value: total },
                { label: "Available Now", value: available, cls: "text-emerald-700" },
                { label: "Unavailable / Maint.", value: maintenance, cls: "text-amber-700" },
                { label: "ILT Compliance", value: `${complianceRate}%` },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between border-t border-zinc-200 pt-2 first:border-0 first:pt-0">
                  <span className="text-zinc-500 font-sans">{label}</span>
                  <span className={`font-bold text-zinc-950 ${cls ?? ""}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950 mb-1">Register New Vehicle</h3>
            <p className="text-xs text-zinc-500 mb-4">Add a new executive BEV unit to the fleet telemetry network.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  await addVehicle(new FormData(e.currentTarget));
                  setIsAddModalOpen(false);
                  router.refresh();
                });
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Vehicle Name / Model</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Mercedes-EQS 450+ Luxury Line"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">License Plate</label>
                <input
                  type="text"
                  name="licensePlate"
                  placeholder="e.g. AB-12-CD"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Color</label>
                <input
                  type="text"
                  name="color"
                  placeholder="e.g. Obsidian Black"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Register Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsServiceModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950 mb-1">Schedule Maintenance Service</h3>
            <p className="text-xs text-zinc-500 mb-4">Book routine APK and battery diagnostics for depot vehicles.</p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Service Type</label>
                <select className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-900 focus:outline-none cursor-pointer">
                  <option>Routine APK Inspection &amp; Calibration</option>
                  <option>High-Voltage Battery Diagnostics</option>
                  <option>Tire Pressure &amp; Alignment Service</option>
                  <option>Executive Interior Detailing</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none"
                />
              </div>
              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer"
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}