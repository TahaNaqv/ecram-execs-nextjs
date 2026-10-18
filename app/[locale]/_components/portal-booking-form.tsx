"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createBooking } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import { COUNTRY_CODES, SERVICES, type Service } from "@/lib/quotes/constants";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { ghostClass, submitClass } from "./corporate-styles";
import { Status } from "./corporate-ui";
import { control, Field } from "./form-field";

export type BookingFormCopy = Record<
  | "labelCollection" | "phCollection" | "labelDestination" | "phDestination" | "labelDateTime" | "labelService" | "labelPassengers"
  | "selectPlaceholder" | "eightOrMore" | "labelVehicle" | "vehicleAdvise" | "labelNotes" | "phNotes" | "labelPhoneCountry" | "labelPhone" | "phPhone"
  | "labelBookerName" | "labelBookerEmail" | "labelStopWait" | "waitNone" | "waitMinutes" | "addStopCta" | "phStop" | "submitBooking" | "submittingBooking" | "removeStop" | "loginLink",
  string
> & { stopLabel: string };

export type BookingDefaults = {
  collection?: string;
  destination?: string;
  stops?: { place: string; wait: number }[];
  service?: string;
  passengers?: string;
  vehicle?: string;
  notes?: string;
  phoneCountry?: string;
  phone?: string;
};

const SERVICE_CHOICES = SERVICES.filter((s): s is Exclude<Service, "bespoke"> => s !== "bespoke");

/**
 * A booking request from inside the portal. The booker is the signed-in partner (shown, not typed, and taken from the
 * database again on the server); everything else is the usual trip. `defaults` carries a repeated booking's details.
 */
