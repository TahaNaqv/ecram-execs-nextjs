"use client";

import { ScrollIntoViewOnMount } from "./scroll-into-view-on-mount";
import Link from "next/link";
import { startTransition, useActionState, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { submitOnboarding } from "@/lib/corporate/actions";
import type { CorporateState } from "@/lib/corporate/state";
import { CONTACT_METHODS, CORPORATE_VEHICLES, DURATIONS, TRIP_TIMES } from "@/lib/corporate/validation";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";
import { CompanyCombobox, type CompanySearchCopy } from "./company-combobox";
import { Honeypot, Status, submitClass } from "./corporate-ui";
import { ActionCard, cardSubmit, CardField, CardGrid, CardSelect, ChoiceGroup, cardControl, CountedTextarea, FormCard, LockedInput, PhoneField, SendIcon } from "./form-cards";

export type OnboardingCopy = Record<
  | "formHeading" | "formIntro" | "cardCompany" | "cardCompanyHint" | "cardPeople" | "cardPeopleHint" | "cardBooker" | "cardBookerHint"
  | "cardTravel" | "cardTravelHint" | "cardJourney" | "cardJourneyHint" | "cardNotes" | "cardNotesHint" | "lockedHint" | "charCount" | "submitHint"
  | "labelCompany" | "phCompany" | "labelCompanyNumber" | "phCompanyNumber" | "labelBookerName" | "labelBookerEmail" | "labelBookerPhone"
  | "labelPhoneCountry" | "phBookerPhone" | "labelContactMethod" | "contact_email" | "contact_phone" | "contact_whatsapp"
  | "labelSignatory" | "phSignatory" | "labelPointOfCall" | "phPointOfCall" | "labelVehicle" | "vehicleSelect" | "labelTripTime"
  | "trip_morning" | "trip_afternoon" | "trip_evening" | "labelDuration" | "duration_2_4"
  | "duration_2_8" | "duration_2_12" | "duration_2_24"
  | "labelCollection" | "phCollection" | "labelDestination" | "phDestination"
  | "labelLuggage" | "luggageHint" | "labelReturnStatus" | "return_one_way" | "return_hourly"
  | "labelStops" | "addStop" | "stopLabel" | "stopWaitLabel" | "waitNone" | "waitMinutes" | "removeStop"
  | "labelNotes" | "phNotes" | "submit" | "submitting"
  | "successLabel" | "successHeading" | "successNote" | "loginLink",
  string
>;

type StopDraft = { place: string; wait: string };

type IntroValues = {
  company: string;
  companyNumber: string;
  signatory: string;
  pointOfCall: string;
  bookerName: string;
  bookerEmail: string;
  phoneCountry: string;
  phone: string;
  contactMethod: string;
  vehicle: string;
  tripTime: string;
  duration: string;
  collection: string;
  destination: string;
  pickupAt: string;
  passengers: string;
  luggage: string;
  returnStatus: string;
  notes: string;
  stops: StopDraft[];
};
const shell = "flex min-w-0 flex-col gap-6 rounded-3xl border border-[rgba(99,145,255,0.3)] bg-[#0b1f4d] p-5 text-[#f4f6fb] shadow-[0_20px_50px_rgba(6,16,43,0.5)] md:p-8";

/** The clock in the Netherlands right now, as a datetime-local value. The browser calendar otherwise opens on the visitor's own clock. */
function netherlandsPickupDefault() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(" ", "T");
}

