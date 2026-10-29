"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertIcon, CheckIcon, ChevronDownIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { assignVehicle, type AssignState } from "./assign-vehicle-action";

type Props = {
  id: string;
  /** The booking's car as stored: a fleet key, "advise", or nothing */
  vehicle: string;
  confirmed: boolean;
  scheduleHref: string | null;
  cars: { key: string; name: string }[];
  copy: { carNote: string; carLabel: string; carNone: string; carAdvise: string; carSave: string; carSaving: string; carSaved: string; carHeld: string; carSeeSchedule: string };
};

/** Gives the booking its car. A confirmed booking holds the car on the day schedule; the server refuses a car that is taken. */
export function AssignVehicle({ id, vehicle, confirmed, scheduleHref, cars, copy }: Props) {
  const [state, action, pending] = useActionState<AssignState, FormData>(assignVehicle, {});
  return (
    <form action={action} className="flex flex-col gap-3 p-5">
      <input type="hidden" name="id" value={id} />
      <p className="m-0 text-[13px] leading-relaxed text-zinc-600">{copy.carNote}</p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="car-for-booking" className={fieldLabel}>
          {copy.carLabel}
        </label>
        <div className="relative">
          <select id="car-for-booking" name="vehicle" defaultValue={vehicle} key={vehicle} className={`${field} h-10 cursor-pointer appearance-none pr-9`}>
            <option value="">{copy.carNone}</option>
            <option value="advise">{copy.carAdvise}</option>
            {cars.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
        {pending ? copy.carSaving : copy.carSave}
      </button>
      <p aria-live="polite" className="m-0 flex min-h-5 flex-wrap items-center gap-x-3 text-[13px]">
        {state.ok && !pending && (
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckIcon size={14} /> {copy.carSaved}
          </span>
        )}
        {confirmed && scheduleHref && (
          <Link href={scheduleHref} className="text-zinc-600 underline-offset-2 hover:text-zinc-950 hover:underline">
            {copy.carHeld} · {copy.carSeeSchedule}
          </Link>
        )}
      </p>
    </form>
  );
}
