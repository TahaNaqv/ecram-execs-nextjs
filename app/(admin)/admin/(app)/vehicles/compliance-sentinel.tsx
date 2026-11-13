"use client";

import { useTransition, useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminDateField, AdminSelect, type AdminDateCopy } from "../../_components/admin-fields";
import { ClockIcon, PlusIcon, XIcon, TrashIcon } from "../../_components/icons";
import type { VehicleRow } from "@/lib/admin/live-queries";
import { addVehicle, toggleVehicleStatus, deleteVehicle } from "@/lib/admin/vehicle-actions";
import { refreshOnce } from "@/lib/nav/refresh-once";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { amsterdamToday } from "@/lib/admin/financials-shared";

type VehicleCopy = Dictionary["admin"]["vehicles"];

const labelClass = "mb-1.5 block text-[13px] font-medium leading-5 text-zinc-700";
const fieldClass =
  "box-border h-10 w-full min-w-0 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 shadow-sm transition placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-950/10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const ghostButton =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50";
const solidButton =
  "inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

function PhotographField({
  label,
  hint,
  choose,
  drop,
  existing,
}: {
  label: string;
  hint: string;
  choose: string;
  drop: string;
  existing: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((file) => file.size > 0).slice(0, 8);
    const transfer = new DataTransfer();
    for (const file of files) transfer.items.add(file);
    if (inputRef.current) inputRef.current.files = transfer.files;
    setNames(files.map((file) => file.name));
  };

  return (
    <div className="min-w-0">
      <span className={labelClass}>{label}</span>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        className={`rounded-xl border border-dashed px-4 py-4 transition ${over ? "border-zinc-950 bg-zinc-100" : "border-zinc-300 bg-zinc-50"}`}
      >
        <input
          ref={inputRef}
          id="vehicle-images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => take(event.target.files)}
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full cursor-pointer items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-950">{choose}</span>
            <span className="mt-0.5 block text-[12px] leading-5 text-zinc-500">{names.length > 0 ? names.join(", ") : drop}</span>
          </span>
        </button>
      </div>
      <p className="m-0 mt-2 text-[12px] leading-5 text-zinc-500">{hint}</p>
      {existing.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {existing.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover ring-1 ring-zinc-200" />
          ))}
        </div>
      )}
    </div>
  );
}

const dateTag = (locale: Locale) => (locale === "nl" ? "nl-NL" : "en-GB");

function formatStoredDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat(dateTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
}

