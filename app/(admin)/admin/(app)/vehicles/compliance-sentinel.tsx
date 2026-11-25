"use client";

import Link from "next/link";
import { useTransition, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AdminDateField, AdminSelect, type AdminDateCopy } from "../../_components/admin-fields";
import { ClockIcon, PlusIcon, XIcon, TrashIcon } from "../../_components/icons";
import type { FleetUsage, VehicleRow } from "@/lib/admin/live-queries";
import { addVehicle, toggleVehicleStatus, deleteVehicle } from "@/lib/admin/vehicle-actions";
import { refreshOnce } from "@/lib/nav/refresh-once";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { amsterdamToday } from "@/lib/admin/financials-shared";
import { customerHourly, formatCents, formatCurrency, type DayKind } from "@/lib/pricing/rates";
import { pushToast } from "../../_components/action-feedback";

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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0]?.slice(0, 2) ?? "?");
  return letters.toUpperCase();
}

function VehiclePhoto({ name, src, className, fit = "cover" }: { name: string; src?: string | null; className: string; fit?: "cover" | "contain" }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <span className={`grid place-items-center bg-zinc-100 font-semibold tracking-wide text-zinc-500 ${className}`} aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`bg-zinc-100 ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`} onError={() => setBroken(true)} />
  );
}

function rateFigure(cents: number | null, weekday: number | null, weekend: boolean, copy: VehicleCopy) {
  if (!weekend) return weekday == null ? "—" : `${formatCents(weekday, "nl")}${copy.ratePerHour}`;
  if (weekday == null) return "—";
  if (cents == null || cents === 0 || cents === weekday) return copy.rateFallback;
  return `${formatCents(cents, "nl")}${copy.ratePerHour}`;
}

function shownRate(id: string, day: DayKind, stored: number | null): number | null {
  return customerHourly(id, "public", day) ?? stored;
}

function corporateRate(id: string, day: DayKind, copy: VehicleCopy) {
  const cents = customerHourly(id, "corporate", day);
  if (cents == null) return null;
  return interpolate(copy.rateCorporate, { price: formatCents(cents, "nl") });
}

