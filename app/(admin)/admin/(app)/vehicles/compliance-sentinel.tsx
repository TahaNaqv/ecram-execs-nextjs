"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClockIcon, PlusIcon, XIcon, TrashIcon } from "../../_components/icons";
import type { VehicleRow } from "@/lib/admin/live-queries";
import { addVehicle, toggleVehicleStatus, deleteVehicle } from "@/lib/admin/vehicle-actions";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";

type VehicleCopy = Dictionary["admin"]["vehicles"];

export function FleetComplianceSentinel({ vehicles, copy }: { vehicles: VehicleRow[]; copy: VehicleCopy }) {
  const router = useRouter();
  const [vehicleList, setVehicleList] = useState<VehicleRow[]>(vehicles);
  const [activeTab, setActiveTab] = useState<"snapshot" | "reminders">("snapshot");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  
  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    licensePlate: string;
    batterySoC: number;
    evRangeKm: number;
    apkExpiry: string;
    insuranceExpiry: string;
    iltPermitStatus: string;
  }>({
    name: "",
    licensePlate: "",
    batterySoC: 100,
    evRangeKm: 400,
    apkExpiry: "",
    insuranceExpiry: "",
    iltPermitStatus: "Valid",
  });

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setVehicleList(vehicles);
  }, [vehicles]);

  const available = vehicleList.filter((v) => v.status === "available").length;
  const maintenance = vehicleList.filter((v) => v.status === "maintenance" || v.status === "unavailable").length;
  const total = vehicleList.length;
  const compliant = vehicleList.filter((vehicle) => vehicle.iltPermitStatus === "Valid").length;
  const complianceRate = total > 0 ? Math.round((compliant / total) * 100) : 0;

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
    if (!confirm(interpolate(copy.removeConfirm, { name }))) return;
    setVehicleList((prev) => prev.filter((v) => v.id !== vehId));
    const formData = new FormData();
    formData.append("id", vehId);
    startTransition(async () => {
      await deleteVehicle(formData);
      router.refresh();
    });
  };

  const handleStartEdit = (veh: VehicleRow) => {
    setEditingId(veh.id);
    setEditForm({
      name: veh.name ?? "",
      licensePlate: veh.licensePlate ?? "",
      batterySoC: veh.batterySoC ?? 100,
      evRangeKm: veh.evRangeKm ?? 400,
      apkExpiry: veh.apkExpiry ?? "",
      insuranceExpiry: veh.insuranceExpiry ?? "",
      iltPermitStatus: veh.iltPermitStatus ?? "Valid",
    });
  };

  const handleSaveEdit = (vehId: string) => {
    setVehicleList((prev) =>
      prev.map((v) => (v.id === vehId ? { ...v, ...editForm } : v))
    );
    setEditingId(null);

    const formData = new FormData();
    formData.append("id", vehId);
    formData.append("name", editForm.name);
    formData.append("licensePlate", editForm.licensePlate);
    formData.append("batterySoC", String(editForm.batterySoC));
    formData.append("evRangeKm", String(editForm.evRangeKm));
    formData.append("apkExpiry", editForm.apkExpiry);
    formData.append("insuranceExpiry", editForm.insuranceExpiry);
    formData.append("iltPermitStatus", editForm.iltPermitStatus);

    startTransition(async () => {
      router.refresh();
    });
  };

  const handleDownloadReport = () => {
    setReportStatus(copy.compilingReport);
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
    setReportStatus(copy.reportDownloaded);
    setTimeout(() => setReportStatus(null), 3000);
  };

  return (
    <div className="space-y-6 relative w-full">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: copy.totalRegistered, value: total, color: "text-zinc-950" },
          { label: copy.availableNow, value: available, color: "text-emerald-600" },
          { label: copy.unavailableMaint, value: maintenance, color: "text-amber-600" },
          { label: copy.iltCompliance, value: `${complianceRate}%`, color: "text-zinc-950" },
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start w-full">
        <div className="xl:col-span-2 rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden w-full">
          <div className="p-5 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/50">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">{copy.telemetryTitle}</h3>
              <p className="text-[11px] text-zinc-500">{copy.telemetryNote}</p>
            </div>
            <div className="flex gap-1 bg-zinc-200/60 p-1 rounded-lg text-xs">
              {(["snapshot", "reminders"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer ${activeTab === tab ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600"}`}
                >
                  {tab === "snapshot" ? copy.tabSnapshot : copy.tabReminders}
                </button>
              ))}
            </div>
          </div>

          {vehicleList.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-400">{copy.emptyFleet}</p>
          ) : activeTab === "snapshot" ? (
            <div className="w-full">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">{copy.colName}</th>
                    <th className="px-3 py-3">{copy.colPlate}</th>
                    <th className="px-3 py-3">{copy.colBattery}</th>
                    <th className="px-3 py-3">{copy.colRange}</th>
                    <th className="px-4 py-3 text-center">{copy.colAvailability}</th>
                    <th className="px-4 py-3 text-right">{copy.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {vehicleList.map((veh) => {
                    const isAvailable = veh.status === "available";
                    const isEditing = editingId === veh.id;
                    return (
                      <tr key={veh.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-zinc-950">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full max-w-[130px] bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            veh.name
                          )}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.licensePlate}
                              onChange={(e) => setEditForm({ ...editForm, licensePlate: e.target.value })}
                              className="w-full max-w-[100px] bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            veh.licensePlate ?? "—"
                          )}
                        </td>
                        <td className="px-3 py-3.5 font-mono">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.batterySoC}
                              onChange={(e) => setEditForm({ ...editForm, batterySoC: Number(e.target.value) })}
                              className="w-16 bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            <span className={veh.batterySoC < 25 ? "text-rose-600 font-bold" : "text-zinc-900"}>
                              {veh.batterySoC}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editForm.evRangeKm}
                              onChange={(e) => setEditForm({ ...editForm, evRangeKm: Number(e.target.value) })}
                              className="w-20 bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            `${veh.evRangeKm} km`
                          )}
                        </td>
                        
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(veh.id, veh.status)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              isAvailable ? "bg-emerald-600" : "bg-zinc-300 hover:bg-zinc-400"
                            }`}
                            title={isAvailable ? copy.setUnavailable : copy.setAvailable}
                          >
                            <span
                              className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
                                isAvailable ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(veh.id)}
                                className="text-emerald-600 font-semibold hover:underline cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-zinc-500 hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(veh)}
                                className="text-blue-600 font-medium hover:underline cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(veh.id, veh.name)}
                                className="text-zinc-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                                title={copy.deleteVehicle}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">{copy.colVehicle}</th>
                    <th className="px-3 py-3">{copy.colApk}</th>
                    <th className="px-3 py-3">{copy.colInsurance}</th>
                    <th className="px-3 py-3">{copy.colIlt}</th>
                    <th className="px-4 py-3 text-right">{copy.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {vehicleList.map((veh) => {
                    const isEditing = editingId === veh.id;
                    return (
                      <tr key={veh.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="px-4 py-3.5 font-medium text-zinc-950">{veh.name}</td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.apkExpiry}
                              onChange={(e) => setEditForm({ ...editForm, apkExpiry: e.target.value })}
                              className="bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            veh.apkExpiry ?? "—"
                          )}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.insuranceExpiry}
                              onChange={(e) => setEditForm({ ...editForm, insuranceExpiry: e.target.value })}
                              className="bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            />
                          ) : (
                            veh.insuranceExpiry ?? "—"
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {isEditing ? (
                            <select
                              value={editForm.iltPermitStatus}
                              onChange={(e) => setEditForm({ ...editForm, iltPermitStatus: e.target.value })}
                              className="bg-white border border-zinc-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="Valid">Valid</option>
                              <option value="Pending">Pending</option>
                              <option value="Expired">Expired</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${veh.iltPermitStatus === "Valid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                            >
                              {veh.iltPermitStatus === "Valid" ? copy.permitValid : veh.iltPermitStatus}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(veh.id)}
                                className="text-emerald-600 font-semibold hover:underline cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-zinc-500 hover:underline cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(veh)}
                                className="text-blue-600 font-medium hover:underline cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(veh.id, veh.name)}
                                className="text-zinc-400 hover:text-rose-600 p-1 rounded transition cursor-pointer"
                                title={copy.deleteVehicle}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick actions sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">{copy.quickActions}</h3>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="w-full bg-zinc-900 hover:bg-black text-white font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-between cursor-pointer"
              >
                <span>{copy.addVehicleAction}</span>
                <PlusIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsServiceModalOpen(true)}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-between cursor-pointer"
              >
                <span>{copy.scheduleService}</span>
                <ClockIcon size={14} />
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-semibold py-2.5 px-4 rounded-xl transition flex items-center justify-between cursor-pointer"
              >
                <span>{copy.exportCsv}</span>
                <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 mb-3">{copy.summaryTitle}</h3>
            <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100 space-y-2 text-xs font-mono">
              {[
                { label: copy.totalRegistered, value: total },
                { label: copy.availableNow, value: available, cls: "text-emerald-700" },
                { label: copy.unavailableMaint, value: maintenance, cls: "text-amber-700" },
                { label: copy.iltCompliance, value: `${complianceRate}%` },
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
            <h3 className="text-base font-semibold text-zinc-950 mb-1">{copy.registerTitle}</h3>
            <p className="text-xs text-zinc-500 mb-4">{copy.registerNote}</p>
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
                <label className="block font-medium text-zinc-700 mb-1">{copy.labelModel}</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder={copy.modelPlaceholder}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.labelPlate}</label>
                <input
                  type="text"
                  name="licensePlate"
                  required
                  placeholder={copy.platePlaceholder}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.labelColor}</label>
                <input
                  type="text"
                  name="color"
                  placeholder={copy.colorPlaceholder}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1" htmlFor="vehicle-apk-expiry">
                    {copy.colApk}
                  </label>
                  <input
                    id="vehicle-apk-expiry"
                    type="date"
                    name="apkExpiry"
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 mb-1" htmlFor="vehicle-insurance-expiry">
                    {copy.colInsurance}
                  </label>
                  <input
                    id="vehicle-insurance-expiry"
                    type="date"
                    name="insuranceExpiry"
                    className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-4 py-2 rounded-xl cursor-pointer"
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isPending ? copy.saving : copy.registerCta}
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
            <h3 className="text-base font-semibold text-zinc-950 mb-1">{copy.serviceTitle}</h3>
            <p className="text-xs text-zinc-500 mb-4">{copy.serviceNote}</p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.serviceType}</label>
                <select className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-zinc-900 focus:outline-none cursor-pointer">
                  <option>{copy.serviceApk}</option>
                  <option>{copy.serviceBattery}</option>
                  <option>{copy.serviceTyres}</option>
                  <option>{copy.serviceDetail}</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.scheduledDate}</label>
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
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2 rounded-xl cursor-pointer"
                >
                  {copy.confirmBooking}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}