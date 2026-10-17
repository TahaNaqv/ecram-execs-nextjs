"use client";

import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { submitOnboarding } from "@/lib/corporate/actions";
import type { CorporateState } from "@/lib/corporate/state";
import { CONTACT_METHODS, CORPORATE_VEHICLES, DURATIONS, TRIP_TIMES } from "@/lib/corporate/validation";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { CompanyCombobox, type CompanySearchCopy } from "./company-combobox";
import { Honeypot, Status, submitClass } from "./corporate-ui";
import { control, Field } from "./form-field";

export type OnboardingCopy = Record<
  | "formHeading" | "formIntro" | "sectionCompany" | "sectionTravel"
  | "labelCompany" | "phCompany" | "labelCompanyNumber" | "phCompanyNumber" | "labelBookerName" | "labelBookerEmail" | "labelBookerPhone"
  | "labelPhoneCountry" | "phBookerPhone" | "labelContactMethod" | "contactSelect" | "contact_email" | "contact_phone" | "contact_whatsapp"
  | "labelSignatory" | "phSignatory" | "labelPointOfCall" | "phPointOfCall" | "labelVehicle" | "vehicleSelect" | "labelTripTime"
  | "tripTimeSelect" | "trip_morning" | "trip_afternoon" | "trip_evening" | "labelDuration" | "durationSelect" | "duration_2_4"
  | "duration_2_8" | "duration_2_12" | "duration_2_24" | "labelNotes" | "phNotes" | "submit" | "submitting"
  | "successLabel" | "successHeading" | "successNote" | "loginLink",
  string
>;