function AvailabilitySwitch({ on, onClick, onLabel, offLabel }: { on: boolean; onClick: () => void; onLabel: string; offLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${on ? "bg-emerald-600" : "bg-zinc-300 hover:bg-zinc-400"}`}
      title={on ? onLabel : offLabel}
    >
      <span className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function ShowcaseStage({
  vehicle,
  copy,
  usage,
  onToggle,
}: {
  vehicle: VehicleRow;
  copy: VehicleCopy;
  usage: FleetUsage | undefined;
  onToggle: () => void;
}) {
  const [index, setIndex] = useState(0);
  const photos = vehicle.images.length > 0 ? vehicle.images : [null];
  const current = photos[Math.min(index, photos.length - 1)];
  return (
    <div className="flex h-[36rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="flex h-64 shrink-0 items-center justify-center bg-zinc-100 px-4">
        <VehiclePhoto name={vehicle.name} src={current} fit="contain" className="max-h-full max-w-full rounded-xl text-4xl" />
      </div>
      <div className="flex min-w-0 gap-2 overflow-x-auto border-t border-zinc-100 px-3 py-2">
        {photos.map((src, photo) => (
          <button
            key={src ?? `${vehicle.id}-empty`}
            type="button"
            onClick={() => setIndex(photo)}
            className={`shrink-0 cursor-pointer overflow-hidden rounded-lg ring-2 ring-offset-2 ${photo === index ? "ring-zinc-950" : "ring-transparent"}`}
          >
            <VehiclePhoto name={vehicle.name} src={src} className="h-16 w-28" />
          </button>
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-3">
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-900">{copy.labelSeats} {vehicle.seats ?? "—"}</span>
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-900">{copy.labelLuggage} {vehicle.luggage ?? "—"}</span>
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-900">{rateFigure(shownRate(vehicle.id, "weekday", vehicle.rateWeekday), shownRate(vehicle.id, "weekday", vehicle.rateWeekday), false, copy)}</span>
        <Link href="/admin/requests/schedule" className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white">{copy.calendarLink}</Link>
        <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-1">
          <AvailabilitySwitch on={vehicle.status === "available"} onClick={onToggle} onLabel={copy.setUnavailable} offLabel={copy.setAvailable} />
        </span>
      </div>
      <div className="mt-auto grid grid-cols-1 gap-px border-t border-zinc-100 bg-zinc-100 sm:grid-cols-3">
        {[
          { label: copy.metricJourneys, value: String(usage?.completed ?? 0) },
          { label: copy.metricBookings, value: String(usage?.active ?? 0) },
          { label: copy.metricRevenue, value: formatCurrency(usage?.revenue ?? 0) },
        ].map((metric) => (
          <div key={metric.label} className="bg-white px-5 py-4">
            <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{metric.label}</p>
            <p className="m-0 mt-1 text-xl font-semibold tabular-nums text-zinc-950">{metric.value}</p>
          </div>
        ))}
      </div>
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
  usage,
  copy,
  locale,
  dateCopy,
}: {
  vehicles: VehicleRow[];
  usage: Record<string, FleetUsage>;
  copy: VehicleCopy;
  locale: Locale;
  dateCopy: AdminDateCopy;
}) {
  const router = useRouter();
  const [vehicleList, setVehicleList] = useState<VehicleRow[]>(vehicles);
  const [vehicleSource, setVehicleSource] = useState(vehicles);
  if (vehicleSource !== vehicles) {
    setVehicleSource(vehicles);
    setVehicleList(vehicles);
  }
  const [view, setView] = useState<"table" | "showcase" | "apk">("table");
  const [selectedId, setSelectedId] = useState<string | null>(vehicles[0]?.id ?? null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editor, setEditor] = useState<VehicleRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [serviceType, setServiceType] = useState(copy.serviceApk);
  const permitOptions = [
    { value: "Valid", label: copy.permitValid },
    { value: "Pending", label: copy.permitPending },
    { value: "Expired", label: copy.permitExpired },
  ];
  const permitLabel = (status: string) => permitOptions.find((option) => option.value === status)?.label ?? status;
  const [serviceDate, setServiceDate] = useState("");
  const selected = vehicleList.find((vehicle) => vehicle.id === selectedId) ?? vehicleList[0] ?? null;

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
      pushToast("Availability toggled!");
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
      pushToast("Vehicle removed!");
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
      {reportStatus && (
        <div className="bg-zinc-900 text-white px-4 py-3 rounded-xl text-xs font-mono flex items-center gap-2 shadow-lg">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          {reportStatus}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-200/60 p-1 text-xs">
          {([
            ["table", copy.viewTable],
            ["showcase", copy.viewShowcase],
            ["apk", copy.tabReminders],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={`cursor-pointer rounded-md px-3 py-1.5 font-semibold transition ${view === id ? "bg-white text-zinc-950 shadow-xs" : "text-zinc-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openEditor(null)} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800">
            <PlusIcon size={14} />
            {copy.addVehicleAction}
          </button>
          <button
            type="button"
            onClick={() => {
              setServiceDate(amsterdamToday());
              setIsServiceModalOpen(true);
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <ClockIcon size={14} />
            {copy.scheduleService}
          </button>
          <button type="button" onClick={handleDownloadReport} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50">
            {copy.exportCsv}
          </button>
        </div>
      </div>

      <div className="flex min-h-[32rem] w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {vehicleList.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-400">{copy.emptyFleet}</p>
          ) : view === "showcase" && selected ? (
            <div className="grid items-stretch gap-4 bg-zinc-50 p-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="flex h-[36rem] flex-col overflow-y-auto rounded-2xl border border-zinc-200 bg-white">
                {vehicleList.map((veh) => {
                  const on = veh.status === "available";
                  const active = veh.id === selected.id;
                  return (
                    <button
                      key={veh.id}
                      type="button"
                      onClick={() => setSelectedId(veh.id)}
                      className={`flex w-full cursor-pointer items-center gap-3 border-b border-zinc-100 px-3 py-3 text-left last:border-b-0 ${active ? "bg-zinc-50" : "hover:bg-zinc-50/80"}`}
                    >
                      <VehiclePhoto name={veh.name} src={veh.images[0]} className="size-16 shrink-0 rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-sm font-semibold leading-5 text-zinc-950">{veh.name}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                            {on ? copy.statusOn : copy.statusOff}
                          </span>
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-zinc-500">
                          {veh.seats != null ? `${veh.seats} ${copy.labelSeats}` : "—"}
                          {" · "}
                          {veh.luggage != null ? `${veh.luggage} ${copy.labelLuggage}` : "—"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <ShowcaseStage
                key={selected.id}
                vehicle={selected}
                copy={copy}
                usage={usage[selected.id]}
                onToggle={() => handleToggle(selected.id, selected.status)}
              />
            </div>
          ) : view === "table" ? (
            <div className="max-h-[70vh] w-full overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">{copy.colVehicle}</th>
                    <th className="px-3 py-3">{copy.colBattery}</th>
                    <th className="px-3 py-3">{copy.colRange}</th>
                    <th className="px-3 py-3">{copy.colWeekday}</th>
                    <th className="px-3 py-3">{copy.colSaturday}</th>
                    <th className="px-3 py-3">{copy.colSunday}</th>
                    <th className="px-4 py-3 text-center">{copy.colAvailability}</th>
                    <th className="px-4 py-3 text-right">{copy.colAction}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {vehicleList.map((veh) => {
                    const isAvailable = veh.status === "available";
                    return (
                      <tr key={veh.id} className="transition-colors hover:bg-zinc-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <VehiclePhoto name={veh.name} src={veh.images[0]} className="size-12 shrink-0 rounded-lg" />
                            <div className="min-w-0">
                              <p className="m-0 truncate font-medium text-zinc-950">{veh.name}</p>
                              <p className="m-0 mt-0.5 font-mono text-[11px] text-zinc-500">{veh.licensePlate ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 font-mono">
                          <span className={veh.batterySoC < 25 ? "font-bold text-rose-600" : "text-zinc-900"}>{veh.batterySoC}%</span>
                        </td>
                        <td className="px-3 py-3.5 font-mono text-zinc-700">{`${veh.evRangeKm} km`}</td>
                        <td className="px-3 py-3.5 whitespace-nowrap tabular-nums text-zinc-900">
                          <span className="block">{rateFigure(shownRate(veh.id, "weekday", veh.rateWeekday), shownRate(veh.id, "weekday", veh.rateWeekday), false, copy)}</span>
                          {corporateRate(veh.id, "weekday", copy) ? <span className="mt-1 block text-[11px] font-normal text-zinc-500">{corporateRate(veh.id, "weekday", copy)}</span> : null}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap tabular-nums text-zinc-700">
                          <span className="block">{rateFigure(shownRate(veh.id, "saturday", veh.rateSaturday), shownRate(veh.id, "weekday", veh.rateWeekday), true, copy)}</span>
                          {corporateRate(veh.id, "saturday", copy) ? <span className="mt-1 block text-[11px] font-normal text-zinc-500">{corporateRate(veh.id, "saturday", copy)}</span> : null}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap tabular-nums text-zinc-700">
                          <span className="block">{rateFigure(shownRate(veh.id, "sunday", veh.rateSunday), shownRate(veh.id, "weekday", veh.rateWeekday), true, copy)}</span>
                          {corporateRate(veh.id, "sunday", copy) ? <span className="mt-1 block text-[11px] font-normal text-zinc-500">{corporateRate(veh.id, "sunday", copy)}</span> : null}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <AvailabilitySwitch on={isAvailable} onClick={() => handleToggle(veh.id, veh.status)} onLabel={copy.setUnavailable} offLabel={copy.setAvailable} />
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openEditor(veh)}
                              className="text-blue-600 font-medium hover:underline cursor-pointer"
                            >
                              {copy.editTitle}
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
                  {vehicleList.map((veh) => (
                    <tr key={veh.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-zinc-950">{veh.name}</td>
                      <td className="px-3 py-3.5 font-mono text-zinc-700">{formatStoredDate(veh.apkExpiry, locale)}</td>
                      <td className="px-3 py-3.5 font-mono text-zinc-700">{formatStoredDate(veh.insuranceExpiry, locale)}</td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${veh.iltPermitStatus === "Valid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}
                        >
                          {permitLabel(veh.iltPermitStatus ?? "")}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditor(veh)}
                            className="text-blue-600 font-medium hover:underline cursor-pointer"
                          >
                            {copy.editTitle}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
            <h3 className="text-base font-semibold text-zinc-950 mb-4">{editor ? copy.editTitle : copy.registerTitle}</h3>
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
                    pushToast(editor ? "Changes saved!" : "Vehicle saved!");
                    refreshOnce(router);
                  } else {
                    const message = result.error === "type" ? copy.imageType
                      : result.error === "too-large" ? copy.imageSize
                      : result.error === "rate" ? copy.rateInvalid
                      : result.error === "seats" || result.error === "luggage" ? copy.seatsInvalid
                      : copy.formError;
                    setFormError(message);
                    pushToast(message, false);
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
                  <input id="vehicle-seats" name="seats" type="number" min={1} max={16} defaultValue={editor?.seats ?? ""} className={fieldClass} />
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-luggage">{copy.labelLuggage}</label>
                  <input id="vehicle-luggage" name="luggage" type="number" min={0} max={30} defaultValue={editor?.luggage ?? ""} className={fieldClass} />
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-3">
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-rate-weekday">{copy.labelRateWeekday}</label>
                  <input id="vehicle-rate-weekday" name="rateWeekday" inputMode="decimal" placeholder="165.00" defaultValue={editor && shownRate(editor.id, "weekday", editor.rateWeekday) != null ? shownRate(editor.id, "weekday", editor.rateWeekday)! / 100 : ""} className={fieldClass} />
                  {editor && corporateRate(editor.id, "weekday", copy) ? <p className="m-0 mt-1.5 text-[12px] leading-4 text-zinc-600">{corporateRate(editor.id, "weekday", copy)}</p> : null}
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-rate-saturday">{copy.labelRateSaturday}</label>
                  <input id="vehicle-rate-saturday" name="rateSaturday" inputMode="decimal" placeholder="185.00" defaultValue={editor ? (shownRate(editor.id, "saturday", editor.rateSaturday) == null ? "" : shownRate(editor.id, "saturday", editor.rateSaturday)! / 100) : ""} className={fieldClass} />
                  {editor && corporateRate(editor.id, "saturday", copy) ? <p className="m-0 mt-1.5 text-[12px] leading-4 text-zinc-600">{corporateRate(editor.id, "saturday", copy)}</p> : null}
                  <p className="m-0 mt-1.5 text-[12px] leading-4 text-zinc-600">{copy.rateHint}</p>
                </div>
                <div className="min-w-0">
                  <label className={labelClass} htmlFor="vehicle-rate-sunday">{copy.labelRateSunday}</label>
                  <input id="vehicle-rate-sunday" name="rateSunday" inputMode="decimal" placeholder="195.00" defaultValue={editor ? (shownRate(editor.id, "sunday", editor.rateSunday) == null ? "" : shownRate(editor.id, "sunday", editor.rateSunday)! / 100) : ""} className={fieldClass} />
                  {editor && corporateRate(editor.id, "sunday", copy) ? <p className="m-0 mt-1.5 text-[12px] leading-4 text-zinc-600">{corporateRate(editor.id, "sunday", copy)}</p> : null}
                  <p className="m-0 mt-1.5 text-[12px] leading-4 text-zinc-600">{copy.rateHint}</p>
                </div>
              </div>
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
            <h3 className="mb-4 text-base font-semibold text-zinc-950">{copy.serviceTitle}</h3>
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