export function BookingForm({
  locale,
  booker,
  defaults,
  vehicles,
  serviceLabels,
  loginHref,
  copy: t,
}: {
  locale: Locale;
  booker: { name: string; email: string };
  defaults: BookingDefaults;
  vehicles: { key: string; name: string }[];
  serviceLabels: Record<Service, string>;
  loginHref: string;
  copy: BookingFormCopy;
}) {
  const [stops, setStops] = useState<{ id: number; value: string; wait: number }[]>((defaults.stops ?? []).map((s, id) => ({ id, value: s.place, wait: s.wait })));
  const [nextId, setNextId] = useState(stops.length);
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<PortalState, FormData>(async (prev, formData) => {
    const next = await createBooking(prev, formData);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const v = state.status === "error" ? state.values : (defaults as Record<string, string | undefined>);
  const err = state.status === "error" ? state.fieldErrors : {};
  const d = (name: string) => (err[name as keyof typeof err] ? `b-${name}-error` : undefined);

  return (
    <form key={attempt} action={action} noValidate className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
        <Field idPrefix="b" label={t.labelBookerName} name="bookerName">
          <input id="b-bookerName" type="text" value={booker.name} readOnly className={`${control} cursor-default text-ink-700`} />
        </Field>
        <Field idPrefix="b" label={t.labelBookerEmail} name="bookerEmail">
          <input id="b-bookerEmail" type="email" value={booker.email} readOnly className={`${control} cursor-default text-ink-700`} />
        </Field>

        <Field idPrefix="b" label={t.labelCollection} name="collection" error={err.collection}>
          <input id="b-collection" name="collection" type="text" required maxLength={200} placeholder={t.phCollection} defaultValue={v.collection}
            aria-invalid={!!err.collection} aria-describedby={d("collection")} autoComplete="off" className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelDestination} name="destination" error={err.destination}>
          <input id="b-destination" name="destination" type="text" required maxLength={200} placeholder={t.phDestination} defaultValue={v.destination}
            aria-invalid={!!err.destination} aria-describedby={d("destination")} autoComplete="off" className={control} />
        </Field>

        {/* Stops between the two: each its own input, sent as `destinations` */}
        {stops.length > 0 && (
          <div className="col-span-full flex flex-col gap-px bg-ink-225">
            {stops.map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-3 bg-white px-[18px] py-3">
                <label htmlFor={`b-stop-${stop.id}`} className="shrink-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">
                  {interpolate(t.stopLabel, { number: i + 1 })}
                </label>
                <input id={`b-stop-${stop.id}`} name="destinations" type="text" maxLength={200} placeholder={t.phStop} value={stop.value}
                  onChange={(e) => setStops((all) => all.map((x) => (x.id === stop.id ? { ...x, value: e.target.value } : x)))} autoComplete="off" className={control} />
                <select
                  name="destinationWaits"
                  aria-label={t.labelStopWait}
                  value={stop.wait}
                  onChange={(e) => setStops((all) => all.map((x) => (x.id === stop.id ? { ...x, wait: Number(e.target.value) } : x)))}
                  className="w-[112px] shrink-0 cursor-pointer border-0 border-l border-ink-225 bg-transparent p-0 pl-2 text-[14px] tracking-[0] text-ink-950 normal-case outline-none"
                >
                  {STOP_WAITS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? t.waitNone : t.waitMinutes.replace("{minutes}", String(minutes))}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setStops((s) => s.filter((x) => x.id !== stop.id))} className={`${ghostClass} shrink-0`} aria-label={t.removeStop}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {stops.length < MAX_STOPS && (
          <div className="col-span-full bg-white px-[18px] py-3">
            <button
              type="button"
              onClick={() => {
                setStops((s) => [...s, { id: nextId, value: "", wait: 0 }]);
                setNextId((n) => n + 1);
              }}
              className={ghostClass}
            >
              + {t.addStopCta}
            </button>
          </div>
        )}

        <Field idPrefix="b" label={t.labelDateTime} name="pickupAt" error={err.pickupAt}>
          <input id="b-pickupAt" name="pickupAt" type="datetime-local" required defaultValue={v.pickupAt} aria-invalid={!!err.pickupAt} aria-describedby={d("pickupAt")} className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelService} name="service" error={err.service}>
          <select id="b-service" name="service" defaultValue={v.service || SERVICE_CHOICES[0]} aria-invalid={!!err.service} aria-describedby={d("service")} className={control}>
            {SERVICE_CHOICES.map((s) => (
              <option key={s} value={s}>
                {serviceLabels[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field idPrefix="b" label={t.labelPassengers} name="passengers" error={err.passengers}>
          <select id="b-passengers" name="passengers" defaultValue={v.passengers || ""} aria-invalid={!!err.passengers} aria-describedby={d("passengers")} className={control}>
            <option value="">{t.selectPlaceholder}</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value="8">{t.eightOrMore}</option>
          </select>
        </Field>
        <Field idPrefix="b" label={t.labelVehicle} name="vehicle" error={err.vehicle}>
          <select id="b-vehicle" name="vehicle" defaultValue={v.vehicle || ""} aria-invalid={!!err.vehicle} aria-describedby={d("vehicle")} className={control}>
            <option value="">{t.selectPlaceholder}</option>
            {vehicles.map(({ key, name }) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
            <option value="advise">{t.vehicleAdvise}</option>
          </select>
        </Field>
        <Field idPrefix="b" label={t.labelPhone} name="phone" error={err.phone ?? err.phoneCountry} className="md:col-span-2">
          <div className="flex items-center gap-3">
            <select id="b-phoneCountry" name="phoneCountry" aria-label={t.labelPhoneCountry} defaultValue={v.phoneCountry || "31"}
              className="w-[92px] shrink-0 cursor-pointer border-0 border-r border-ink-225 bg-transparent p-0 pr-2 text-[16px] tracking-[0] text-ink-950 normal-case outline-none md:text-[15px]">
              {COUNTRY_CODES.map(([code, iso]) => (
                <option key={code} value={code}>
                  {iso} +{code}
                </option>
              ))}
            </select>
            <input id="b-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel-national" placeholder={t.phPhone} defaultValue={v.phone}
              aria-invalid={!!(err.phone ?? err.phoneCountry)} aria-describedby={d("phone") ?? d("phoneCountry")} className={control} />
          </div>
        </Field>
        <Field idPrefix="b" label={t.labelNotes} name="notes" error={err.notes} className="md:col-span-2">
          <textarea id="b-notes" name="notes" rows={4} maxLength={2000} placeholder={t.phNotes} defaultValue={v.notes}
            aria-invalid={!!err.notes} aria-describedby={d("notes")} className={`${control} min-h-[104px] resize-y`} />
        </Field>
      </div>

      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col items-start gap-3">
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.submittingBooking : t.submitBooking}
        </button>
        <Status error={state.status === "error" || state.status === "locked"}>{state.status === "error" || state.status === "locked" ? state.message : undefined}</Status>
        {state.status === "locked" && (
          <Link href={loginHref} className={ghostClass}>
            {t.loginLink}
          </Link>
        )}
      </div>
    </form>
  );
}
