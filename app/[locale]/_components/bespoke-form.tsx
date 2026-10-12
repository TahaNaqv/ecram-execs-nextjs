"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/pathnames";
import { CONTACT_PREFERENCES, VEHICLE_CLASSES } from "@/lib/quotes/constants";
import { submitBespoke, type BespokeFormState } from "@/lib/quotes/bespoke-actions";
import type { BespokeField } from "@/lib/quotes/bespoke-validation";
import { control, Field } from "./form-field";

export type BespokeFormCopy = {
  labelName: string; phName: string; labelEntity: string; phEntity: string; labelEmail: string; phEmail: string;
  labelPhone: string; phPhone: string; labelDelegation: string; phDelegation: string; labelVehicleClass: string;
  selectPlaceholder: string; labelContact: string; labelItinerary: string; phItinerary: string;
  submit: string; sending: string; successLabel: string; successHeading: string; successNote: string;
  privacyNote: string; privacyLink: string;
  vehicleClasses: Record<(typeof VEHICLE_CLASSES)[number], string>;
  contactOptions: Record<(typeof CONTACT_PREFERENCES)[number], string>;
};

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);

export function BespokeForm({ locale, copy: t }: { locale: Locale; copy: BespokeFormCopy }) {
  const [state, action, pending] = useActionState<BespokeFormState, FormData>(submitBespoke, { status: "idle" });

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10">
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
  const describedBy = (f: BespokeField) => (err[f] ? `b-${f}-error` : undefined);

  return (
    // Remount after each failed attempt so fields re-fill from the submitted values
    <form key={state.status === "error" ? state.attempt : 0} action={action} noValidate>
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
        <Field idPrefix="b" label={t.labelName} name="name" error={err.name}>
          <input id="b-name" name="name" type="text" placeholder={t.phName} required maxLength={120}
            autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name}
            aria-describedby={describedBy("name")} className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelEntity} name="entity" error={err.entity}>
          <input id="b-entity" name="entity" type="text" placeholder={t.phEntity} required maxLength={200}
            autoComplete="organization" defaultValue={v.entity} aria-invalid={!!err.entity}
            aria-describedby={describedBy("entity")} className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelEmail} name="email" error={err.email}>
          <input id="b-email" name="email" type="email" placeholder={t.phEmail} required maxLength={200}
            autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email}
            aria-describedby={describedBy("email")} className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelPhone} name="phone" error={err.phone}>
          <input id="b-phone" name="phone" type="tel" placeholder={t.phPhone} required maxLength={24}
            autoComplete="tel" defaultValue={v.phone} aria-invalid={!!err.phone}
            aria-describedby={describedBy("phone")} className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelDelegation} name="passengers" error={err.passengers}>
          <input id="b-passengers" name="passengers" type="number" inputMode="numeric" min={1} max={500}
            placeholder={t.phDelegation} required defaultValue={v.passengers} aria-invalid={!!err.passengers}
            aria-describedby={describedBy("passengers")} className={control} />
        </Field>
        <Field idPrefix="b" label={t.labelVehicleClass} name="vehicleClass" error={err.vehicleClass}>
          <select id="b-vehicleClass" name="vehicleClass" required defaultValue={v.vehicleClass || ""}
            aria-invalid={!!err.vehicleClass} aria-describedby={describedBy("vehicleClass")} className={control}>
            <option value="">{t.selectPlaceholder}</option>
            {VEHICLE_CLASSES.map((c) => (
              <option key={c} value={c}>
                {t.vehicleClasses[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field idPrefix="b" label={t.labelContact} name="contactPreference" error={err.contactPreference} className="md:col-span-2">
          <select id="b-contactPreference" name="contactPreference" required defaultValue={v.contactPreference || ""}
            aria-invalid={!!err.contactPreference} aria-describedby={describedBy("contactPreference")} className={control}>
            <option value="">{t.selectPlaceholder}</option>
            {CONTACT_PREFERENCES.map((c) => (
              <option key={c} value={c}>
                {t.contactOptions[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field idPrefix="b" label={t.labelItinerary} name="itinerary" error={err.itinerary} className="md:col-span-2">
          <textarea id="b-itinerary" name="itinerary" rows={6} placeholder={t.phItinerary} required maxLength={4000}
            defaultValue={v.itinerary} aria-invalid={!!err.itinerary} aria-describedby={describedBy("itinerary")}
            className={`${control} resize-y font-sans`} />
        </Field>

        {/* A Server Action cannot read `next/root-params`, so the form carries the locale. */}
        <input type="hidden" name="locale" value={locale} />

        {/* Honeypot for bots — hidden from people and assistive tech */}
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-[72px] cursor-pointer border-none bg-ink-950 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70 md:col-span-2"
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
