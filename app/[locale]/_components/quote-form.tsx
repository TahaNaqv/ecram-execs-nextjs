"use client";

import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import { useActionState, useEffect, useState, useRef } from "react";
import { COUNTRY_CODES, SERVICES, type Service } from "@/lib/quotes/constants";
import { VEHICLE_CHOICES, type VehicleChoice } from "@/lib/fleet/vehicles";
import { SELECT_VEHICLE_EVENT } from "./book-link";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import Link from "next/link";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import type { QuoteField } from "@/lib/quotes/validation";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";
import { control } from "./form-field";

export type QuoteFormCopy = Record<
  | "labelCollection" | "phCollection" | "labelDestination" | "phDestination" | "labelDateTime"
  | "labelService" | "labelPassengers" | "selectPlaceholder" | "eightOrMore" | "labelName" | "phName"
  | "labelEmail" | "phEmail" | "labelPhoneCountry" | "labelPhone" | "phPhone"
  | "labelVehicle" | "vehicleAdvise" | "removeStop" | "labelStopWait" | "waitNone" | "waitMinutes" | "stopsCount" | "addStop" | "stopoversTitle" | "noStops" | "stopPlaceholder" | "addStopover" | "labelNotes" | "phNotes"
  | "submit" | "sending" | "successLabel" | "successHeading" | "successNote" | "privacyNote" | "privacyLink",
  string
> & { labelAddStop?: string; labelRemoveStop?: string };

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);

