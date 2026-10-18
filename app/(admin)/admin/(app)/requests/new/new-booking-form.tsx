"use client";

import { useActionState } from "react";
import { AlertIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { createBookingForPartner, type NewBookingState } from "./actions";

type Option = { value: string; label: string };
type Copy = Record<
  | "partner" | "noPartner" | "service" | "collection" | "destination" | "stops" | "pickup" | "passengers" | "vehicle" | "vehicleNone" | "name" | "email"
  | "phone" | "contactHint" | "status" | "quote" | "notes" | "internalNotes" | "submit" | "creating",
  string
>;

type Values = Record<string, string>;

function Select({ values, name, label, options, empty }: { values: Values; name: string; label: string; options: Option[]; empty?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`nb-${name}`} className={fieldLabel}>
        {label}
      </label>
      <select id={`nb-${name}`} name={name} defaultValue={values[name] ?? ""} className={`${field} h-10 cursor-pointer`}>
        {empty !== undefined && <option value="">{empty}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Text({ values, name, label, type = "text", hint }: { values: Values; name: string; label: string; type?: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`nb-${name}`} className={fieldLabel}>
        {label}
      </label>
      <input id={`nb-${name}`} name={name} type={type} defaultValue={values[name] ?? ""} autoComplete="off" className={`${field} h-10`} />
      {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** The team's own booking form: for the phone and email bookings that should still show up in a partner's portal. */
export function NewBookingForm({ partners, services, statuses, vehicles, copy }: { partners: Option[]; services: Option[]; statuses: Option[]; vehicles: Option[]; copy: Copy }) {
  const [state, action, pending] = useActionState<NewBookingState, FormData>(createBookingForPartner, {});
  const v = state.values ?? {};

  return (
    <form key={state.error ?? "new"} action={action} className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <Select values={v} name="contactId" label={copy.partner} options={partners} empty={copy.noPartner} />
      </div>
      <Select values={v} name="service" label={copy.service} options={services} />
      <Text values={v} name="pickupAt" label={copy.pickup} type="datetime-local" />
      <Text values={v} name="collection" label={copy.collection} />
      <Text values={v} name="destination" label={copy.destination} />
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-stops" className={fieldLabel}>
          {copy.stops}
        </label>
        <textarea id="nb-stops" name="stops" rows={2} maxLength={1200} defaultValue={v.stops ?? ""} className={`${field} resize-y py-2.5`} />
      </div>
      <Text values={v} name="passengers" label={copy.passengers} type="number" />
      <Select values={v} name="vehicle" label={copy.vehicle} options={vehicles} empty={copy.vehicleNone} />
      <Text values={v} name="name" label={copy.name} hint={copy.contactHint} />
      <Text values={v} name="email" label={copy.email} type="email" />
      <Text values={v} name="phone" label={copy.phone} type="tel" />
      <Select values={v} name="status" label={copy.status} options={statuses} />
      <Text values={v} name="quotedAmount" label={copy.quote} />
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-notes" className={fieldLabel}>
          {copy.notes}
        </label>
        <textarea id="nb-notes" name="notes" rows={3} maxLength={2000} defaultValue={v.notes ?? ""} className={`${field} resize-y py-2.5`} />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-internalNotes" className={fieldLabel}>
          {copy.internalNotes}
        </label>
        <textarea id="nb-internalNotes" name="internalNotes" rows={3} maxLength={5000} defaultValue={v.internalNotes ?? ""} className={`${field} resize-y py-2.5`} />
      </div>
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200 md:col-span-2">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <div className="md:col-span-2">
        <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg}`}>
          {pending ? copy.creating : copy.submit}
        </button>
      </div>
    </form>
  );
}
