import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { formatBoardClock, type BoardAssignment, type BoardBreak, type BoardShift, type DriverOption, type VehicleOption } from "@/lib/admin/driver-board";
import { utcToAmsterdamParts } from "@/lib/drivers/time";
import { btn, Card, CardHeader, field, fieldLabel } from "../../_components/ui";
import { adjustDriverShift, assignDriverVehicle, removeDriverAssignment, removeDriverBreak, saveDriverBreak } from "./actions";

type Copy = Dictionary["admin"]["drivers"];

const compact = "inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs font-medium";

const toneClass = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-800 ring-red-200",
} as const;

export function AssignmentBoard({
  date,
  locale,
  drivers,
  vehicles,
  assignments,
  breaks,
  shifts,
  copy: t,
}: {
  date: string;
  locale: string;
  drivers: DriverOption[];
  vehicles: VehicleOption[];
  assignments: BoardAssignment[];
  breaks: BoardBreak[];
  shifts: BoardShift[];
  copy: Copy;
}) {
  const toneLabel = { green: t.breakMet, yellow: t.breakShort, red: t.breakMissing };
  return (
    <div className="mt-6 flex flex-col gap-6">
      <Card>
        <CardHeader title={t.assignTitle} description={t.assignNote} />
        <form action={assignDriverVehicle} className="grid gap-4 p-5 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t.driverLabel}</span>
            <select name="driverId" required className={`${field} h-10`}>
              <option value="">{t.chooseDriver}</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t.vehicleLabel}</span>
            <select name="vehicleId" required className={`${field} h-10`}>
              <option value="">{t.chooseVehicle}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t.dateLabel}</span>
            <input type="date" name="date" required defaultValue={date} className={`${field} h-10 w-full`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.startLabel}</span>
              <input type="time" name="start" required defaultValue="08:00" className={`${field} h-10 w-full`} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.endLabel}</span>
              <input type="time" name="end" defaultValue="18:00" className={`${field} h-10 w-full`} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-800 lg:col-span-2">
            <input type="checkbox" name="entireShift" />
            {t.entireShift}
          </label>
          <label className="flex flex-col gap-1.5 lg:col-span-2">
            <span className={fieldLabel}>{t.notesLabel}</span>
            <input name="notes" className={`${field} h-10 w-full`} />
          </label>
          <div>
            <button className={`${compact} border border-zinc-200 bg-white text-zinc-900`}>{t.saveAssignment}</button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title={t.dailyTitle}
          description={t.dailyNote}
          actions={
            <Link href={`/admin/requests/schedule?date=${date}`} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
              {t.openCalendar}
            </Link>
          }
        />
        <form action="/admin/drivers" className="flex flex-wrap items-end gap-3 px-5 pt-4">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{t.dateLabel}</span>
            <input type="date" name="date" defaultValue={date} className={`${field} h-10 w-full`} />
          </label>
          <button className={`${compact} border border-zinc-200 bg-white text-zinc-900`}>{t.showDay}</button>
        </form>
        {assignments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">{t.noAssignments}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 px-5 py-2">
            {assignments.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-950">{row.pair}</p>
                  <p className="text-xs text-zinc-500">
                    {formatBoardClock(row.start, locale)}–{formatBoardClock(row.end, locale)}
                    {row.isEntireShift ? ` · ${t.entireShift}` : ""}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {t.worked}: {row.workedMin} {t.minutes} · {t.breaks}: {row.breakMin} {t.minutes}
                    {row.requiredMin ? ` · ${t.required}: ${row.requiredMin} ${t.minutes}` : ""}
                    {row.blockCount ? ` · ${row.blockCount} ${t.breakBlocks}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${toneClass[row.compliance]}`}>{toneLabel[row.compliance]}</span>
                  <form action={removeDriverAssignment}>
                    <input type="hidden" name="assignmentId" value={row.id} />
                    <button className={`${compact} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200`}>{t.removeAssignment}</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={t.breakTitle} description={t.breakNote} />
          <form action={saveDriverBreak} className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={fieldLabel}>{t.driverLabel}</span>
              <select name="driverId" required className={`${field} h-10 w-full`}>
                <option value="">{t.chooseDriver}</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="date" value={date} />
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.startLabel}</span>
              <input type="time" name="start" required className={`${field} h-10 w-full`} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={fieldLabel}>{t.endLabel}</span>
              <input type="time" name="end" required className={`${field} h-10 w-full`} />
            </label>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={fieldLabel}>{t.notesLabel}</span>
              <input name="notes" className={`${field} h-10 w-full`} />
            </label>
            <div>
              <button className={`${compact} border border-zinc-200 bg-white text-zinc-900`}>{t.saveBreak}</button>
            </div>
          </form>
          {breaks.length > 0 && (
            <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
              {breaks.map((block) => (
                <li key={block.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <p className="min-w-0 text-sm text-zinc-800">
                    {block.driverName} · {formatBoardClock(block.start, locale)}–{formatBoardClock(block.end, locale)}
                    {block.notes ? ` · ${block.notes}` : ""}
                  </p>
                  <form action={removeDriverBreak}>
                    <input type="hidden" name="breakId" value={block.id} />
                    <button className={`${compact} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200`}>{t.removeBreak}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={t.shiftTitle} description={t.shiftNote} />
          {shifts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">{t.noShifts}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {shifts.map((shift) => {
                const start = utcToAmsterdamParts(shift.start);
                const end = shift.end ? utcToAmsterdamParts(shift.end) : start;
                return (
                  <li key={shift.id} className="px-5 py-3">
                    <form action={adjustDriverShift} className="grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="shiftId" value={shift.id} />
                      <p className="text-sm font-medium text-zinc-950 sm:col-span-2">{shift.driverName}</p>
                      <label className="flex flex-col gap-1">
                        <span className={fieldLabel}>{t.startLabel}</span>
                        <input type="date" name="startDate" defaultValue={start.date} required className={`${field} h-10 w-full`} />
                        <input type="time" name="startTime" defaultValue={start.time} required className={`${field} h-10 w-full`} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={fieldLabel}>{t.endLabel}</span>
                        <input type="date" name="endDate" defaultValue={end.date} className={`${field} h-10 w-full`} />
                        <input type="time" name="endTime" defaultValue={shift.end ? end.time : ""} className={`${field} h-10 w-full`} />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className={fieldLabel}>{t.statusLabel}</span>
                        <select name="status" defaultValue={shift.status} className={`${field} h-10 w-full`}>
                          <option value="active">{t.statusActive}</option>
                          <option value="completed">{t.statusCompleted}</option>
                          <option value="auto_closed">{t.statusAuto}</option>
                        </select>
                      </label>
                      <div className="flex items-end">
                        <button className={`${compact} border border-zinc-200 bg-white text-zinc-900`}>{t.saveShift}</button>
                      </div>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