export function QuoteForm({
  locale,
  serviceLabels,
  vehicles,
  copy: t,
  dateTimeCopy,
}: {
  locale: Locale;
  serviceLabels: Record<Service, string>;
  vehicles: { key: string; name: string; status: string }[];
  copy: QuoteFormCopy;
  dateTimeCopy: DateTimeCopy;
}) {
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(submitQuote, { status: "idle" });

  const [vehicle, setVehicle] = useState("");
  const [vehicleTouched, setVehicleTouched] = useState(false);

  const [stops, setStops] = useState<{ id: string; value: string; wait: number }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // The stop just added takes focus once; reopening the panel later must not pull focus to the last one again
  const [focusId, setFocusId] = useState<string | undefined>();
  const addStopField = () => {
    const id = Math.random().toString(36).substring(2, 9);
    setFocusId(id);
    setStops((prev) => (prev.length >= MAX_STOPS ? prev : [...prev, { id, value: "", wait: 0 }]));
  };
  // The first press both opens the panel and gives the visitor a stop to type into; pressing again closes it
  const toggleStops = () => {
    if (isOpen) return setIsOpen(false);
    if (stops.length === 0) addStopField();
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const isChoice = (value: string | null): value is VehicleChoice => !!value && (VEHICLE_CHOICES as readonly string[]).includes(value);
    const fromQuery = new URLSearchParams(window.location.search).get("vehicle");
    const initial = isChoice(fromQuery) ? window.setTimeout(() => setVehicle(fromQuery), 0) : undefined;
    const onSelect = (e: Event) => {
      const chosen = (e as CustomEvent<string>).detail;
      if (isChoice(chosen)) {
        setVehicle(chosen);
        setVehicleTouched(true);
        window.setTimeout(() => document.getElementById("q-collection")?.focus({ preventScroll: true }), 600);
      }
    };
    window.addEventListener(SELECT_VEHICLE_EVENT, onSelect);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener(SELECT_VEHICLE_EVENT, onSelect);
    };
  }, []);

  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10 outline-none">
        <ScrollIntoViewOnMount />
        <span className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">
          {t.successLabel} · {state.reference}
        </span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-ink-950">{fill(t.successHeading, { name: state.name })}</p>
        <p className="m-0 text-[14px] text-ink-600">{t.successNote}</p>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? state.fieldErrors : {};
  const describedBy = (f: QuoteField) => (err[f] ? `q-${f}-error` : undefined);
  const fieldError = (f: QuoteField, message = err[f]) =>
    message ? (
      <p id={`q-${f}-error`} className="m-0 px-3 pb-2.5 text-[11px] tracking-[0] text-error normal-case">
        {message}
      </p>
    ) : null;

  return (
    <form key={state.status === "error" ? state.attempt : 0} action={action} noValidate>
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 xl:grid-cols-5">
        
        {/* Collection */}
        <div className="flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-collection" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelCollection}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <input id="q-collection" name="collection" type="text" placeholder={t.phCollection} required
              maxLength={200} autoComplete="off" defaultValue={v.collection} aria-invalid={!!err.collection}
              aria-describedby={describedBy("collection")} className={control} />
          </div>
          {fieldError("collection")}
        </div>

        {/* Destination */}
        <div className="relative flex flex-col bg-white" ref={dropdownRef}>
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-destination" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelDestination}
            </label>
            <button
              type="button"
              onClick={toggleStops}
              aria-expanded={isOpen}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-ink-950 hover:text-ink-600 transition-all bg-ink-50 hover:bg-ink-100 border border-ink-200 px-2.5 py-1 rounded-sm shadow-2xs"
            >
              <span>{stops.length > 0 ? fill(t.stopsCount, { count: String(stops.length), max: String(MAX_STOPS) }) : t.addStop}</span>
            </button>
          </div>

          <div className="px-3 pb-2.5">
            <input id="q-destination" name="destination" type="text" placeholder={t.phDestination} required
              maxLength={200} autoComplete="off" defaultValue={v.destination} aria-invalid={!!err.destination}
              aria-describedby={describedBy("destination")} className={control} />
          </div>
          {fieldError("destination")}

          {stops.map((stop) => (
            <span key={stop.id} hidden>
              <input type="hidden" name="destinations" value={stop.value} />
              <input type="hidden" name="destinationWaits" value={stop.wait} />
            </span>
          ))}

          {isOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+2px)] z-50 bg-white border border-ink-225 shadow-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px] tracking-wider uppercase text-ink-500 font-semibold border-b border-ink-100 pb-1.5">
                <span>{fill(t.stopoversTitle, { max: String(MAX_STOPS) })}</span>
                <button type="button" onClick={() => setIsOpen(false)} className="text-ink-400 hover:text-ink-950">✕</button>
              </div>

              {stops.length === 0 && (
                <p className="text-[12px] text-ink-475 m-0 italic">{t.noStops}</p>
              )}

              {stops.map((stop, index) => (
                <div key={stop.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus={stop.id === focusId}
                      onFocus={() => stop.id === focusId && setFocusId(undefined)}
                      placeholder={fill(t.stopPlaceholder, { number: String(index + 2) })}
                      maxLength={200}
                      defaultValue={stop.value}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStops(prev => prev.map(s => s.id === stop.id ? { ...s, value: val } : s));
                      }}
                      className="w-full bg-ink-50 border border-ink-225 text-[13px] px-2 py-1.5 text-ink-950 placeholder:text-ink-400 focus:outline-none focus:border-ink-950"
                    />
                    <button
                      type="button"
                      onClick={() => setStops(prev => prev.filter(s => s.id !== stop.id))}
                      className="text-ink-400 hover:text-red-600 px-1.5 text-sm transition-colors"
                      title={t.removeStop}
                    >
                      ×
                    </button>
                  </div>
                  <label className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-ink-500 uppercase">
                    <span className="shrink-0">{t.labelStopWait}</span>
                    <select
                      value={stop.wait}
                      onChange={(e) => {
                        const wait = Number(e.target.value);
                        setStops(prev => prev.map(s => s.id === stop.id ? { ...s, wait } : s));
                      }}
                      className="min-w-0 flex-1 cursor-pointer bg-ink-50 border border-ink-225 px-2 py-1 text-[12px] tracking-normal text-ink-950 normal-case focus:outline-none focus:border-ink-950"
                    >
                      {STOP_WAITS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes === 0 ? t.waitNone : fill(t.waitMinutes, { minutes: String(minutes) })}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ))}

              {stops.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={addStopField}
                  className="mt-1 w-full py-1.5 bg-ink-950 text-white text-[11px] font-semibold tracking-[0.15em] uppercase hover:bg-ink-800 transition-colors text-center"
                >
                  {t.addStopover}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Date & Time */}
        <div className="flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-pickupAt" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelDateTime}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <DateTimeField id="q-pickupAt" name="pickupAt" locale={locale} copy={dateTimeCopy} defaultValue={v.pickupAt}
              invalid={!!err.pickupAt} describedBy={describedBy("pickupAt")} className={control} />
          </div>
          {fieldError("pickupAt")}
        </div>

        {/* Service */}
        <div className="flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-service" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelService}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <select id="q-service" name="service" defaultValue={v.service || SERVICES[0]} aria-invalid={!!err.service}
              aria-describedby={describedBy("service")} className={control}>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {serviceLabels[s]}
                </option>
              ))}
            </select>
          </div>
          {fieldError("service")}
        </div>

        {/* Passengers */}
        <div className="flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-passengers" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelPassengers}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <select id="q-passengers" name="passengers" defaultValue={v.passengers || ""} aria-invalid={!!err.passengers}
              aria-describedby={describedBy("passengers")} className={control}>
              <option value="">{t.selectPlaceholder}</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="8">{t.eightOrMore}</option>
            </select>
          </div>
          {fieldError("passengers")}
        </div>

        {/* Full Name */}
        <div className="flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-name" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelName}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <input id="q-name" name="name" type="text" placeholder={t.phName} required maxLength={120}
              autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name}
              aria-describedby={describedBy("name")} className={control} />
          </div>
          {fieldError("name")}
        </div>

        {/* Email */}
        <div className="flex flex-col bg-white xl:col-span-2">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-email" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelEmail}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <input id="q-email" name="email" type="email" placeholder={t.phEmail} required maxLength={200}
              autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email}
              aria-describedby={describedBy("email")} className={control} />
          </div>
          {fieldError("email")}
        </div>

        {/* Phone */}
        <div className="flex flex-col bg-white md:col-span-2 xl:col-span-2">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-phone" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelPhone}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <div className="flex items-center gap-3">
              <select id="q-phoneCountry" name="phoneCountry" aria-label={t.labelPhoneCountry} defaultValue={v.phoneCountry || "31"}
                className="w-[92px] shrink-0 cursor-pointer border-0 border-r border-ink-225 bg-transparent p-0 pr-2 text-[16px] tracking-[0] text-ink-950 normal-case outline-none md:text-[15px]">
                {COUNTRY_CODES.map(([code, iso]) => (
                  <option key={code} value={code}>
                    {iso} +{code}
                  </option>
                ))}
              </select>
              <input id="q-phone" name="phone" type="tel" placeholder={t.phPhone} required maxLength={20}
                autoComplete="tel-national" defaultValue={v.phone} aria-invalid={!!err.phone}
                aria-describedby={describedBy("phone")} className={control} />
            </div>
          </div>
          {fieldError("phone", err.phone ?? err.phoneCountry)}
        </div>

        {/* Notes */}
        <div className="flex flex-col bg-white col-span-full">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-notes" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelNotes}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <textarea id="q-notes" name="notes" rows={4} placeholder={t.phNotes} maxLength={2000}
              autoComplete="off" defaultValue={v.notes} aria-invalid={!!err.notes}
              aria-describedby={describedBy("notes")}
              className={`${control} min-h-[104px] resize-y`} />
          </div>
          {fieldError("notes")}
        </div>

        {/* Vehicle Selection Dropdown (Only Available Vehicles Shown) */}
        <div className="flex flex-col bg-white col-span-full">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1 select-none">
            <label htmlFor="q-vehicle" className="text-[10px] font-medium tracking-[0.18em] text-ink-600 uppercase">
              {t.labelVehicle}
            </label>
          </div>
          <div className="px-3 pb-2.5">
            <select id="q-vehicle" name="vehicle" value={vehicleTouched ? vehicle : vehicle || v.vehicle || ""}
              onChange={(e) => {
                setVehicleTouched(true);
                setVehicle(e.target.value);
              }}
              aria-invalid={!!err.vehicle} aria-describedby={describedBy("vehicle")} className={control}>
              <option value="">{t.selectPlaceholder}</option>
              {vehicles
                .filter(({ status }) => status === "available")
                .map(({ key, name }) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              <option value="advise">{t.vehicleAdvise}</option>
            </select>
          </div>
          {fieldError("vehicle")}
        </div>

        <input type="hidden" name="locale" value={locale} />

        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="submit"
          disabled={pending}
          className="min-h-[64px] w-full max-w-[420px] cursor-pointer border-none bg-ink-950 px-10 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? t.sending : t.submit}
        </button>
      </div>

      <p aria-live="polite" className={`mt-3 mb-0 text-[13px] ${state.status === "error" ? "text-error" : "text-ink-475"}`}>
        {state.status === "error" ? (
          state.message
        ) : (
          <>
            {t.privacyNote}{" "}
            <Link href={localizedPath("/privacy", locale)} className="text-inherit">
              {t.privacyLink}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}