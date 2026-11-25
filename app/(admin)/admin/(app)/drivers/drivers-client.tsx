"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { SHIFT_MS } from "@/lib/admin/shift";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { ChevronLeftIcon, ChevronRightIcon, NoteIcon, XIcon } from "../../_components/icons";
import { btn, field, fieldLabel, PageBody, PageHeader } from "../../_components/ui";
import { ActionForm } from "../../_components/action-feedback";
import { AddDriverForm } from "./add-driver-form";
import { adjustDriverShift, assignDriverVehicle, endShift, removeDriverAssignment, removeDriverBreak, saveDriverBreak, setDriverActive, startShift, updateDriver } from "./actions";

export type DeskBreak = { id: string; label: string };

export type DeskRow = {
  id: string;
  name: string;
  phone: string | null;
  partner: boolean;
  onShift: boolean;
  startedAt: string | null;
  vehicleLabel: string | null;
  assignmentId: string | null;
  window: string | null;
  entireShift: boolean;
  workedMin: number;
  breakMin: number;
  requiredMin: number;
  compliance: "green" | "yellow" | "red" | null;
  shift: { id: string; status: string; startDate: string; startTime: string; endDate: string; endTime: string } | null;
  breaks: DeskBreak[];
};

const toneClass = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-900 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
} as const;

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}
const nowMs = () => Math.floor(Date.now() / 1000) * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