function PassengersSuitcasesSelector({
  passengers,
  suitcases,
  onChange,
}: {
  passengers: string;
  suitcases: string;
  onChange: (passengers: string, suitcases: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pCount = Math.max(1, parseInt(passengers || "1", 10));
  const sCount = Math.max(0, parseInt(suitcases || "0", 10));

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${cardControl} flex items-center justify-between text-left cursor-pointer !text-[#ffffff]`}
      >
        <span className="font-medium !text-[#ffffff]">
          {pCount} {pCount === 1 ? "passenger" : "passengers"}, {sCount} {sCount === 1 ? "suitcase" : "suitcases"}
        </span>
        <span className="text-xs !text-[#ffffff]">▼</span>
      </button>

      {isOpen && (
        <div className="absolute top-12 left-0 z-50 flex w-full flex-col gap-4 rounded-2xl border border-[rgba(99,145,255,0.5)] bg-[#06122d] p-5 text-[#ffffff] shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="m-0 text-sm font-semibold text-[#ffffff]">Passengers</p>
              <p className="m-0 text-xs text-[#ffffff]">Including you</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onChange(String(Math.max(1, pCount - 1)), String(sCount))}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#ffffff] bg-[#0b1f4d] text-[18px] leading-none font-bold !text-[#ffffff] hover:bg-[#16357a]"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-semibold text-[#ffffff]">{pCount}</span>
              <button
                type="button"
                onClick={() => onChange(String(pCount + 1), String(sCount))}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#ffffff] bg-[#0b1f4d] text-[18px] leading-none font-bold !text-[#ffffff] hover:bg-[#16357a]"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.15)] pt-3">
            <div>
              <p className="m-0 text-sm font-semibold text-[#ffffff]">Suitcases</p>
              <p className="m-0 text-xs text-[#ffffff]">Large bags</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onChange(String(pCount), String(Math.max(0, sCount - 1)))}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#ffffff] bg-[#0b1f4d] text-[18px] leading-none font-bold !text-[#ffffff] hover:bg-[#16357a]"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-semibold text-[#ffffff]">{sCount}</span>
              <button
                type="button"
                onClick={() => onChange(String(pCount), String(Math.min(20, sCount + 1)))}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#ffffff] bg-[#0b1f4d] text-[18px] leading-none font-bold !text-[#ffffff] hover:bg-[#16357a]"
              >
                +
              </button>
            </div>
          </div>

          <p className="m-0 text-center text-[11px] text-[#ffffff]">We use this to suggest the cars that fit.</p>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full cursor-pointer rounded-xl border border-[#ffffff] bg-[#0b1f4d] py-2.5 text-xs font-bold tracking-wider text-[#ffffff] uppercase transition-colors hover:bg-[#16357a]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export function OnboardingForm({
  locale,
  copy: t,
  booker,
  lookup,
  loginHref,
}: {
  locale: Locale;
  copy: OnboardingCopy;
  booker: { name: string; email: string };
  lookup: { enabled: boolean; copy: CompanySearchCopy };
  loginHref: string;
}) {
  const [values, setValues] = useState<IntroValues>({
    company: "",
    companyNumber: "",
    signatory: "",
    pointOfCall: "",
    bookerName: booker.name,
    bookerEmail: booker.email,
    phoneCountry: "31",
    phone: "",
    contactMethod: "",
    vehicle: "",
    tripTime: "",
    duration: "",
    collection: "",
    destination: "",
    pickupAt: "",
    passengers: "1",
    luggage: "0",
    returnStatus: "",
    notes: "",
    stops: [],
  });
  const patch = (partial: Partial<IntroValues>) => setValues((current) => ({ ...current, ...partial }));
  const autoNumber = useRef("");
  const [ended, setEnded] = useState<string | undefined>();
  const [state, action, pending] = useActionState<CorporateState, FormData>(async (prev, formData) => {
    const next = await submitOnboarding(prev, formData);
    if (next.status === "locked") setEnded(next.message);
    return next;
  }, { status: "idle" });

  if (state.status === "success") {
    return (
      <div role="status" tabIndex={-1} className={`${shell} gap-3 px-8 py-10 outline-none`}>
        <ScrollIntoViewOnMount />
        <span className="text-[10px] tracking-[0.22em] text-[#d6e6ff] uppercase">
          {t.successLabel} · {state.reference}
        </span>
        <p className="m-0 font-serif text-[30px] leading-[1.15] text-[#ffffff]">{interpolate(t.successHeading, { name: state.name })}</p>
        <p className="m-0 text-[14px] text-[#d7e4ff]">{t.successNote}</p>
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

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  const err = state.status === "error" ? state.fieldErrors : {};
  const d = (f: string) => (err[f as keyof typeof err] ? `c-${f}-error` : undefined);
  const text = (name: "signatory" | "pointOfCall" | "collection" | "destination") => ({
    value: values[name],
    onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ [name]: e.target.value }),
  });

  return (
    <form onSubmit={submit} noValidate className={shell}>
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-serif text-[28px] font-normal leading-[1.1] text-[#ffffff] md:text-[32px]">
          {t.formHeading}
        </h2>
        <p className="m-0 max-w-[640px] text-[15px] leading-relaxed text-[#d7e4ff]">{t.formIntro}</p>
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
                value={values.company}
                onValueChange={(company) => patch({ company })}
                required
                invalid={!!err.company}
                describedBy={d("company")}
                onSelect={(hit) => {
                  if (hit) {
                    autoNumber.current = hit.kvk;
                    patch({ companyNumber: hit.kvk });
                  } else {
                    setValues((current) => ({
                      ...current,
                      companyNumber: current.companyNumber === autoNumber.current ? "" : current.companyNumber,
                    }));
                    autoNumber.current = "";
                  }
                }}
              />
            ) : (
              <input id="c-company" name="company" type="text" required maxLength={200} autoComplete="organization" placeholder={t.phCompany}
                value={values.company} onChange={(e) => patch({ company: e.target.value })}
                aria-invalid={!!err.company} aria-describedby={d("company")} className={cardControl} />
            )}
          </CardField>
          <CardField idPrefix="c" name="companyNumber" label={t.labelCompanyNumber} error={err.companyNumber}>
            <input id="c-companyNumber" name="companyNumber" type="text" required maxLength={25} placeholder={t.phCompanyNumber}
              value={values.companyNumber} onChange={(e) => patch({ companyNumber: e.target.value })}
              aria-invalid={!!err.companyNumber} aria-describedby={d("companyNumber")} className={cardControl} />
          </CardField>
        </FormCard>

        <FormCard icon="users" step={2} title={t.cardPeople} hint={t.cardPeopleHint}>
          <CardField idPrefix="c" name="signatory" label={t.labelSignatory} error={err.signatory}>
            <input id="c-signatory" name="signatory" type="text" required maxLength={120} placeholder={t.phSignatory}
              {...text("signatory")} aria-invalid={!!err.signatory} aria-describedby={d("signatory")} className={cardControl} />
          </CardField>
          <CardField idPrefix="c" name="pointOfCall" label={t.labelPointOfCall} error={err.pointOfCall}>
            <input id="c-pointOfCall" name="pointOfCall" type="text" required maxLength={120} placeholder={t.phPointOfCall}
              {...text("pointOfCall")} aria-invalid={!!err.pointOfCall} aria-describedby={d("pointOfCall")} className={cardControl} />
          </CardField>
        </FormCard>

        <FormCard icon="user" step={3} title={t.cardBooker} hint={t.cardBookerHint}>
          <CardField idPrefix="c" name="bookerName" label={t.labelBookerName}>
            <LockedInput id="c-bookerName" value={values.bookerName} hint={t.lockedHint} />
          </CardField>
          <CardField idPrefix="c" name="bookerEmail" label={t.labelBookerEmail}>
            <LockedInput id="c-bookerEmail" type="email" value={values.bookerEmail} hint={t.lockedHint} />
          </CardField>
          <PhoneField idPrefix="c" label={t.labelBookerPhone} countryLabel={t.labelPhoneCountry} placeholder={t.phBookerPhone}
            country={values.phoneCountry} number={values.phone}
            onCountryChange={(phoneCountry) => patch({ phoneCountry })}
            onNumberChange={(phone) => patch({ phone })}
            error={err.phone ?? err.phoneCountry} />
          <ChoiceGroup idPrefix="c" name="contactMethod" legend={t.labelContactMethod} value={values.contactMethod}
            onValueChange={(contactMethod) => patch({ contactMethod })} error={err.contactMethod} required
            options={CONTACT_METHODS.map((m) => ({ value: m, label: t[`contact_${m}`] }))} />
        </FormCard>

        <FormCard icon="clock" step={4} title={t.cardTravel} hint={t.cardTravelHint}>
          <CardField idPrefix="c" name="vehicle" label={t.labelVehicle} error={err.vehicle}>
            <CardSelect id="c-vehicle" name="vehicle" value={values.vehicle} onChange={(e) => patch({ vehicle: e.target.value })}
              aria-invalid={!!err.vehicle} aria-describedby={d("vehicle")}>
              <option value="">{t.vehicleSelect}</option>
              {CORPORATE_VEHICLES.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </CardSelect>
          </CardField>
          <ChoiceGroup idPrefix="c" name="tripTime" legend={t.labelTripTime} value={values.tripTime}
            onValueChange={(tripTime) => patch({ tripTime })} error={err.tripTime} required
            options={TRIP_TIMES.map((m) => ({ value: m, label: t[`trip_${m}`] }))} />
          <ChoiceGroup idPrefix="c" name="duration" legend={t.labelDuration} value={values.duration}
            onValueChange={(duration) => patch({ duration })} error={err.duration} required
            options={DURATIONS.map((m) => ({ value: m, label: t[`duration_${m}`] }))} />
        </FormCard>

        <FormCard icon="pin" step={5} title={t.cardJourney} hint={t.cardJourneyHint} wide>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CardField idPrefix="c" name="collection" label={t.labelCollection} error={err.collection}>
              <input id="c-collection" name="collection" type="text" required maxLength={200} autoComplete="off" placeholder={t.phCollection}
                {...text("collection")} aria-invalid={!!err.collection} aria-describedby={d("collection")} className={cardControl} />
            </CardField>
            <CardField idPrefix="c" name="destination" label={t.labelDestination} error={err.destination}>
              <input id="c-destination" name="destination" type="text" required maxLength={200} autoComplete="off" placeholder={t.phDestination}
                {...text("destination")} aria-invalid={!!err.destination} aria-describedby={d("destination")} className={cardControl} />
            </CardField>
            <CardField idPrefix="c" name="pickupAt" label="Date & Time" error={err.pickupAt}>
              <input id="c-pickupAt" name="pickupAt" type="datetime-local" required step={60}
                value={values.pickupAt} onChange={(e) => patch({ pickupAt: e.target.value })}
                onPointerDown={(event) => {
                  if (values.pickupAt || event.currentTarget.value) return;
                  const next = netherlandsPickupDefault();
                  event.currentTarget.value = next;
                  patch({ pickupAt: next });
                }}
                onFocus={(event) => {
                  if (values.pickupAt || event.currentTarget.value) return;
                  const next = netherlandsPickupDefault();
                  event.currentTarget.value = next;
                  patch({ pickupAt: next });
                }}
                aria-invalid={!!err.pickupAt} aria-describedby={d("pickupAt")} className={`${cardControl} cursor-pointer !text-[#ffffff] [color-scheme:dark] [&::-webkit-datetime-edit]:!text-[#ffffff] [&::-webkit-datetime-edit-fields-wrapper]:!text-[#ffffff] [&::-webkit-datetime-edit-text]:!text-[#ffffff] [&::-webkit-datetime-edit-month-field]:!text-[#ffffff] [&::-webkit-datetime-edit-day-field]:!text-[#ffffff] [&::-webkit-datetime-edit-year-field]:!text-[#ffffff] [&::-webkit-datetime-edit-hour-field]:!text-[#ffffff] [&::-webkit-datetime-edit-minute-field]:!text-[#ffffff] [&::-webkit-calendar-picker-indicator]:opacity-100`} />
            </CardField>
            <CardField idPrefix="c" name="luggage" label={t.labelLuggage} error={err.luggage}>
              <input type="hidden" name="passengers" value={values.passengers} />
              <input type="hidden" name="luggage" value={values.luggage} />
              <PassengersSuitcasesSelector
                passengers={values.passengers}
                suitcases={values.luggage}
                onChange={(passengers, luggage) => patch({ passengers, luggage })}
              />
              <p id="c-luggage-hint" className="m-0 mt-1 text-[12px] text-[#ffffff]">{t.luggageHint}</p>
            </CardField>
            <div className="md:col-span-2">
              <ChoiceGroup idPrefix="c" name="returnStatus" legend={t.labelReturnStatus} value={values.returnStatus}
                onValueChange={(returnStatus) => patch({ returnStatus })} error={err.returnStatus} required
                options={[
                  { value: "one_way", label: t.return_one_way ?? "One-Way" },
                  { value: "hourly", label: t.return_hourly ?? "Hourly" }
                ]} />
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:col-span-2">
              <p className="m-0 text-[13px] font-semibold tracking-wide text-[#f4f7ff]">{t.labelStops}</p>
              {values.stops.map((stop, i) => (
                <div key={i} className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor={`c-stop-${i}`}>{interpolate(t.stopLabel, { number: i + 1 })}</label>
                  <input
                    id={`c-stop-${i}`}
                    name="destinations"
                    type="text"
                    maxLength={200}
                    autoComplete="off"
                    placeholder={t.phCollection}
                    value={stop.place}
                    onChange={(e) => patch({ stops: values.stops.map((s, j) => (j === i ? { ...s, place: e.target.value } : s)) })}
                    className={`${cardControl} min-w-0 sm:flex-1`}
                  />
                  <select
                    name="destinationWaits"
                    aria-label={interpolate(t.stopWaitLabel, { number: i + 1 })}
                    value={stop.wait}
                    onChange={(e) => patch({ stops: values.stops.map((s, j) => (j === i ? { ...s, wait: e.target.value } : s)) })}
                    className={`${cardControl} cursor-pointer sm:w-[168px] sm:shrink-0`}
                  >
                    {STOP_WAITS.map((w) => (
                      <option key={w} value={w}>
                        {w === 0 ? t.waitNone : interpolate(t.waitMinutes, { minutes: w })}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={interpolate(t.removeStop, { number: i + 1 })}
                    onClick={() => patch({ stops: values.stops.filter((_, j) => j !== i) })}
                    className="grid size-11 shrink-0 cursor-pointer place-items-center self-start rounded-xl border border-[rgba(255,255,255,0.4)] bg-transparent text-[18px] leading-none text-[#ffffff] transition-colors hover:bg-white/10 sm:self-center"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ))}
              {values.stops.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={() => patch({ stops: [...values.stops, { place: "", wait: "0" }] })}
                  className="inline-flex h-11 w-fit max-w-full cursor-pointer items-center rounded-xl border border-[rgba(255,255,255,0.4)] bg-transparent px-4 text-[13px] font-semibold text-[#ffffff] transition-colors hover:bg-white/10"
                >
                  {t.addStop}
                </button>
              )}
            </div>
          </div>
        </FormCard>

        <FormCard icon="doc" step={6} title={t.cardNotes} hint={t.cardNotesHint} wide>
          <CardField idPrefix="c" name="notes" label={t.labelNotes} error={err.notes} hideLabel>
            <CountedTextarea id="c-notes" name="notes" rows={4} max={2000} counter={t.charCount} placeholder={t.phNotes}
              value={values.notes} onChange={(notes) => patch({ notes })}
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
          <p className="m-0 max-w-[520px] text-[13px] leading-relaxed text-[#3f5687]">{t.submitHint}</p>
          <p aria-live="polite" className="m-0 min-h-[1.5em] text-[13px] text-[#c42318]">
            {state.status === "error" ? state.message : ""}
          </p>
        </ActionCard>
      </CardGrid>
    </form>
  );
}