export function FleetComplianceSentinel({
  vehicles,
  copy,
  locale,
  dateCopy,
}: {
  vehicles: VehicleRow[];
  copy: VehicleCopy;
  locale: Locale;
  dateCopy: AdminDateCopy;
}) {
  const router = useRouter();
  const [vehicleList, setVehicleList] = useState<VehicleRow[]>(vehicles);
  const [activeTab, setActiveTab] = useState<"snapshot" | "reminders">("snapshot");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editor, setEditor] = useState<VehicleRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
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
  const [serviceType, setServiceType] = useState(copy.serviceApk);
  const permitOptions = [
    { value: "Valid", label: copy.permitValid },
    { value: "Pending", label: copy.permitPending },
    { value: "Expired", label: copy.permitExpired },
  ];
  const permitLabel = (status: string) => permitOptions.find((option) => option.value === status)?.label ?? status;
  const [serviceDate, setServiceDate] = useState("");
  // Today's Dutch calendar day, read after mount so a prerendered page does not lock in a stale or UTC day.
  useLayoutEffect(() => {
    setServiceDate(amsterdamToday());
  }, []);

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
      refreshOnce(router);
    });
  };

  const handleDelete = (vehId: string, name: string) => {
    setPendingDelete({ id: vehId, name });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    setVehicleList((prev) => prev.filter((v) => v.id !== id));
    const formData = new FormData();
    formData.append("id", id);
    startTransition(async () => {
      await deleteVehicle(formData);
      refreshOnce(router);
    });
  };

  useEffect(() => {
    if (!pendingDelete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingDelete(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingDelete]);

  const openEditor = (veh: VehicleRow | null) => {
    setEditor(veh);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleStartEdit = (veh: VehicleRow) => {
    openEditor(veh);
    setEditingId(null);
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
      refreshOnce(router);
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
      <div className="grid w-full grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
        <div className="flex h-full min-h-[32rem] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm xl:col-span-2">
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
            <div className="max-h-[70vh] w-full overflow-y-auto">
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
            <div className="max-h-[70vh] w-full overflow-y-auto">
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
                            <AdminDateField
                              compact
                              placement="above"
                              locale={locale}
                              copy={dateCopy}
                              value={editForm.apkExpiry}
                              onChange={(apkExpiry) => setEditForm({ ...editForm, apkExpiry })}
                            />
                          ) : (
                            formatStoredDate(veh.apkExpiry, locale)
                          )}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">
                          {isEditing ? (
                            <AdminDateField
                              compact
                              placement="above"
                              locale={locale}
                              copy={dateCopy}
                              value={editForm.insuranceExpiry}
                              onChange={(insuranceExpiry) => setEditForm({ ...editForm, insuranceExpiry })}
                            />
                          ) : (
                            formatStoredDate(veh.insuranceExpiry, locale)
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {isEditing ? (
                            <AdminSelect
                              compact
                              placement="above"
                              value={editForm.iltPermitStatus}
                              onChange={(iltPermitStatus) => setEditForm({ ...editForm, iltPermitStatus })}
                              options={permitOptions}
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${veh.iltPermitStatus === "Valid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                            >
                              {permitLabel(veh.iltPermitStatus ?? "")}
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

        {/* Quick actions first, summary underneath — fills the column without a blank gap. */}
        <div className="flex h-full min-h-0 flex-col gap-6">
          <div className="flex flex-1 flex-col space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">{copy.quickActions}</h3>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={() => openEditor(null)}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-zinc-900 px-4 py-2.5 font-semibold text-white transition hover:bg-black"
              >
                <span>{copy.addVehicleAction}</span>
                <PlusIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setServiceDate(amsterdamToday());
                  setIsServiceModalOpen(true);
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-zinc-100 px-4 py-2.5 font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                <span>{copy.scheduleService}</span>
                <ClockIcon size={14} />
              </button>
              <button
                type="button"
                onClick={handleDownloadReport}
                className="flex w-full cursor-pointer items-center justify-between rounded-xl bg-zinc-100 px-4 py-2.5 font-semibold text-zinc-900 transition hover:bg-zinc-200"
              >
                <span>{copy.exportCsv}</span>
                <span className="size-2 animate-pulse rounded-full bg-amber-500" />
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-900">{copy.summaryTitle}</h3>
            <div className="space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-4 font-mono text-xs">
              {[
                { label: copy.totalRegistered, value: total },
                { label: copy.availableNow, value: available, cls: "text-emerald-700" },
                { label: copy.unavailableMaint, value: maintenance, cls: "text-amber-700" },
                { label: copy.iltCompliance, value: `${complianceRate}%` },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between border-t border-zinc-200 pt-2 first:border-0 first:pt-0">
                  <span className="font-sans text-zinc-500">{label}</span>
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
          <div className="relative box-border max-h-[min(92svh,44rem)] w-full min-w-0 max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950 mb-1">{editor ? copy.editTitle : copy.registerTitle}</h3>
            <p className="text-xs text-zinc-500 mb-4">{copy.registerNote}</p>
            <form
              key={editor?.id ?? "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                startTransition(async () => {
                  const result = await addVehicle(data);
                  if (result.ok) {
                    setFormError(null);
                    setIsAddModalOpen(false);
                    refreshOnce(router);
                  } else {
                    const message = result.error === "type" ? copy.imageType
                      : result.error === "too-large" ? copy.imageSize
                      : result.error === "rate" ? copy.rateInvalid
                      : result.error === "seats" || result.error === "luggage" ? copy.seatsInvalid
                      : copy.formError;
                    setFormError(message);
                  }
                });
              }}
              className="min-w-0 space-y-4"
            >
              {editor ? <input type="hidden" name="id" value={editor.id} /> : null}
              <div>
                <label className={labelClass} htmlFor="vehicle-name">{copy.labelModel}</label>
                <input
                  id="vehicle-name"
                  type="text"
                  name="name"
                  required
                  placeholder={copy.modelPlaceholder}
                  defaultValue={editor?.name ?? ""}
                  className={fieldClass}
                />
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="vehicle-plate">{copy.labelPlate}</label>
                <input
                  id="vehicle-plate"
                  type="text"
                  name="licensePlate"
                  required
                  placeholder={copy.platePlaceholder}
                  defaultValue={editor?.licensePlate ?? ""}
                  className={`${fieldClass} font-mono`}
                />
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="vehicle-color">{copy.labelColor}</label>
                <input
                  id="vehicle-color"
                  type="text"
                  name="color"
                  placeholder={copy.colorPlaceholder}
                  defaultValue={editor?.color ?? ""}
                  className={fieldClass}
                />
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-apk-expiry">
                    {copy.colApk}
                  </label>
                  <AdminDateField id="vehicle-apk-expiry" name="apkExpiry" placement="above" locale={locale} copy={dateCopy} defaultValue={editor?.apkExpiry ?? ""} />
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-insurance-expiry">
                    {copy.colInsurance}
                  </label>
                  <AdminDateField id="vehicle-insurance-expiry" name="insuranceExpiry" placement="above" locale={locale} copy={dateCopy} defaultValue={editor?.insuranceExpiry ?? ""} />
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-seats">{copy.labelSeats}</label>
                  <input id="vehicle-seats" name="seats" type="number" min={1} max={14} defaultValue={editor?.seats ?? ""} className={fieldClass} />
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-luggage">{copy.labelLuggage}</label>
                  <input id="vehicle-luggage" name="luggage" type="number" min={0} max={30} defaultValue={editor?.luggage ?? ""} className={fieldClass} />
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 items-end gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-rate-weekday">{copy.labelRateWeekday}</label>
                  <input id="vehicle-rate-weekday" name="rateWeekday" inputMode="decimal" defaultValue={editor?.rateWeekday == null ? "" : editor.rateWeekday / 100} className={fieldClass} />
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-rate-saturday">{copy.labelRateSaturday}</label>
                  <input id="vehicle-rate-saturday" name="rateSaturday" inputMode="decimal" defaultValue={editor?.rateSaturday == null ? "" : editor.rateSaturday / 100} className={fieldClass} />
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-rate-sunday">{copy.labelRateSunday}</label>
                  <input id="vehicle-rate-sunday" name="rateSunday" inputMode="decimal" defaultValue={editor?.rateSunday == null ? "" : editor.rateSunday / 100} className={fieldClass} />
                </div>
              </div>
              <p className="-mt-2 m-0 text-[12px] leading-5 text-zinc-500">{copy.rateHint}</p>
              <PhotographField
                label={copy.labelImages}
                hint={copy.imagesHint}
                choose={copy.photosChoose}
                drop={copy.photosDrop}
                existing={editor?.images ?? []}
              />
              {formError ? <p className="m-0 text-[12px] text-rose-700">{formError}</p> : null}
              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={ghostButton}
                >
                  {copy.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className={solidButton}
                >
                  {isPending ? copy.saving : editor ? copy.saveChanges : copy.registerCta}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="relative box-border w-full min-w-0 max-w-md overflow-visible rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl">
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
                <AdminSelect
                  value={serviceType}
                  onChange={setServiceType}
                  options={[copy.serviceApk, copy.serviceBattery, copy.serviceTyres, copy.serviceDetail].map((label) => ({ value: label, label }))}
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">{copy.scheduledDate}</label>
                <AdminDateField value={serviceDate} onChange={setServiceDate} placement="above" locale={locale} copy={dateCopy} />
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

      {pendingDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={copy.cancel}
            className="absolute inset-0 bg-[#081b62]/55 backdrop-blur-sm"
            onClick={() => setPendingDelete(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-vehicle-title"
            className="relative w-full max-w-md rounded-2xl bg-[#081b62] p-6 text-white shadow-2xl"
          >
            <h3 id="delete-vehicle-title" className="font-display text-lg tracking-wide">
              {copy.deleteTitle}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/80">
              {interpolate(copy.deleteNote, { name: pendingDelete.name })}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmDelete}
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-rose-500 px-5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copy.deleteCta}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}