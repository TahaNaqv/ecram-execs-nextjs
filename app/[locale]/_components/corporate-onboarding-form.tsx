"use client";

import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState, type FormEvent } from "react";
import { submitOnboarding } from "@/lib/corporate/actions";
import type { CorporateState } from "@/lib/corporate/state";
import { CONTACT_METHODS, CORPORATE_VEHICLES, DURATIONS, TRIP_TIMES } from "@/lib/corporate/validation";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { CompanyCombobox, type CompanySearchCopy } from "./company-combobox";
import { Honeypot, Status, submitClass } from "./corporate-ui";
import { ActionCard, cardSubmit, CardField, CardGrid, CardSelect, ChoiceGroup, cardControl, CountedTextarea, FormCard, LockedInput, PhoneField, SendIcon } from "./form-cards";

export type OnboardingCopy = Record<
  | "formHeading" | "formIntro" | "cardCompany" | "cardCompanyHint" | "cardPeople" | "cardPeopleHint" | "cardBooker" | "cardBookerHint"
  | "cardTravel" | "cardTravelHint" | "cardNotes" | "cardNotesHint" | "lockedHint" | "charCount" | "submitHint"
  | "labelCompany" | "phCompany" | "labelCompanyNumber" | "phCompanyNumber" | "labelBookerName" | "labelBookerEmail" | "labelBookerPhone"
  | "labelPhoneCountry" | "phBookerPhone" | "labelContactMethod" | "contact_email" | "contact_phone" | "contact_whatsapp"
  | "labelSignatory" | "phSignatory" | "labelPointOfCall" | "phPointOfCall" | "labelVehicle" | "vehicleSelect" | "labelTripTime"
  | "trip_morning" | "trip_afternoon" | "trip_evening" | "labelDuration" | "duration_2_4"
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

  // Choosing a company from the register fills the company number; editing the name afterwards takes it back out
  const [companyNumber, setCompanyNumber] = useState("");
  const autoNumber = useRef("");
  const [ended, setEnded] = useState<string | undefined>();
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await submitOnboarding(prev, formData);
    if (next.status === "locked") setEnded(next.message);
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

  // Nothing to restore after an error: the form is submitted from here rather than through `<form action>`, because
  // React empties a form once its action has finished, which cleared the pills and drop-downs.
  const v: Partial<Record<string, string>> = {};
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  const err = state.status === "error" ? state.fieldErrors : {};
  const d = (f: string) => (err[f as keyof typeof err] ? `c-${f}-error` : undefined);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-ink-950 md:text-[32px]">
          {t.formHeading}
        </h2>
        <p className="m-0 max-w-[620px] text-[15px] text-ink-700">{t.formIntro}</p>
      </div>

      <CardGrid>
        <FormCard icon="building" step={1} title={t.cardCompany} hint={t.cardCompanyHint}>
          <CardField idPrefix="c" name="company" label={t.labelCompany} error={err.company}>
            {lookup.enabled ? (
              <CompanyCombobox
                variant="card"
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
                defaultValue={v.company} aria-invalid={!!err.company} aria-describedby={d("company")} className={cardControl} />
            )}
          </CardField>
          <CardField idPrefix="c" name="companyNumber" label={t.labelCompanyNumber} error={err.companyNumber}>
            <input id="c-companyNumber" name="companyNumber" type="text" required maxLength={25} placeholder={t.phCompanyNumber}
              value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)}
              aria-invalid={!!err.companyNumber} aria-describedby={d("companyNumber")} className={cardControl} />
          </CardField>
        </FormCard>

        <FormCard icon="users" step={2} title={t.cardPeople} hint={t.cardPeopleHint}>
          <CardField idPrefix="c" name="signatory" label={t.labelSignatory} error={err.signatory}>
            <input id="c-signatory" name="signatory" type="text" required maxLength={120} placeholder={t.phSignatory}
              defaultValue={v.signatory} aria-invalid={!!err.signatory} aria-describedby={d("signatory")} className={cardControl} />
          </CardField>
          <CardField idPrefix="c" name="pointOfCall" label={t.labelPointOfCall} error={err.pointOfCall}>
            <input id="c-pointOfCall" name="pointOfCall" type="text" required maxLength={120} placeholder={t.phPointOfCall}
              defaultValue={v.pointOfCall} aria-invalid={!!err.pointOfCall} aria-describedby={d("pointOfCall")} className={cardControl} />
          </CardField>
        </FormCard>

        {/* The verified booker: shown for confirmation, not editable (the server uses the verified record, not these) */}
        <FormCard icon="user" step={3} title={t.cardBooker} hint={t.cardBookerHint}>
          <CardField idPrefix="c" name="bookerName" label={t.labelBookerName}>
            <LockedInput id="c-bookerName" value={booker.name} hint={t.lockedHint} />
          </CardField>
          <CardField idPrefix="c" name="bookerEmail" label={t.labelBookerEmail}>
            <LockedInput id="c-bookerEmail" type="email" value={booker.email} hint={t.lockedHint} />
          </CardField>
          <PhoneField idPrefix="c" label={t.labelBookerPhone} countryLabel={t.labelPhoneCountry} placeholder={t.phBookerPhone}
            defaultCountry={v.phoneCountry} defaultNumber={v.phone} error={err.phone ?? err.phoneCountry} />
          <ChoiceGroup idPrefix="c" name="contactMethod" legend={t.labelContactMethod} defaultValue={v.contactMethod} error={err.contactMethod} size="short" required
            options={CONTACT_METHODS.map((m) => ({ value: m, label: t[`contact_${m}`] }))} />
        </FormCard>

        <FormCard icon="clock" step={4} title={t.cardTravel} hint={t.cardTravelHint}>
          <CardField idPrefix="c" name="vehicle" label={t.labelVehicle} error={err.vehicle}>
            <CardSelect id="c-vehicle" name="vehicle" defaultValue={v.vehicle || ""} aria-invalid={!!err.vehicle} aria-describedby={d("vehicle")}>
              <option value="">{t.vehicleSelect}</option>
              {CORPORATE_VEHICLES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </CardSelect>
          </CardField>
          <ChoiceGroup idPrefix="c" name="tripTime" legend={t.labelTripTime} defaultValue={v.tripTime} error={err.tripTime} size="short" required
            options={TRIP_TIMES.map((m) => ({ value: m, label: t[`trip_${m}`] }))} />
          <ChoiceGroup idPrefix="c" name="duration" legend={t.labelDuration} defaultValue={v.duration} error={err.duration} size="short" required
            options={DURATIONS.map((m) => ({ value: m, label: t[`duration_${m}`] }))} />
        </FormCard>

        <FormCard icon="doc" step={5} title={t.cardNotes} hint={t.cardNotesHint} wide>
          <CardField idPrefix="c" name="notes" label={t.labelNotes} error={err.notes} hideLabel>
            <CountedTextarea id="c-notes" name="notes" rows={4} max={2000} counter={t.charCount} placeholder={t.phNotes} defaultValue={v.notes}
              invalid={!!err.notes} describedBy={d("notes")} />
          </CardField>
        </FormCard>

        <input type="hidden" name="locale" value={locale} />
        <Honeypot />
        <ActionCard>
          <button type="submit" disabled={pending} className={cardSubmit}>
            <SendIcon />
            {pending ? t.submitting : t.submit}
          </button>
          <p className="m-0 max-w-[520px] text-[13px] text-ink-600">{t.submitHint}</p>
          <Status error={state.status === "error"}>{state.status === "error" ? state.message : undefined}</Status>
        </ActionCard>
      </CardGrid>
    </form>
  );
}