export function OnboardingForm({
  locale,
  copy: t,
  booker,
  lookup,
  loginHref,
}: {
  locale: Locale;
  copy: OnboardingCopy;
  /** The signed-in contact: shown, never editable, and taken from the database again on the server. */
  booker: { name: string; email: string };
  /** Company search: on when a registry key is configured, otherwise the field is plain text. */
  lookup: { enabled: boolean; copy: CompanySearchCopy };
  /** Where to go if the sign-in ends while the form is open. */
  loginHref: string;
}) {

  const [attempt, setAttempt] = useState(0);
  // Choosing a company from the register fills the company number; editing the name afterwards takes it back out
  const [companyNumber, setCompanyNumber] = useState("");
  const autoNumber = useRef("");
  const [ended, setEnded] = useState<string | undefined>();
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await submitOnboarding(prev, formData);
    if (next.status === "locked") setEnded(next.message);
    if (next.status === "error") {
      setAttempt((n) => n + 1);
      // The number is controlled state that outlives the form's remount, so keep it in step with what was submitted
      setCompanyNumber(next.values.companyNumber ?? "");
    }
    return next;
  }, { status: "idle" });

  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} className="flex flex-col gap-3 border border-ink-225 bg-white px-8 py-10 outline-none">
        <ScrollIntoViewOnMount />
        <span className="text-[10px] tracking-[0.22em] text-ink-600 uppercase">
          {t.successLabel} · {state.reference}
        </span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-ink-950">{interpolate(t.successHeading, { name: state.name })}</p>
        <p className="m-0 text-[14px] text-ink-600">{t.successNote}</p>
      </div>
    );
  }

  if (ended) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Status error>{ended}</Status>
        <Link href={loginHref} className={submitClass + " box-border inline-flex items-center justify-center no-underline"}>
          {t.loginLink}
        </Link>
      </div>
    );
  }

  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? state.fieldErrors : {};
  const d = (f: string) => (err[f as keyof typeof err] ? `c-${f}-error` : undefined);
  const select = (name: string, value: string | undefined, placeholder: string, options: [string, string][]) => (
    <select id={`c-${name}`} name={name} defaultValue={value || ""} aria-invalid={!!err[name as keyof typeof err]} aria-describedby={d(name)} className={control}>
      <option value="">{placeholder}</option>
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
  const sectionTitle = "m-0 border-b border-ink-225 pb-2 text-[11px] font-semibold tracking-[0.24em] text-ink-950 uppercase";

  return (
    <form key={attempt} action={action} noValidate className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 md:text-[32px]">
          {t.formHeading}
        </h2>
        <p className="m-0 max-w-[620px] text-[15px] text-ink-700">{t.formIntro}</p>
      </div>

      <section className="flex flex-col gap-4" aria-labelledby="c-section-company">
        <h3 id="c-section-company" className={sectionTitle}>
          {t.sectionCompany}
        </h3>
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
          <Field idPrefix="c" label={t.labelCompany} name="company" error={err.company}>
            {lookup.enabled ? (
              <CompanyCombobox
                id="c-company"
                name="company"
                copy={lookup.copy}
                placeholder={t.phCompany}
                defaultValue={v.company}
                required
                invalid={!!err.company}
                describedBy={d("company")}
                onSelect={(hit) => {
                  if (hit) {
                    autoNumber.current = hit.kvk;
                    setCompanyNumber(hit.kvk);
                  } else {
                    setCompanyNumber((current) => (current === autoNumber.current ? "" : current));
                    autoNumber.current = "";
                  }
                }}
              />
            ) : (
              <input id="c-company" name="company" type="text" required maxLength={200} autoComplete="organization" placeholder={t.phCompany}
                defaultValue={v.company} aria-invalid={!!err.company} aria-describedby={d("company")} className={control} />
            )}
          </Field>
          <Field idPrefix="c" label={t.labelCompanyNumber} name="companyNumber" error={err.companyNumber}>
            <input id="c-companyNumber" name="companyNumber" type="text" required maxLength={25} placeholder={t.phCompanyNumber}
              value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)}
              aria-invalid={!!err.companyNumber} aria-describedby={d("companyNumber")} className={control} />
          </Field>
          {/* The verified booker: shown for confirmation, not editable (the server uses the verified record, not these) */}
          <Field idPrefix="c" label={t.labelBookerName} name="bookerName">
            <input id="c-bookerName" type="text" value={booker.name} readOnly className={`${control} cursor-default text-ink-700`} />
          </Field>
          <Field idPrefix="c" label={t.labelBookerEmail} name="bookerEmail">
            <input id="c-bookerEmail" type="email" value={booker.email} readOnly className={`${control} cursor-default text-ink-700`} />
          </Field>
          <Field idPrefix="c" label={t.labelBookerPhone} name="phone" error={err.phone ?? err.phoneCountry}>
            <div className="flex items-center gap-3">
              <select id="c-phoneCountry" name="phoneCountry" aria-label={t.labelPhoneCountry} defaultValue={v.phoneCountry || "31"} aria-invalid={!!err.phoneCountry}
                className="w-[92px] shrink-0 cursor-pointer border-0 border-r border-ink-225 bg-transparent p-0 pr-2 text-[16px] tracking-[0] text-ink-950 normal-case outline-none md:text-[15px]">
                {COUNTRY_CODES.map(([code, iso]) => (
                  <option key={code} value={code}>
                    {iso} +{code}
                  </option>
                ))}
              </select>
              <input id="c-phone" name="phone" type="tel" required maxLength={20} autoComplete="tel-national" placeholder={t.phBookerPhone}
                defaultValue={v.phone} aria-invalid={!!(err.phone ?? err.phoneCountry)} aria-describedby={d("phone") ?? d("phoneCountry")} className={control} />
            </div>
          </Field>
          <Field idPrefix="c" label={t.labelContactMethod} name="contactMethod" error={err.contactMethod}>
            {select("contactMethod", v.contactMethod, t.contactSelect, CONTACT_METHODS.map((m) => [m, t[`contact_${m}`]]))}
          </Field>
          <Field idPrefix="c" label={t.labelSignatory} name="signatory" error={err.signatory}>
            <input id="c-signatory" name="signatory" type="text" required maxLength={120} placeholder={t.phSignatory}
              defaultValue={v.signatory} aria-invalid={!!err.signatory} aria-describedby={d("signatory")} className={control} />
          </Field>
          <Field idPrefix="c" label={t.labelPointOfCall} name="pointOfCall" error={err.pointOfCall}>
            <input id="c-pointOfCall" name="pointOfCall" type="text" required maxLength={120} placeholder={t.phPointOfCall}
              defaultValue={v.pointOfCall} aria-invalid={!!err.pointOfCall} aria-describedby={d("pointOfCall")} className={control} />
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="c-section-travel">
        <h3 id="c-section-travel" className={sectionTitle}>
          {t.sectionTravel}
        </h3>
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
          <Field idPrefix="c" label={t.labelVehicle} name="vehicle" error={err.vehicle} className="md:col-span-2">
            {select("vehicle", v.vehicle, t.vehicleSelect, CORPORATE_VEHICLES.map((m) => [m.key, m.name]))}
          </Field>
          <Field idPrefix="c" label={t.labelTripTime} name="tripTime" error={err.tripTime}>
            {select("tripTime", v.tripTime, t.tripTimeSelect, TRIP_TIMES.map((m) => [m, t[`trip_${m}`]]))}
          </Field>
          <Field idPrefix="c" label={t.labelDuration} name="duration" error={err.duration}>
            {select("duration", v.duration, t.durationSelect, DURATIONS.map((m) => [m, t[`duration_${m}`]]))}
          </Field>
          <Field idPrefix="c" label={t.labelNotes} name="notes" error={err.notes} className="md:col-span-2">
            <textarea id="c-notes" name="notes" rows={4} maxLength={2000} placeholder={t.phNotes}
              defaultValue={v.notes} aria-invalid={!!err.notes} aria-describedby={d("notes")} className={`${control} min-h-[104px] resize-y`} />
          </Field>
        </div>
      </section>

      <input type="hidden" name="locale" value={locale} />
      <Honeypot />
      <div className="flex flex-col items-center gap-3">
        <button type="submit" disabled={pending} className={`${submitClass} max-w-[460px]`}>
          {pending ? t.submitting : t.submit}
        </button>
        <Status error={state.status === "error"}>{state.status === "error" ? state.message : undefined}</Status>
      </div>
    </form>
  );
}
