"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { ActionForm } from "../../_components/action-feedback";
import { AdminDateField, AdminSelect } from "../../_components/admin-fields";
import { btn, fieldLabel } from "../../_components/ui";
import { assignDriverVehicle } from "./actions";

/** A driver–vehicle link on the board, in Amsterdam wall time ("YYYY-MM-DDTHH:MM"), so the form can leave out busy cars. */
export type BoardLink = { driverId: string; driverName: string; vehicleId: string; start: string; end: string };

/** Quarter-hour times of day, "00:00" to "23:45". */
const SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);
const SHIFT_HOURS = 10;

/** The wall-clock end of a whole shift: the start plus ten hours, which can be the next day. */
function shiftEnd(date: string, start: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = start.split(":").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, h + SHIFT_HOURS, min));
  return at.toISOString().slice(0, 16);
}

export function LinkVehicleForm({
  driverId,
  date,
  today,
  drivers,
  vehicles,
  links,
  t,
  dateCopy,
  locale,
  onDone,
}: {
  driverId: string;
  date: string;
  today: string;
  drivers: { id: string; name: string }[];
  vehicles: { id: string; label: string }[];
  links: BoardLink[];
  t: Dictionary["admin"]["drivers"];
  dateCopy: { chooseDate: string; previousMonth: string; nextMonth: string };
  locale: Locale;
  onDone: () => void;
}) {
  const [driver, setDriver] = useState(driverId);
  const [vehicle, setVehicle] = useState("");
  const [day, setDay] = useState(date < today ? today : date);
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:00");
  const [entire, setEntire] = useState(false);

  // Only times after the start, and at most ten hours on, can end the link; a whole shift ends ten hours on, the next day if need be
  const minutesOf = (slot: string) => Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3));
  const endChoices = SLOTS.filter((slot) => slot > start && minutesOf(slot) - minutesOf(start) <= SHIFT_HOURS * 60);
  const endTime = entire ? null : endChoices.includes(end) ? end : (endChoices[0] ?? null);
  const from = `${day}T${start}`;
  const to = entire ? shiftEnd(day, start) : endTime ? `${day}T${endTime}` : null;

  // A car or a driver already linked for any part of this window cannot be linked again
  const overlapping = to ? links.filter((link) => link.start < to && link.end > from) : [];
  const busyCars = new Map(overlapping.map((link) => [link.vehicleId, link.driverName]));
  const driverBusy = overlapping.some((link) => link.driverId === driver);
  const freeCars = vehicles.filter((car) => !busyCars.has(car.id));
  const chosenCar = busyCars.has(vehicle) ? "" : vehicle;
  const ready = Boolean(driver && chosenCar && day && to && !driverBusy);

  return (
    <ActionForm action={assignDriverVehicle} tone="status" success={t.linkSaved} inline={t.linkSavedShort} className="grid gap-3" onDone={onDone}>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{t.driverLabel}</span>
        <AdminSelect name="driverId" value={driver} onChange={setDriver} options={[{ value: "", label: t.chooseDriver }, ...drivers.map((d) => ({ value: d.id, label: d.name }))]} />
        {driverBusy ? <p className="m-0 text-[12px] text-red-700">{t.driverBusy}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{t.vehicleLabel}</span>
        <AdminSelect name="vehicleId" value={chosenCar} onChange={setVehicle} options={[{ value: "", label: t.chooseVehicle }, ...freeCars.map((car) => ({ value: car.id, label: car.label }))]} />
        {busyCars.size > 0 ? (
          <p className="m-0 text-[12px] text-zinc-500">
            {interpolate(t.carsBusy, { cars: vehicles.filter((car) => busyCars.has(car.id)).map((car) => `${car.label} (${busyCars.get(car.id)})`).join(", ") })}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{t.dateLabel}</span>
        <AdminDateField name="date" value={day} onChange={setDay} min={today} locale={locale} copy={dateCopy} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className={fieldLabel}>{t.startLabel}</span>
          <AdminSelect name="start" value={start} onChange={setStart} options={SLOTS.map((slot) => ({ value: slot, label: slot }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={fieldLabel}>{t.endLabel}</span>
          {entire ? (
            <p className="m-0 flex h-[42px] items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-600">
              {to ? `${to.slice(11)}${to.slice(0, 10) !== day ? ` ${t.linkNextDay}` : ""}` : "—"}
            </p>
          ) : endTime ? (
            <AdminSelect name="end" value={endTime} onChange={setEnd} options={endChoices.map((slot) => ({ value: slot, label: slot }))} />
          ) : (
            <p className="m-0 text-[12px] text-red-700">{t.endAfterStart}</p>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-800">
        <input type="checkbox" name="entireShift" checked={entire} onChange={(event) => setEntire(event.target.checked)} />
        {t.entireShift}
      </label>
      <button disabled={!ready} className={`${btn.base} ${btn.primary} ${btn.md} w-fit`}>{t.saveAssignment}</button>
    </ActionForm>
  );
}
