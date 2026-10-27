"use client";

import { interpolate } from "@/lib/i18n/interpolate";
import { useState, useActionState, useEffect, useRef } from "react";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { AlertIcon, PlusIcon, XIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { createBookingForPartner, type NewBookingState } from "./actions";

type Option = { value: string; label: string };
type Copy = Record<
  | "partner" | "noPartner" | "service" | "collection" | "destination" | "stops" | "pickup" | "passengers" | "vehicle" | "vehicleNone" | "name" | "email"
  | "phone" | "phoneCountry" | "contactHint" | "language" | "notifyClient" | "notifyClientHint" | "status" | "quote" | "notes" | "internalNotes" | "submit" | "creating" | "addStop" | "removeStop" | "stopN" | "unavailable",
  string
>;

type Values = Record<string, string | string[] | undefined>;

function Select({ values, name, label, options, empty, className = "" }: { values: Values; name: string; label: string; options: Option[]; empty?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={`nb-${name}`} className={fieldLabel}>
        {label}
      </label>
      <select id={`nb-${name}`} name={name} defaultValue="" className={`${field} h-10 cursor-pointer w-full`}>
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

function Text({ values, name, label, type = "text", hint, className = "" }: { values: Values; name: string; label: string; type?: string; hint?: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={`nb-${name}`} className={fieldLabel}>
        {label}
      </label>
      <input id={`nb-${name}`} name={name} type={type} defaultValue="" autoComplete="off" className={`${field} h-10 w-full`} />
      {hint && <p className="m-0 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** The team's own booking form: for the phone and email bookings that should still show up in a partner's portal. */
export function NewBookingForm({ partners, services, statuses, vehicles, copy, locale, dateTimeCopy }: { partners: Option[]; services: Option[]; statuses: Option[]; vehicles: Option[]; copy: Copy; locale: string; dateTimeCopy: DateTimeCopy }) {
  const [state, action, pending] = useActionState<NewBookingState, FormData>(createBookingForPartner, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [phoneCountry, setPhoneCountry] = useState("31");
  const [destinations, setDestinations] = useState<string[]>([""]);

  // Clear form fields whenever the component mounts / user navigates back to this tab
  useEffect(() => {
    if (formRef.current) {
      formRef.current.reset();
      setDestinations([""]);
      setPhoneCountry("31");
    }
  }, []);

  const addDestination = () => {
    if (destinations.length < 5) {
      setDestinations((prev) => [...prev, ""]);
    }
  };
  const removeDestination = (index: number) => setDestinations((prev) => prev.filter((_, i) => i !== index));
  const updateDestination = (index: number, val: string) => {
    setDestinations((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  return (
    <form ref={formRef} action={action} className="grid gap-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <Select values={{}} name="contactId" label={copy.partner} options={partners} empty={copy.noPartner} />
      </div>
      <Text values={{}} name="entity" label="Company / Entity (Optional)" hint="Auto-filled from partner if selected" />
      <Text values={{}} name="entityKvk" label="KVK / Chamber of Commerce (Optional)" />
      <Select values={{}} name="service" label={copy.service} options={services} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nb-pickupAt" className={fieldLabel}>
          {copy.pickup}
        </label>
        <DateTimeField id="nb-pickupAt" name="pickupAt" allowTyping locale={locale} copy={dateTimeCopy} defaultValue="" className={`${field} h-10`} />
      </div>
      <Text values={{}} name="collection" label={copy.collection} className="md:col-span-2" />

      {/* Dynamic Destinations Section (Max 5 stops) */}
      <div className="flex flex-col gap-2.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <label className={fieldLabel}>{copy.destination}</label>
          {destinations.length < 5 && (
            <button
              type="button"
              onClick={addDestination}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-900 hover:text-zinc-950"
            >
              <PlusIcon size={13} />
              <span>{copy.addStop}</span>
            </button>
          )}
        </div>

        {destinations.map((dest, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              name="destinations"
              type="text"
              value={dest}
              onChange={(e) => updateDestination(index, e.target.value)}
              placeholder={index === 0 ? copy.destination : interpolate(copy.stopN, { number: index })}
              autoComplete="off"
              className={`${field} h-10 flex-1`}
            />
            {destinations.length > 1 && (
              <button
                type="button"
                onClick={() => removeDestination(index)}
                aria-label={copy.removeStop}
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        ))}
        {destinations.length > 1 && <p className="m-0 text-xs text-zinc-500">{copy.stops}</p>}
      </div>

      <Text values={{}} name="passengers" label={copy.passengers} type="number" />
      <Select values={{}} name="vehicle" label={copy.vehicle} options={vehicles} empty={copy.vehicleNone} />
      <Text values={{}} name="name" label={copy.name} hint={copy.contactHint} />
      <Text values={{}} name="email" label={copy.email} type="email" />

      {/* Contact phone field: compact country select + phone input together in column 1 */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="nb-phone" className={fieldLabel}>
          {copy.phone}
        </label>
        <div className="flex w-full items-center gap-2">
          <select
            id="nb-phoneCountry"
            name="phoneCountry"
            aria-label={copy.phoneCountry}
            value={phoneCountry}
            onChange={(e) => {
              setPhoneCountry(e.target.value);
              const typed = document.getElementById("nb-phone");
              if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, e.target.value);
            }}
            style={{ width: "120px", minWidth: "120px" }}
            className={`${field} h-10 cursor-pointer`}
          >
            {COUNTRY_CODES.map(([code, iso]) => (
              <option key={code} value={code}>
                {iso} +{code}
              </option>
            ))}
          </select>
          <input
            id="nb-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            maxLength={PASTE_MAX}
            onInput={(e) => {
              const target = e.target as HTMLInputElement;
              target.value = cleanPhoneInput(target.value, phoneCountry);
            }}
            defaultValue=""
            autoComplete="off"
            placeholder="612345678"
            className={`${field} h-10 min-w-0 flex-1`}
          />
        </div>
      </div>

      {/* Status field in column 2 on the same row */}
      <Select values={{}} name="status" label={copy.status} options={statuses} />

      <Select values={{}} name="locale" label={copy.language} options={[{ value: "nl", label: "Nederlands" }, { value: "en", label: "English" }]} />
      <label className="flex items-start gap-2.5 self-end pb-2 text-sm text-zinc-900">
        <input type="checkbox" name="notifyClient" defaultChecked={true} className="mt-0.5 size-4 accent-zinc-950" />
        <span>
          {copy.notifyClient}
          <span className="block text-xs text-zinc-500">{copy.notifyClientHint}</span>
        </span>
      </label>

      <Text values={{}} name="quotedAmount" label={copy.quote} className="md:col-span-2" />
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-notes" className={fieldLabel}>
          {copy.notes}
        </label>
        <textarea id="nb-notes" name="notes" rows={3} maxLength={2000} defaultValue="" className={`${field} resize-y py-2.5`} />
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <label htmlFor="nb-internalNotes" className={fieldLabel}>
          {copy.internalNotes}
        </label>
        <textarea id="nb-internalNotes" name="internalNotes" rows={3} maxLength={5000} defaultValue="" className={`${field} resize-y py-2.5`} />
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