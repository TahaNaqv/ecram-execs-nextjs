"use client";

import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import {
  requestCode,
  resendCode,
  submitOnboarding,
  verifyCode,
  type CorporateState,
} from "@/lib/corporate/actions";
import { CONTACT_METHODS, CORPORATE_VEHICLES, DURATIONS, TRIP_TIMES } from "@/lib/corporate/validation";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { CompanyCombobox, type CompanySearchCopy } from "./company-combobox";
import { control, Field } from "./form-field";

type Step = "request" | "verify" | "form";

export type CorporateCopy = Record<
  | "stepRequest" | "stepVerify" | "stepForm" | "labelEmail" | "phEmail" | "labelName" | "phName" | "labelPosition" | "phPosition"
  | "consentLabel" | "privacyNote" | "privacyLink" | "sendCode" | "sending" | "verifyHeading" | "verifyIntro" | "labelCode" | "phCode"
  | "verifyCta" | "verifying" | "resend" | "changeEmail" | "formHeading" | "formIntro" | "sectionCompany" | "sectionTravel"
  | "labelCompany" | "phCompany" | "labelCompanyNumber" | "phCompanyNumber" | "labelBookerName" | "labelBookerEmail" | "labelBookerPhone"
  | "labelPhoneCountry" | "phBookerPhone" | "labelContactMethod" | "contactSelect" | "contact_email" | "contact_phone" | "contact_whatsapp"
  | "labelSignatory" | "phSignatory" | "labelPointOfCall" | "phPointOfCall" | "labelVehicle" | "vehicleSelect" | "labelTripTime"
  | "tripTimeSelect" | "trip_morning" | "trip_afternoon" | "trip_evening" | "labelDuration" | "durationSelect" | "duration_2_4"
  | "duration_2_8" | "duration_2_12" | "duration_2_24" | "progressLabel" | "labelNotes" | "phNotes" | "submit" | "submitting"
  | "successLabel" | "successHeading" | "successNote",
  string
>;

type Props = {
  locale: Locale;
  initial: { step: Step; email?: string; name?: string };
  copy: CorporateCopy;
  minutes: number;
  privacyHref: string;
  /** Company search: on when a registry key is configured, otherwise the field is plain text. */
  lookup: { enabled: boolean; copy: CompanySearchCopy };
};

const submitClass =
  "min-h-[56px] w-full max-w-[420px] cursor-pointer border-none bg-ink-950 px-10 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70";
const ghostClass =
  "cursor-pointer border-none bg-transparent p-0 font-sans text-[12px] tracking-[0.18em] text-ink-700 uppercase underline underline-offset-4 hover:text-ink-950 disabled:cursor-progress disabled:opacity-60";

const Honeypot = () => (
  <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
    <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
  </div>
);

function Status({ children, error }: { children?: ReactNode; error?: boolean }) {
  return (
    <p aria-live="polite" className={`m-0 min-h-[1.5em] text-[13px] ${error ? "text-error" : "text-ink-600"}`}>
      {children}
    </p>
  );
}

