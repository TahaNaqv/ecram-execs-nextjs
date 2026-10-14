"use client";

import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import { useActionState, useEffect, useState } from "react";
import { COUNTRY_CODES, SERVICES, type Service } from "@/lib/quotes/constants";
import { VEHICLE_CHOICES, type VehicleChoice } from "@/lib/fleet/vehicles";
import { SELECT_VEHICLE_EVENT } from "./book-link";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import Link from "next/link";
import { submitQuote, type QuoteFormState } from "@/lib/quotes/actions";
import type { QuoteField } from "@/lib/quotes/validation";
import { control, Field } from "./form-field";

export type QuoteFormCopy = Record<
  | "labelCollection" | "phCollection" | "labelDestination" | "phDestination" | "labelDateTime"
  | "labelService" | "labelPassengers" | "selectPlaceholder" | "eightOrMore" | "labelName" | "phName"
  | "labelEmail" | "phEmail" | "labelPhoneCountry" | "labelPhone" | "phPhone"
  | "labelVehicle" | "vehicleAdvise" | "labelNotes" | "phNotes"
  | "submit" | "sending" | "successLabel" | "successHeading" | "successNote" | "privacyNote" | "privacyLink",
  string
>;

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);

export function QuoteForm({
  locale,
  serviceLabels,
  vehicles,
  copy: t,
}: {
  locale: Locale;
  serviceLabels: Record<Service, string>;
  vehicles: { key: string; name: string }[];
  copy: QuoteFormCopy;
}) {
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(submitQuote, { status: "idle" });

  // The vehicle can be chosen from the fleet section above ("Book"), either by an event while the page is
  // open or by `?vehicle=` when the link was followed from elsewhere. It is state rather than a default
  // value because it has to change after the form has mounted.
  const [vehicle, setVehicle] = useState("");
  // Until the visitor touches the select, what the server echoed after a failed attempt is shown
  const [vehicleTouched, setVehicleTouched] = useState(false);
  useEffect(() => {
    const isChoice = (value: string | null): value is VehicleChoice => !!value && (VEHICLE_CHOICES as readonly string[]).includes(value);
    const fromQuery = new URLSearchParams(window.location.search).get("vehicle");
    // Deferred a tick: this runs after hydration, and the select must first render with the server's value
    const initial = isChoice(fromQuery) ? window.setTimeout(() => setVehicle(fromQuery), 0) : undefined;
    const onSelect = (e: Event) => {
      const chosen = (e as CustomEvent<string>).detail;
      if (isChoice(chosen)) {
        setVehicle(chosen);
        setVehicleTouched(true);
        // Land on the first thing left to fill in, once the smooth scroll has arrived
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

  return (
    // Remount after each failed attempt so fields re-fill from the submitted values
    <form key={state.status === "error" ? state.attempt : 0} action={action} noValidate>
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2 xl:grid-cols-5">
        <Field label={t.labelCollection} name="collection" error={err.collection}>
          <input id="q-collection" name="collection" type="text" placeholder={t.phCollection} required
            maxLength={200} autoComplete="off" defaultValue={v.collection} aria-invalid={!!err.collection}
            aria-describedby={describedBy("collection")} className={control} />
        </Field>
        <Field label={t.labelDestination} name="destination" error={err.destination}>
          <input id="q-destination" name="destination" type="text" placeholder={t.phDestination} required
            maxLength={200} autoComplete="off" defaultValue={v.destination} aria-invalid={!!err.destination}
            aria-describedby={describedBy("destination")} className={control} />
        </Field>
        <Field label={t.labelDateTime} name="pickupAt" error={err.pickupAt}>
          <input id="q-pickupAt" name="pickupAt" type="datetime-local" required defaultValue={v.pickupAt}
            aria-invalid={!!err.pickupAt} aria-describedby={describedBy("pickupAt")} className={control} />
        </Field>
        <Field label={t.labelService} name="service" error={err.service}>
          <select id="q-service" name="service" defaultValue={v.service || SERVICES[0]} className={control}>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {serviceLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.labelPassengers} name="passengers" error={err.passengers}>
          <select id="q-passengers" name="passengers" defaultValue={v.passengers || ""} className={control}>
            <option value="">{t.selectPlaceholder}</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="8">{t.eightOrMore}</option>
          </select>
        </Field>

        <Field label={t.labelName} name="name" error={err.name}>
          <input id="q-name" name="name" type="text" placeholder={t.phName} required maxLength={120}
            autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name}
            aria-describedby={describedBy("name")} className={control} />
        </Field>
        <Field label={t.labelEmail} name="email" error={err.email} className="xl:col-span-2">
          <input id="q-email" name="email" type="email" placeholder={t.phEmail} required maxLength={200}
            autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} className={control} />
        </Field>
        {/* One phone field: a small country selector (Netherlands by default) sits inside it, beside the number */}
        <Field label={t.labelPhone} name="phone" error={err.phone ?? err.phoneCountry} className="md:col-span-2 xl:col-span-2">
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
        </Field>

        <Field label={t.labelNotes} name="notes" error={err.notes} className="col-span-full">
          <textarea id="q-notes" name="notes" rows={4} placeholder={t.phNotes} maxLength={2000}
            autoComplete="off" defaultValue={v.notes} aria-invalid={!!err.notes}
            aria-describedby={describedBy("notes")}
            className={`${control} min-h-[104px] resize-y`} />
        </Field>
        <Field label={t.labelVehicle} name="vehicle" error={err.vehicle} className="col-span-full">
          <select id="q-vehicle" name="vehicle" value={vehicleTouched ? vehicle : vehicle || v.vehicle || ""}
            onChange={(e) => {
              setVehicleTouched(true);
              setVehicle(e.target.value);
            }}
            aria-invalid={!!err.vehicle} aria-describedby={describedBy("vehicle")} className={control}>
            <option value="">{t.selectPlaceholder}</option>
            {vehicles.map(({ key, name }) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
            <option value="advise">{t.vehicleAdvise}</option>
          </select>
        </Field>

        {/* A Server Action cannot read `next/root-params`, so the form carries the locale. */}
        <input type="hidden" name="locale" value={locale} />

        {/* Honeypot for bots — hidden from people and assistive tech */}
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