function hms(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function hoursMinutes(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function DutyClock({ startedAt }: { startedAt: string }) {
  const current = useSyncExternalStore(subscribe, nowMs, () => null);
  if (current === null) return <span role="timer" className="text-sm tabular-nums text-zinc-400">--:--:--</span>;
  const elapsed = Math.max(0, current - new Date(startedAt).getTime());
  const remaining = SHIFT_MS - elapsed;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="text-sm font-medium tabular-nums text-zinc-950">{hoursMinutes(Math.min(elapsed, SHIFT_MS))}</span>
      <span role="timer" className={`text-xs tabular-nums ${remaining <= 0 ? "text-red-700" : "text-zinc-500"}`}>
        {remaining <= 0 ? `+${hms(-remaining)}` : hms(remaining)}
      </span>
    </span>
  );
}

function BreakPill({ row, copy }: { row: DeskRow; copy: Dictionary["admin"]["drivers"] }) {
  if (!row.compliance) return <span className="text-xs text-zinc-400">—</span>;
  const short = Math.max(0, row.requiredMin - row.breakMin);
  const label =
    row.requiredMin === 0 ? copy.noBreakDue : short === 0 ? interpolate(copy.breaksMet, { minutes: row.requiredMin }) : interpolate(copy.needsMore, { minutes: short });
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${toneClass[row.compliance]}`}>{label}</span>;
}

function Dialog({ title, onClose, closeLabel, children }: { title: string; onClose: () => void; closeLabel: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4" role="presentation" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-900" aria-label={closeLabel}>
            <XIcon size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DriversClient({
  date,
  previous,
  next,
  today,
  locale,
  rows,
  archived,
  drivers,
  vehicles,
  appsNew,
  dict,
}: {
  date: string;
  previous: string;
  next: string;
  today: string;
  locale: string;
  rows: DeskRow[];
  archived: { id: string; name: string; phone: string | null }[];
  drivers: { id: string; name: string }[];
  vehicles: { id: string; label: string }[];
  appsNew: number;
  dict: Dictionary["admin"];
}) {
  const t = dict.drivers;
  const [addOpen, setAddOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [entire, setEntire] = useState(false);
  const editing = rows.find((row) => row.id === editId) ?? null;
  const heading = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

  return (
    <PageBody>
      <PageHeader
        title={t.title}
        actions={
          <>
            <Link href="/admin/drivers/applications" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
              <NoteIcon className="text-zinc-500" />
              {dict.nav.applications}
              {appsNew > 0 ? <span className="rounded-full bg-zinc-950 px-1.5 py-px text-[11px] font-semibold text-white">{appsNew}</span> : null}
            </Link>
            <button type="button" onClick={() => { setEntire(false); setLinkFor(""); }} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
              {t.linkDriver}
            </button>
            <button type="button" onClick={() => setAddOpen(true)} className={`${btn.base} ${btn.primary} ${btn.md}`}>
              {t.addDriver}
            </button>
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={`/admin/drivers?date=${previous}`} aria-label={t.prevDay} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
          <ChevronLeftIcon />
        </Link>
        <Link href={`/admin/drivers?date=${today}`} aria-current={date === today ? "date" : undefined} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
          {date === today ? t.today : heading}
        </Link>
        <Link href={`/admin/drivers?date=${next}`} aria-label={t.nextDay} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
          <ChevronRightIcon />
        </Link>
        <form action="/admin/drivers" className="flex items-center gap-2">
          <label htmlFor="drivers-date" className="sr-only">{t.dateLabel}</label>
          <input id="drivers-date" type="date" name="date" defaultValue={date} className={`${field} h-9 w-40`} />
          <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>{t.showDay}</button>
        </form>
        <Link href={`/admin/requests/schedule?date=${date}`} className={`${btn.base} ${btn.ghost} ${btn.md}`}>
          {t.openCalendar}
        </Link>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-zinc-100 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              <th className="px-4 py-3 font-medium">{t.colDriver}</th>
              <th className="px-4 py-3 font-medium">{t.colVehicle}</th>
              <th className="px-4 py-3 font-medium">{t.colShift}</th>
              <th className="px-4 py-3 font-medium">{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">{t.emptyOnShift}</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm font-medium text-zinc-950">{row.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {row.phone ? <a href={`tel:${row.phone.replace(/\s/g, "")}`} className="hover:underline">{row.phone}</a> : t.noPhone}
                      <span className="mx-1.5 text-zinc-300">·</span>
                      <span className={row.onShift ? "text-emerald-700" : "text-zinc-500"}>{row.onShift ? t.activeNow : t.offDuty}</span>
                      {row.partner ? <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 py-px text-[11px] text-zinc-600">{t.partnerBadge}</span> : null}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-sm text-zinc-900">{row.vehicleLabel ?? t.unassigned}</p>
                    {row.window ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {row.window}
                        {row.entireShift ? ` · ${t.entireShift}` : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      {row.onShift && row.startedAt ? <DutyClock startedAt={row.startedAt} /> : <span className="text-sm text-zinc-400">—</span>}
                      <BreakPill row={row} copy={t} />
                      {row.onShift ? (
                        <ActionForm action={endShift} tone="status" success="Shift ended!">
                          <input type="hidden" name="driverId" value={row.id} />
                          <button className={`${btn.base} ${btn.ghost} ${btn.sm} px-0`}>{t.endShift}</button>
                        </ActionForm>
                      ) : (
                        <ActionForm action={startShift} tone="status" success="Shift started!">
                          <input type="hidden" name="driverId" value={row.id} />
                          <button className={`${btn.base} ${btn.ghost} ${btn.sm} px-0`}>{t.startShift}</button>
                        </ActionForm>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setEditId(row.id)} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>{t.edit}</button>
                      <button type="button" onClick={() => { setEntire(false); setLinkFor(row.id); }} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>{t.linkVehicle}</button>
                      <ActionForm action={setDriverActive} tone="delete" success="Deleted!">
                        <input type="hidden" name="driverId" value={row.id} />
                        <input type="hidden" name="active" value="false" />
                        <button className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>{t.remove}</button>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {archived.length > 0 ? (
        <details className="mt-4 rounded-xl border border-zinc-200/80 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-700">{t.archived} · {archived.length}</summary>
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {archived.map((driver) => (
              <li key={driver.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm text-zinc-500">{driver.name}{driver.phone ? ` · ${driver.phone}` : ""}</span>
                <ActionForm action={setDriverActive} tone="status" success="Driver restored!">
                  <input type="hidden" name="driverId" value={driver.id} />
                  <input type="hidden" name="active" value="true" />
                  <button className={`${btn.base} ${btn.secondary} ${btn.sm}`}>{t.restore}</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {addOpen ? (
        <Dialog title={t.registerTitle} closeLabel={t.close} onClose={() => setAddOpen(false)}>
          <AddDriverForm
            onRegistered={() => setAddOpen(false)}
            copy={{
              driverName: dict.common.driverName,
              phone: dict.common.phone,
              namePlaceholder: t.namePlaceholder,
              phonePlaceholder: t.phonePlaceholder,
              adding: t.adding,
              addDriver: t.addDriver,
            }}
          />
        </Dialog>
      ) : null}

      {linkFor !== null ? (
        <Dialog title={t.assignTitle} closeLabel={t.close} onClose={() => setLinkFor(null)}>
          <ActionForm action={assignDriverVehicle} tone="status" success="Driver assigned!" inline="Saved!" className="grid gap-3" onDone={() => setLinkFor(null)}>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.driverLabel}</span>
              <select name="driverId" required defaultValue={linkFor} className={`${field} h-10`}>
                <option value="">{t.chooseDriver}</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.vehicleLabel}</span>
              <select name="vehicleId" required className={`${field} h-10`}>
                <option value="">{t.chooseVehicle}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.dateLabel}</span>
              <input type="date" name="date" required defaultValue={date} className={`${field} h-10`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{t.startLabel}</span>
                <input type="time" name="start" required defaultValue="08:00" className={`${field} h-10`} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{t.endLabel}</span>
                <input type="time" name="end" defaultValue="16:00" disabled={entire} className={`${field} h-10 disabled:bg-zinc-50`} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-800">
              <input type="checkbox" name="entireShift" checked={entire} onChange={(event) => setEntire(event.target.checked)} />
              {t.entireShift}
            </label>
            <button className={`${btn.base} ${btn.primary} ${btn.md} w-fit`}>{t.saveAssignment}</button>
          </ActionForm>
        </Dialog>
      ) : null}

      {editing ? (
        <Dialog title={editing.name} closeLabel={t.close} onClose={() => setEditId(null)}>
          <div className="flex flex-col gap-5">
            <ActionForm action={updateDriver} success="Saved!" inline="Saved!" className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="driverId" value={editing.id} />
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{dict.common.driverName}</span>
                <input name="name" required defaultValue={editing.name} className={`${field} h-10`} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{dict.common.phone}</span>
                <input name="phone" required defaultValue={editing.phone ?? ""} className={`${field} h-10`} />
              </label>
              <button className={`${btn.base} ${btn.secondary} ${btn.md} w-fit`}>{t.edit}</button>
            </ActionForm>
            {editing.shift ? (
              <ActionForm action={adjustDriverShift} success="Shift updated!" inline="Saved!" className="grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
                <input type="hidden" name="shiftId" value={editing.shift.id} />
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>{t.startLabel}</span>
                  <input type="date" name="startDate" required defaultValue={editing.shift.startDate} className={`${field} h-10`} />
                  <input type="time" name="startTime" required defaultValue={editing.shift.startTime} className={`${field} h-10`} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={fieldLabel}>{t.endLabel}</span>
                  <input type="date" name="endDate" defaultValue={editing.shift.endDate} className={`${field} h-10`} />
                  <input type="time" name="endTime" defaultValue={editing.shift.endTime} className={`${field} h-10`} />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className={fieldLabel}>{t.statusLabel}</span>
                  <select name="status" defaultValue={editing.shift.status} className={`${field} h-10`}>
                    <option value="active">{t.statusActive}</option>
                    <option value="completed">{t.statusCompleted}</option>
                    <option value="auto_closed">{t.statusAuto}</option>
                  </select>
                </label>
                <button className={`${btn.base} ${btn.secondary} ${btn.md} w-fit`}>{t.saveShift}</button>
              </ActionForm>
            ) : null}
            <ActionForm action={saveDriverBreak} success="Break saved!" inline="Saved!" className="grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
              <input type="hidden" name="driverId" value={editing.id} />
              <input type="hidden" name="date" value={date} />
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{t.startLabel}</span>
                <input type="time" name="start" required className={`${field} h-10`} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={fieldLabel}>{t.endLabel}</span>
                <input type="time" name="end" required className={`${field} h-10`} />
              </label>
              <button className={`${btn.base} ${btn.secondary} ${btn.md} w-fit`}>{t.saveBreak}</button>
            </ActionForm>
            {editing.breaks.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {editing.breaks.map((block) => (
                  <li key={block.id} className="flex items-center justify-between gap-3 text-sm text-zinc-700">
                    <span>{block.label}</span>
                    <ActionForm action={removeDriverBreak} tone="delete" success="Deleted!">
                      <input type="hidden" name="breakId" value={block.id} />
                      <button className={`${btn.base} ${btn.ghost} ${btn.sm} text-red-700`}>{t.remove}</button>
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : null}
            {editing.assignmentId ? (
              <ActionForm action={removeDriverAssignment} tone="delete" success="Deleted!" className="border-t border-zinc-100 pt-4">
                <input type="hidden" name="assignmentId" value={editing.assignmentId} />
                <button className={`${btn.base} ${btn.ghost} ${btn.sm} px-0 text-red-700`}>{t.removeAssignment}</button>
              </ActionForm>
            ) : null}
          </div>
        </Dialog>
      ) : null}
    </PageBody>
  );
}