export function CorporateFlow({ locale, initial, copy: t, minutes, privacyHref, lookup }: Props) {
  const [step, setStep] = useState<Step>(initial.step);
  const [email, setEmail] = useState(initial.email ?? "");
  const [name, setName] = useState(initial.name ?? "");
  const [banner, setBanner] = useState<string | undefined>();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // Move focus to the new step so a keyboard or screen-reader user lands on it
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  const steps: [Step, string][] = [
    ["request", t.stepRequest],
    ["verify", t.stepVerify],
    ["form", t.stepForm],
  ];

  return (
    <div className="flex flex-col gap-8">
      <ol className="m-0 flex list-none gap-6 p-0 text-[11px] tracking-[0.22em] uppercase" aria-label={t.progressLabel}>
        {steps.map(([key, label], i) => (
          <li key={key} aria-current={key === step ? "step" : undefined} className={key === step ? "text-ink-950" : "text-ink-450"}>
            <span className="mr-2">{String(i + 1).padStart(2, "0")}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === "request" && (
        <RequestForm
          locale={locale}
          copy={t}
          banner={banner}
          privacyHref={privacyHref}
          headingRef={heading}
          onSent={(sentTo) => {
            setEmail(sentTo);
            setBanner(undefined);
            setStep("verify");
          }}
        />
      )}
      {step === "verify" && (
        <VerifyForm
          locale={locale}
          copy={t}
          email={email}
          minutes={minutes}
          headingRef={heading}
          onVerified={(verifiedName, verifiedEmail) => {
            setName(verifiedName);
            setEmail(verifiedEmail);
            setStep("form");
          }}
          onRestart={(message) => {
            setBanner(message);
            setStep("request");
          }}
        />
      )}
      {step === "form" && (
        <OnboardingForm
          locale={locale}
          copy={t}
          booker={{ name, email }}
          lookup={lookup}
          headingRef={heading}
          onLocked={(message) => {
            setBanner(message);
            setStep("request");
          }}
        />
      )}
    </div>
  );
}

type HeadingRef = { headingRef: React.RefObject<HTMLHeadingElement | null> };

function RequestForm({
  locale,
  copy: t,
  banner,
  privacyHref,
  headingRef,
  onSent,
}: HeadingRef & { locale: Locale; copy: CorporateCopy; banner?: string; privacyHref: string; onSent: (email: string) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await requestCode(prev, formData);
    if (next.status === "sent") onSent(next.email);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const v = state.status === "error" ? state.values : {};
  const err = state.status === "error" ? state.fieldErrors : {};

  return (
    <form key={attempt} action={action} noValidate className="flex flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        {t.stepRequest}
      </h2>
      {banner && <Status error>{banner}</Status>}
      <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225 md:grid-cols-2">
        <Field idPrefix="c" label={t.labelEmail} name="email" error={err.email} className="md:col-span-2">
          <input id="c-email" name="email" type="email" required maxLength={200} autoComplete="email" placeholder={t.phEmail}
            defaultValue={v.email} aria-invalid={!!err.email} aria-describedby={err.email ? "c-email-error" : undefined} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelName} name="name" error={err.name}>
          <input id="c-name" name="name" type="text" required maxLength={120} autoComplete="name" placeholder={t.phName}
            defaultValue={v.name} aria-invalid={!!err.name} aria-describedby={err.name ? "c-name-error" : undefined} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelPosition} name="position" error={err.position}>
          <input id="c-position" name="position" type="text" required maxLength={120} autoComplete="organization-title" placeholder={t.phPosition}
            defaultValue={v.position} aria-invalid={!!err.position} aria-describedby={err.position ? "c-position-error" : undefined} className={control} />
        </Field>
      </div>
      <label className="flex items-start gap-3 text-[14px] text-ink-700">
        <input type="checkbox" name="marketingConsent" defaultChecked={v.marketingConsent === "on"} className="mt-1 size-4 shrink-0 accent-ink-950" />
        <span>{t.consentLabel}</span>
      </label>
      <input type="hidden" name="locale" value={locale} />
      <Honeypot />
      <div className="flex flex-col items-start gap-3">
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.sending : t.sendCode}
        </button>
        <Status error={state.status === "error"}>
          {state.status === "error" ? (
            state.message
          ) : (
            <>
              {t.privacyNote}{" "}
              <Link href={privacyHref} className="text-inherit">
                {t.privacyLink}
              </Link>
            </>
          )}
        </Status>
      </div>
    </form>
  );
}

function VerifyForm({
  locale,
  copy: t,
  email,
  minutes,
  headingRef,
  onVerified,
  onRestart,
}: HeadingRef & {
  locale: Locale;
  copy: CorporateCopy;
  email: string;
  minutes: number;
  onVerified: (name: string, email: string) => void;
  onRestart: (message?: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await verifyCode(prev, formData);
    if (next.status === "verified") onVerified(next.name, next.email);
    if (next.status === "locked") onRestart(next.message);
    if (next.status === "error") setAttempt((n) => n + 1);
    return next;
  }, { status: "idle" });
  const [resendState, resendAction, resending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await resendCode(prev, formData);
    if (next.status === "locked") onRestart(next.message);
    return next;
  }, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};

  return (
    <div className="flex flex-col gap-6">
      <h2 ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 outline-none md:text-[32px]">
        {t.verifyHeading}
      </h2>
      <p className="m-0 max-w-[560px] text-[15px] text-ink-700">{interpolate(t.verifyIntro, { email, minutes })}</p>
      <form key={attempt} action={action} noValidate className="flex max-w-[420px] flex-col gap-4">
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225">
          <Field idPrefix="c" label={t.labelCode} name="code" error={err.code}>
            <input id="c-code" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code"
              placeholder={t.phCode} aria-invalid={!!err.code} aria-describedby={err.code ? "c-code-error" : undefined}
              className={`${control} text-[22px] tracking-[0.5em] md:text-[22px]`} />
          </Field>
        </div>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.verifying : t.verifyCta}
        </button>
        <Status error={state.status === "error" && !err.code}>{state.status === "error" && !err.code ? state.message : undefined}</Status>
      </form>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <form action={resendAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" disabled={resending} className={ghostClass}>
            {t.resend}
          </button>
        </form>
        <button type="button" onClick={() => onRestart()} className={ghostClass}>
          {t.changeEmail}
        </button>
      </div>
      <Status error={resendState.status === "error"}>
        {resendState.status === "error" ? resendState.message : resendState.status === "sent" ? resendState.notice : undefined}
      </Status>
    </div>
  );
}

function OnboardingForm({
  locale,
  copy: t,
  booker,
  lookup,
  headingRef,
  onLocked,
}: HeadingRef & {
  locale: Locale;
  copy: CorporateCopy;
  /** The verified contact: shown, never editable, and taken from the database again on the server. */
  booker: { name: string; email: string };
  lookup: Props["lookup"];
  onLocked: (message: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  // Choosing a company from the register fills the company number; editing the name afterwards takes it back out
  const [companyNumber, setCompanyNumber] = useState("");
  const autoNumber = useRef("");
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await submitOnboarding(prev, formData);
    if (next.status === "locked") onLocked(next.message);
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
        <h2 ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 outline-none md:text-[32px]">
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
