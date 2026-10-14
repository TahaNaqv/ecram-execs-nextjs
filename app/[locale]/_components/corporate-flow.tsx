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
import { INVOICING, VOLUMES } from "@/lib/corporate/validation";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { CompanyCombobox, type CompanySearchCopy } from "./company-combobox";
import { control, Field } from "./form-field";

type Step = "request" | "verify" | "form";

export type CorporateCopy = Record<
  | "stepRequest" | "stepVerify" | "stepForm" | "labelEmail" | "phEmail" | "labelName" | "phName" | "labelPosition" | "phPosition"
  | "consentLabel" | "privacyNote" | "privacyLink" | "sendCode" | "sending" | "verifyHeading" | "verifyIntro" | "labelCode" | "phCode"
  | "verifyCta" | "verifying" | "resend" | "changeEmail" | "formHeading" | "formIntro" | "verifiedAs" | "labelCompany" | "phCompany"
  | "labelKvk" | "phKvk" | "labelBillingName" | "phBillingName" | "labelBillingEmail" | "phBillingEmail" | "labelPhone" | "phPhone"
  | "labelVolume" | "volumeSelect" | "volume_1_5" | "volume_6_15" | "volume_16_40" | "volume_40_plus" | "labelRoutes" | "phRoutes"
  | "labelVehicles" | "labelInvoicing" | "invoicingSelect" | "invoicing_monthly" | "invoicing_per_trip" | "invoicing_purchase_order"
  | "progressLabel" | "labelNotes" | "phNotes" | "submit" | "submitting" | "successLabel" | "successHeading" | "successNote",
  string
>;

type Props = {
  locale: Locale;
  initial: { step: Step; email?: string };
  copy: CorporateCopy;
  minutes: number;
  vehicles: { key: string; name: string }[];
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

export function CorporateFlow({ locale, initial, copy: t, minutes, vehicles, privacyHref, lookup }: Props) {
  const [step, setStep] = useState<Step>(initial.step);
  const [email, setEmail] = useState(initial.email ?? "");
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
          onVerified={() => setStep("form")}
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
          email={email}
          vehicles={vehicles}
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
  onVerified: () => void;
  onRestart: (message?: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await verifyCode(prev, formData);
    if (next.status === "verified") onVerified();
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
  email,
  vehicles,
  lookup,
  headingRef,
  onLocked,
}: HeadingRef & {
  locale: Locale;
  copy: CorporateCopy;
  email: string;
  vehicles: { key: string; name: string }[];
  lookup: Props["lookup"];
  onLocked: (message: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  // Choosing a company from the register fills the KvK number; editing the name afterwards takes it back out
  const [kvk, setKvk] = useState("");
  const autoKvk = useRef("");
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await submitOnboarding(prev, formData);
    if (next.status === "locked") onLocked(next.message);
    if (next.status === "error") setAttempt((n) => n + 1);
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
  const chosen = new Set((v.vehicles ?? "").split(",").filter(Boolean));
  const d = (f: string) => (err[f as keyof typeof err] ? `c-${f}-error` : undefined);

  return (
    <form key={attempt} action={action} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 outline-none md:text-[32px]">
          {t.formHeading}
        </h2>
        <p className="m-0 max-w-[620px] text-[15px] text-ink-700">{t.formIntro}</p>
        <p className="m-0 text-[12px] tracking-[0.12em] text-ink-600">{interpolate(t.verifiedAs, { email })}</p>
      </div>

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
                  autoKvk.current = hit.kvk;
                  setKvk(hit.kvk);
                } else {
                  setKvk((current) => (current === autoKvk.current ? "" : current));
                  autoKvk.current = "";
                }
              }}
            />
          ) : (
            <input id="c-company" name="company" type="text" required maxLength={200} autoComplete="organization" placeholder={t.phCompany}
              defaultValue={v.company} aria-invalid={!!err.company} aria-describedby={d("company")} className={control} />
          )}
        </Field>
        <Field idPrefix="c" label={t.labelKvk} name="kvk" error={err.kvk}>
          <input id="c-kvk" name="kvk" type="text" inputMode="numeric" maxLength={8} placeholder={t.phKvk}
            value={kvk} onChange={(e) => setKvk(e.target.value)} aria-invalid={!!err.kvk} aria-describedby={d("kvk")} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelBillingName} name="billingName" error={err.billingName}>
          <input id="c-billingName" name="billingName" type="text" required maxLength={120} placeholder={t.phBillingName}
            defaultValue={v.billingName} aria-invalid={!!err.billingName} aria-describedby={d("billingName")} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelBillingEmail} name="billingEmail" error={err.billingEmail}>
          <input id="c-billingEmail" name="billingEmail" type="email" required maxLength={200} placeholder={t.phBillingEmail}
            defaultValue={v.billingEmail} aria-invalid={!!err.billingEmail} aria-describedby={d("billingEmail")} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelPhone} name="phone" error={err.phone}>
          <input id="c-phone" name="phone" type="tel" required maxLength={24} autoComplete="tel" placeholder={t.phPhone}
            defaultValue={v.phone} aria-invalid={!!err.phone} aria-describedby={d("phone")} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelVolume} name="volume" error={err.volume}>
          <select id="c-volume" name="volume" defaultValue={v.volume || ""} aria-invalid={!!err.volume} aria-describedby={d("volume")} className={control}>
            <option value="">{t.volumeSelect}</option>
            {VOLUMES.map((o) => (
              <option key={o} value={o}>
                {t[`volume_${o}`]}
              </option>
            ))}
          </select>
        </Field>
        <Field idPrefix="c" label={t.labelRoutes} name="routes" error={err.routes} className="md:col-span-2">
          <input id="c-routes" name="routes" type="text" maxLength={1000} placeholder={t.phRoutes}
            defaultValue={v.routes} aria-invalid={!!err.routes} aria-describedby={d("routes")} className={control} />
        </Field>
        <Field idPrefix="c" label={t.labelInvoicing} name="invoicing" error={err.invoicing} className="md:col-span-2">
          <select id="c-invoicing" name="invoicing" defaultValue={v.invoicing || ""} aria-invalid={!!err.invoicing} aria-describedby={d("invoicing")} className={control}>
            <option value="">{t.invoicingSelect}</option>
            {INVOICING.map((o) => (
              <option key={o} value={o}>
                {t[`invoicing_${o}`]}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-none bg-white px-[18px] py-4 md:col-span-2">
          <legend className="float-left mb-[6px] w-full p-0 text-[10px] tracking-[0.22em] text-ink-600 uppercase">{t.labelVehicles}</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink-950">
            {vehicles.map(({ key, name }) => (
              <label key={key} className="flex items-center gap-2">
                <input type="checkbox" name="vehicles" value={key} defaultChecked={chosen.has(key)} className="size-4 accent-ink-950" />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
        <Field idPrefix="c" label={t.labelNotes} name="notes" error={err.notes} className="md:col-span-2">
          <textarea id="c-notes" name="notes" rows={3} maxLength={2000} placeholder={t.phNotes}
            defaultValue={v.notes} aria-invalid={!!err.notes} aria-describedby={d("notes")} className={`${control} min-h-[80px] resize-y`} />
        </Field>
      </div>

      <input type="hidden" name="locale" value={locale} />
      <Honeypot />
      <div className="flex flex-col items-center gap-3">
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? t.submitting : t.submit}
        </button>
        <Status error={state.status === "error"}>{state.status === "error" ? state.message : undefined}</Status>
      </div>
    </form>
  );
}
