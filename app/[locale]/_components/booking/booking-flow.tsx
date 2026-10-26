"use client";

import Link from "next/link";
import { startTransition, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import { FLEET, normalizeVehicleKey, vehicleByKey, type FleetVehicle, type VehicleChoice } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { VehicleGallery } from "../vehicle-gallery";
import { netherlandsNow, type BookingCopy, type TripMessages } from "./copy";
import { bagsText, guestsText } from "./guests-picker";
import { JourneyBar } from "./journey-bar";
import { involvesAirport, isTripReady, MAX_PASSENGERS, pickupAtAirport, shortPlace, tripFields, type Trip } from "./trip";
import { VehicleDetails, type FleetDictionary } from "./vehicle-details";

export type BookingStep = "journey" | "car" | "details";
/** What the last submission came back with, the same for the website's action and the portal's. */
export type BookingResult = {
  pending: boolean;
  message: string | null;
  fieldErrors: Partial<Record<string, string>>;
};
export type OfferedVehicle = { key: string; name: string };
export type DetailDefaults = { notes?: string; passengerName?: string; passengerPhone?: { country: string; number: string } };

// Fields the server checks, by the step that asks for them: an error sends the visitor back there
const JOURNEY_FIELDS = ["collection", "destination", "pickupAt", "returnAt", "durationHours", "flightNumber", "passengers", "luggage", "service"];
const CAR_FIELDS = ["vehicle"];

const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M5 12l5 5L19 7" />
  </svg>
);
const SeatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </svg>
);

const pretty = (wallClock: string, locale: string) => {
  const [d, time] = wallClock.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return `${new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)))}, ${time}`;
};

/**
 * The booking flow after the journey: the car, then who is travelling and how to reach them, then one submission of
 * everything to the action the page gives it (the website's quote request or the portal's booking). Shared by /book and
 * the Corporate Partner portal; `variant` decides the few differences (who the booker is, what the summary promises).
 */
export function BookingFlow({
  variant,
  locale,
  copy: t,
  dateTimeCopy,
  messages,
  fleetDict,
  vehicleAdvise,
  vehicles,
  initialTrip,
  initialStep,
  result,
  submit,
  booker,
  defaultPhone,
  defaults,
  privacyHref,
  notice,
  lockedNotice,
}: {
  variant: "public" | "portal";
  locale: Locale;
  copy: BookingCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  fleetDict: FleetDictionary;
  vehicleAdvise: string;
  /** The cars on offer (switched-off cars already left out) */
  vehicles: OfferedVehicle[];
  initialTrip: Trip;
  initialStep: BookingStep;
  result: BookingResult;
  submit: (data: FormData) => void;
  /** Portal: the signed-in partner, shown instead of name and email fields */
  booker?: { name: string; email: string };
  defaultPhone?: { country: string; number: string };
  /** Portal "repeat this booking": the details step starts from the earlier booking's notes and passenger */
  defaults?: DetailDefaults;
  privacyHref?: string;
  /** Shown above the flow, e.g. "Filled in from EE-XXXXXX" in the portal */
  notice?: string;
  /** Portal: the session ran out; a sign-in link in place of the submit button */
  lockedNotice?: ReactNode;
}) {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [step, setStep] = useState<BookingStep>(initialStep);
  const [details, setDetails] = useState<FleetVehicle | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // The step whose heading last had the focus. Not the first render, and not when Next shows the page again after Back
  // (it re-runs effects on pages it kept): only a real change of step moves the focus and the scroll
  const focused = useRef<BookingStep>(initialStep);

  useEffect(() => {
    if (focused.current === step) return;
    focused.current = step;
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest("section")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [step]);
  const go = setStep;

  // A server error belongs to a step: go back to it (once per answer from the server)
  const errorKeys = Object.keys(result.fieldErrors);
  const [answered, setAnswered] = useState(result.fieldErrors);
  if (answered !== result.fieldErrors) {
    setAnswered(result.fieldErrors);
    if (errorKeys.some((k) => JOURNEY_FIELDS.includes(k))) setStep("journey");
    else if (errorKeys.some((k) => CAR_FIELDS.includes(k))) setStep("car");
  }
  const journeyErrors = errorKeys.filter((k) => JOURNEY_FIELDS.includes(k)).map((k) => result.fieldErrors[k]);

  const chosen = vehicleByKey(trip.vehicle);
  const steps: [BookingStep, string][] = [["journey", t.stepJourney], ["car", t.stepCar], ["details", t.stepDetails]];
  const stepIndex = steps.findIndex(([s]) => s === step);

  const tripLine = [
    trip.mode === "hourly"
      ? `${shortPlace(trip.from)} · ${interpolate(t.asDirected, { hours: trip.hours })}`
      : [shortPlace(trip.from), ...trip.stops.filter((s) => s.place).map(() => "…"), shortPlace(trip.to)].join(" → "),
    trip.at ? pretty(trip.at, locale) : "",
    guestsText(t, trip.pax),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="flex w-full flex-col gap-6">
      {notice && <p className="m-0 rounded-xl bg-ink-100 px-4 py-3 text-[14px] text-ink-800">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {step !== "journey" ? (
          <button
            type="button"
            // Back to the journey step of this same flow, with the trip as it is: the page the visitor came from (QA round 3, bug 9)
            onClick={() => go("journey")}
            className="flex min-h-12 max-w-full cursor-pointer items-center gap-3 rounded-full border border-solid border-ink-225 bg-white py-1.5 pr-1.5 pl-5 text-left text-[14px] font-medium text-ink-950 hover:border-ink-950"
          >
            <span className="min-w-0 truncate">{tripLine}</span>
            <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink-100 px-3.5 text-[13px] font-semibold">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16z" />
              </svg>
              {t.edit}
            </span>
          </button>
        ) : (
          <span />
        )}
        <ol aria-label={t.progress} className="m-0 flex list-none gap-3 p-0 text-[12px] text-ink-600">
          {steps.map(([s, label], i) => (
            <li key={s} aria-current={s === step ? "step" : undefined} className={`flex min-w-[56px] flex-col gap-1.5 ${s === step ? "font-semibold text-ink-950" : ""}`}>
              <span aria-hidden="true" className={`h-1 rounded-full ${i <= stepIndex ? "bg-ink-950" : "bg-ink-225"}`} />
              <span className="max-sm:sr-only">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {step === "journey" && (
        <section aria-labelledby="booking-journey" className="scroll-mt-6">
          <h2 id="booking-journey" ref={heading} tabIndex={-1} className="m-0 mb-5 font-serif text-[clamp(32px,4vw,44px)] leading-[1.05] font-normal outline-none">
            {t.heading}
          </h2>
          {journeyErrors.length > 0 && (
            <p role="alert" className="m-0 mb-4 rounded-xl bg-[#fef3f2] px-4 py-3 text-[14px] text-error">
              {journeyErrors.join(" ")}
            </p>
          )}
          <JourneyBar
            locale={locale}
            copy={t}
            dateTimeCopy={dateTimeCopy}
            messages={messages}
            tone="light"
            initial={trip}
            onDone={(next) => {
              setTrip(next);
              go("car");
            }}
          />
        </section>
      )}

      {step === "car" && (
        <CarStep
          headingRef={heading}
          trip={trip}
          vehicles={vehicles}
          copy={t}
          error={result.fieldErrors.vehicle}
          onDetails={setDetails}
          onChoose={(vehicle) => setTrip((current) => ({ ...current, vehicle }))}
          onBack={() => go("journey")}
          onNext={() => go("details")}
        />
      )}

      {step === "details" && (
        <DetailsStep
          headingRef={heading}
          variant={variant}
          trip={trip}
          copy={t}
          locale={locale}
          chosen={chosen}
          vehicleAdvise={vehicleAdvise}
          result={result}
          submit={submit}
          booker={booker}
          defaultPhone={defaultPhone}
          defaults={defaults}
          privacyHref={privacyHref}
          lockedNotice={lockedNotice}
          onBack={() => go("car")}
        />
      )}

      <VehicleDetails vehicle={details} onClose={() => setDetails(null)} fleetDict={fleetDict} locale={locale} closeLabel={fleetDict.galleryClose} />
    </div>
  );
}

function CarStep({ headingRef, trip, vehicles, copy: t, error, onDetails, onChoose, onBack, onNext }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  trip: Trip;
  vehicles: OfferedVehicle[];
  copy: BookingCopy;
  error?: string;
  onDetails: (v: FleetVehicle) => void;
  onChoose: (vehicle: VehicleChoice | "") => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const large = trip.pax >= MAX_PASSENGERS;
  const cars = vehicles
    .map((v) => FLEET.find((f) => f.key === normalizeVehicleKey(v.key)))
    .filter((v): v is FleetVehicle => Boolean(v))
    .map((v) => ({ vehicle: v, seats: v.specs?.passengers ?? null }))
    .map((c) => ({ ...c, fits: true }));
  const fitting = cars;
  const party = guestsText(t, trip.pax);
  const choose = (key: VehicleChoice) => onChoose(trip.vehicle === key ? "" : key);
  const chosen = vehicleByKey(trip.vehicle);

  const card = (c: (typeof cars)[number]) => {
    const selected = trip.vehicle === c.vehicle.key;
    return (
      <li key={c.vehicle.key} className="relative">
        <button
          type="button"
          aria-pressed={selected}
          disabled={!c.fits}
          onClick={() => choose(c.vehicle.key)}
          className={`flex w-full cursor-pointer flex-col rounded-2xl bg-white p-2 text-left text-ink-950 transition-shadow disabled:cursor-default disabled:bg-transparent ${
            selected ? "border-2 border-solid border-ink-950 p-[7px] shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.12)]" : c.fits ? "border border-solid border-ink-225 hover:border-ink-950" : "border border-dashed border-ink-300"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small cover photo from /public; next/image would need sizes per breakpoint for no gain here */}
          <img src={c.vehicle.images[0]} alt="" className={`aspect-[16/9.5] w-full rounded-[11px] object-cover ${c.fits ? "" : "opacity-40 grayscale"}`} />
          <span className="flex items-center justify-between gap-3 px-1.5 pt-3 pb-1.5">
            <span className={`text-[15px] font-semibold ${c.fits ? "" : "text-ink-600"}`}>{c.vehicle.name}</span>
            {c.seats !== null && (
              <span className={`flex items-center gap-1.5 text-[13px] whitespace-nowrap ${c.fits ? "text-ink-700" : "text-ink-600"}`}>
                <SeatIcon />
                {interpolate(t.seatsUpTo, { seats: c.seats })}
              </span>
            )}
          </span>
          {selected && (
            <span aria-hidden="true" className="absolute top-[18px] left-[18px] grid size-8 place-items-center rounded-full bg-ink-950 text-white">
              <Check size={15} />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => onDetails(c.vehicle)}
          aria-label={interpolate(t.carDetails, { car: c.vehicle.name })}
          className="absolute top-[18px] right-[18px] grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-ink-950 shadow-sm hover:bg-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.5" />
          </svg>
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby="booking-car" className="scroll-mt-6">
      <h2 id="booking-car" ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[clamp(32px,4vw,44px)] leading-[1.05] font-normal outline-none">
        {t.carTitle}
      </h2>
      <p className="m-0 mt-2 text-[15px] text-ink-600">
        {large ? t.carIntroLarge : interpolate(t.carIntro, { fits: cars.length, total: cars.length, party })}
      </p>
      {error && (
        <p role="alert" className="m-0 mt-3 text-[14px] text-error">
          {error}
        </p>
      )}
      <ul aria-labelledby="booking-car" className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {fitting.map(card)}
        <li>
          <button
            type="button"
            aria-pressed={trip.vehicle === "advise"}
            onClick={() => choose("advise")}
            className={`flex h-full min-h-[200px] w-full cursor-pointer flex-col justify-between gap-4 rounded-2xl p-[22px] text-left text-ink-950 ${
              trip.vehicle === "advise" ? "border-2 border-solid border-ink-950 bg-white p-[21px]" : "border border-dashed border-ink-400 bg-transparent hover:border-ink-950"
            }`}
          >
            <span className="grid size-11 place-items-center rounded-xl border border-solid border-ink-225 bg-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
              </svg>
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="font-serif text-[26px] leading-none">{t.noPreference}</span>
              <span className="text-[13px] text-ink-600">{interpolate(t.noPreferenceNote, { party, bags: bagsText(t, trip.bags) })}</span>
            </span>
          </button>
        </li>
      </ul>

      <div className="sticky bottom-0 z-10 mt-8 -mx-5 border-t border-solid border-ink-150 bg-white/95 px-5 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ul className="m-0 hidden list-none flex-wrap gap-x-5 gap-y-1.5 p-0 text-[13px] text-ink-700 md:flex">
            {[t.includedElectric, t.includedArrivals, t.includedWaiting].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check />
                {item}
              </li>
            ))}
          </ul>
          <div className="ml-auto flex w-full gap-2.5 md:w-auto">
            <button type="button" onClick={onBack} className="flex h-[52px] cursor-pointer items-center gap-1.5 rounded-xl border border-solid border-ink-225 bg-white px-5 text-[14px] font-semibold text-ink-950 hover:border-ink-950">
              <ArrowLeft />
              {t.back}
            </button>
            <button type="button" onClick={onNext} className="h-[52px] flex-1 cursor-pointer rounded-xl border-0 bg-ink-950 px-6 text-[14px] font-semibold text-white hover:bg-ink-800 md:flex-none">
              {chosen ? interpolate(t.continueWith, { car: chosen.name }) : trip.vehicle === "advise" ? t.continueWithout : t.skipCar}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailsStep({ headingRef, variant, trip, copy: t, locale, chosen, vehicleAdvise, result, submit, booker, defaultPhone, defaults, privacyHref, lockedNotice, onBack }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  variant: "public" | "portal";
  trip: Trip;
  copy: BookingCopy;
  locale: Locale;
  chosen: FleetVehicle | undefined;
  vehicleAdvise: string;
  result: BookingResult;
  submit: (data: FormData) => void;
  booker?: { name: string; email: string };
  defaultPhone?: { country: string; number: string };
  defaults?: DetailDefaults;
  privacyHref?: string;
  lockedNotice?: ReactNode;
  onBack: () => void;
}) {
  const uid = useId();
  const [who, setWho] = useState<"me" | "other">(defaults?.passengerName ? "other" : "me");
  const [purpose, setPurpose] = useState<"business" | "private">("business");
  const [phoneCountry, setPhoneCountry] = useState(defaultPhone?.country ?? "31");
  const [passengerCountry, setPassengerCountry] = useState(defaults?.passengerPhone?.country ?? "31");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors: Record<string, string | undefined> = { ...result.fieldErrors, ...localErrors };
  const portal = variant === "portal";
  const askPurpose = trip.mode === "oneway" && !involvesAirport(trip);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (who === "other" && !String(data.get("passengerName") ?? "").trim()) {
      setLocalErrors({ passengerName: t.passengerNameRequired });
      document.getElementById(`${uid}-passengerName`)?.focus();
      return;
    }
    setLocalErrors({});
    if (who === "me") {
      data.delete("passengerName");
      data.delete("passengerPhone");
      data.delete("passengerPhoneCountry");
    }
    for (const [k, v] of tripFields(trip, purpose)) data.append(k, v);
    data.set("locale", locale);
    startTransition(() => submit(data));
  };

  const field = (name: string, label: string, control: ReactNode, wide = false) => (
    <div className={`flex min-w-0 flex-col gap-1 rounded-xl border border-solid bg-white px-3.5 py-2.5 focus-within:border-ink-950 focus-within:shadow-[0_0_0_1px_#0a0a0b] ${errors[name] ? "border-error shadow-[0_0_0_1px_#b42318]" : "border-ink-225"} ${wide ? "md:col-span-2" : ""}`}>
      <label htmlFor={`${uid}-${name}`} className="text-[12px] text-ink-600">
        {label}
      </label>
      {control}
      {errors[name] && (
        <span id={`${uid}-${name}-error`} className="text-[12px] text-error">
          {errors[name]}
        </span>
      )}
    </div>
  );
  const input = "w-full min-w-0 border-0 bg-transparent p-0 font-sans text-[16px] font-medium text-ink-950 outline-none placeholder:font-normal placeholder:text-ink-475";
  const aria = (name: string) => ({ id: `${uid}-${name}`, "aria-invalid": Boolean(errors[name]) || undefined, "aria-describedby": errors[name] ? `${uid}-${name}-error` : undefined });
  const phone = (prefix: "" | "passenger", country: string, setCountry: (c: string) => void, label: string, defaultValue?: string) => {
    const number = prefix ? "passengerPhone" : "phone";
    const code = prefix ? "passengerPhoneCountry" : "phoneCountry";
    return field(
      number,
      label,
      <span className="flex items-center gap-2.5">
        <select
          name={code}
          aria-label={t.phoneCountry}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            const typed = document.getElementById(`${uid}-${number}`);
            if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, e.target.value);
          }}
          className="shrink-0 cursor-pointer border-0 border-r border-solid border-ink-225 bg-transparent p-0 pr-2 text-[16px] font-medium text-ink-950 outline-none"
        >
          {COUNTRY_CODES.map(([c, iso]) => (
            <option key={c} value={c}>
              {iso} +{c}
            </option>
          ))}
        </select>
        <input
          {...aria(number)}
          name={number}
          type="tel"
          inputMode="numeric"
          autoComplete={prefix ? "off" : "tel-national"}
          maxLength={PASTE_MAX}
          defaultValue={defaultValue}
          placeholder={t.phonePlaceholder}
          onInput={(e) => {
            e.currentTarget.value = cleanPhoneInput(e.currentTarget.value, country);
          }}
          className={input}
        />
      </span>,
    );
  };

  return (
    <section aria-labelledby="booking-details" className="scroll-mt-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6 rounded-[20px] border border-solid border-ink-150 bg-white p-5 md:p-8">
          <h2 id="booking-details" ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[clamp(30px,3.6vw,40px)] leading-[1.05] font-normal outline-none">
            {portal ? t.detailsTitlePortal : t.detailsTitle}
          </h2>

          <div role="group" aria-label={t.whoLabel} className="flex flex-wrap self-start rounded-full bg-ink-100 p-1">
            {(["me", "other"] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={who === w}
                onClick={() => setWho(w)}
                className={`h-10 cursor-pointer rounded-full border-0 px-[18px] text-[14px] ${who === w ? "bg-ink-950 font-semibold text-white" : "bg-transparent font-medium text-ink-950"}`}
              >
                {w === "me" ? t.whoMe : t.whoOther}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {portal && booker ? (
              <div className="flex flex-col gap-1 rounded-xl bg-ink-50 px-3.5 py-2.5 md:col-span-2">
                <span className="text-[12px] text-ink-600">{t.yourName}</span>
                <span className="text-[16px] font-medium text-ink-950">
                  {booker.name} · <span className="font-normal text-ink-700">{booker.email}</span>
                </span>
              </div>
            ) : (
              <>
                {field("name", t.yourName, <input {...aria("name")} name="name" type="text" autoComplete="name" maxLength={120} className={input} />, true)}
                {field("email", t.email, <input {...aria("email")} name="email" type="email" autoComplete="email" maxLength={200} placeholder={t.emailPlaceholder} className={input} />)}
              </>
            )}
            {phone("", phoneCountry, setPhoneCountry, t.mobile, defaultPhone?.number)}
            {who === "other" && (
              <>
                {field("passengerName", t.passengerName, <input {...aria("passengerName")} name="passengerName" type="text" autoComplete="off" maxLength={120} defaultValue={defaults?.passengerName} placeholder={t.passengerNamePlaceholder} className={input} />)}
                {phone("passenger", passengerCountry, setPassengerCountry, t.passengerPhone, defaults?.passengerPhone?.number)}
              </>
            )}
          </div>

          {askPurpose && (
            <div>
              <p id={`${uid}-purpose`} className="m-0 mb-2.5 text-[13px] font-semibold">
                {t.purposeLabel}
              </p>
              <div role="group" aria-labelledby={`${uid}-purpose`} className="flex flex-wrap gap-2">
                {(["business", "private"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={purpose === p}
                    onClick={() => setPurpose(p)}
                    className={`h-11 cursor-pointer rounded-xl border border-solid bg-white px-[18px] text-[14px] text-ink-950 ${purpose === p ? "border-ink-950 font-semibold shadow-[0_0_0_0.5px_#0a0a0b]" : "border-ink-225 font-medium"}`}
                  >
                    {p === "business" ? t.purposeBusiness : t.purposePrivate}
                  </button>
                ))}
              </div>
            </div>
          )}

          {field("notes", t.notes, <textarea {...aria("notes")} name="notes" rows={3} maxLength={2000} defaultValue={defaults?.notes} placeholder={t.notesPlaceholder} className={`${input} min-h-[64px] resize-y font-normal`} />)}

          {!portal && (
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="m-0 max-w-[40ch] text-[12px] text-ink-600">
              {portal ? null : (
                <>
                  {t.privacyNote}{" "}
                  {privacyHref && (
                    <Link href={privacyHref} className="text-ink-950 underline underline-offset-2">
                      {t.privacyLink}
                    </Link>
                  )}
                </>
              )}
            </p>
            <div className="flex w-full gap-2.5 sm:w-auto">
              <button type="button" onClick={onBack} className="flex h-[52px] cursor-pointer items-center gap-1.5 rounded-xl border border-solid border-ink-225 bg-white px-5 text-[14px] font-semibold text-ink-950 hover:border-ink-950">
                <ArrowLeft />
                {t.back}
              </button>
              {lockedNotice ?? (
                <button type="submit" disabled={result.pending} className="h-[52px] flex-1 cursor-pointer rounded-xl border-0 bg-ink-950 px-7 text-[14px] font-semibold text-white hover:bg-ink-800 disabled:cursor-progress disabled:opacity-70 sm:flex-none">
                  {result.pending ? t.sending : t.submit}
                </button>
              )}
            </div>
          </div>
          <p aria-live="polite" className="m-0 min-h-5 text-[13px] text-error">
            {result.message ?? ""}
          </p>
        </form>

        <Summary trip={trip} copy={t} locale={locale} chosen={chosen} vehicleAdvise={vehicleAdvise} portal={portal} />
      </div>
    </section>
  );
}

function Summary({ trip, copy: t, locale, chosen, vehicleAdvise, portal }: { trip: Trip; copy: BookingCopy; locale: Locale; chosen: FleetVehicle | undefined; vehicleAdvise: string; portal: boolean }) {
  const route =
    trip.mode === "hourly"
      ? [trip.from.text, interpolate(t.asDirected, { hours: trip.hours })]
      : [trip.from.text, ...trip.stops.filter((s) => s.place).map((s) => (s.wait ? `${s.place} (${interpolate(t.waitMinutes, { minutes: s.wait })})` : s.place)), trip.to.text];
  
  const rows: [string, ReactNode][] = [
    [t.summaryRoute, route.map((r, i) => <span key={i} className="block">{i > 0 ? `→ ${r}` : r}</span>)],
    [t.summaryWhen, trip.at ? pretty(trip.at, locale) : ""],
  ];
  if (trip.ret) rows.push([t.summaryReturn, pretty(trip.ret, locale)]);
  rows.push([t.summaryParty, `${guestsText(t, trip.pax)} · ${bagsText(t, trip.bags)}`]);
  if (pickupAtAirport(trip) && trip.flight.trim()) rows.push([t.summaryFlight, trip.flight.trim()]);

  const isAdvise = trip.vehicle === "advise";
  const displayName = chosen?.name ?? (isAdvise ? vehicleAdvise : (FLEET[0]?.name ?? "Mercedes-Benz VLE 300"));
  const galleryImages = chosen?.images ?? FLEET[0]?.images ?? ["/assets/fleet-interior-v2.jpg"];
  const seats = chosen?.specs?.passengers ?? FLEET[0]?.specs?.passengers ?? null;

  return (
    <aside aria-label={t.summaryLabel} className="overflow-hidden rounded-[24px] border border-solid border-ink-225 bg-white text-ink-950 shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.08)] lg:sticky lg:top-6">
      <div className="relative aspect-[16/9.5] w-full bg-ink-900 p-2 pb-0">
        <div className="relative isolate h-full w-full overflow-hidden rounded-[16px] [clip-path:inset(0_round_16px)]">
          <VehicleGallery
            name={displayName}
            images={galleryImages}
            alt={displayName}
            copy={{
              label: "Vehicle gallery",
              prev: "Previous image",
              next: "Next image",
              enlarge: "Enlarge image",
              close: "Close",
              counter: "{current} of {total}",
              lightbox: "Lightbox",
            }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-5 p-6 pt-4">
        <div className="flex items-center justify-between gap-3 border-0 border-b border-solid border-ink-150 pb-4">
          <span className="font-serif text-[22px] leading-tight font-normal">{displayName}</span>
          {seats !== null && (
            <span className="flex items-center gap-1.5 text-[13px] text-ink-700 whitespace-nowrap">
              <SeatIcon />
              {interpolate(t.seatsUpTo, { seats })}
            </span>
          )}
        </div>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-500">{k}</dt>
              <dd className="m-0 text-ink-950 wrap-break-word">{v}</dd>
            </div>
          ))}
        </dl>
        <hr className="m-0 h-px border-0 bg-ink-150" />
        <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.nextTitle}</span>
        <ol className="m-0 flex list-none flex-col gap-3.5 p-0 text-[14px] leading-[1.45] text-ink-800">
          {[t.next1, portal ? t.next2Portal : t.next2, t.next3].map((line, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-ink-950 text-[12px] font-semibold text-white">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

/** The thank-you after a website request (the portal goes to the booking's own page instead). */
export function BookingDone({ copy: t, name, reference, onAgain }: { copy: BookingCopy; name: string; reference: string; onAgain: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div role="status" className="mx-auto flex max-w-[640px] flex-col gap-5 py-10">
      <span className="grid size-[60px] place-items-center rounded-full bg-ink-950 text-white">
        <Check size={28} />
      </span>
      <span className="text-[11px] font-semibold tracking-[0.2em] text-ink-600 uppercase">
        {t.doneEyebrow} · {reference}
      </span>
      <h2 ref={heading} tabIndex={-1} className="m-0 font-serif text-[clamp(34px,5vw,48px)] leading-[1.05] font-normal outline-none">
        {interpolate(t.doneHeading, { name })}
      </h2>
      <p className="m-0 text-[15px] text-ink-600">{t.doneNote}</p>
      <div>
        <button type="button" onClick={onAgain} className="h-[52px] cursor-pointer rounded-xl border-0 bg-ink-950 px-7 text-[14px] font-semibold text-white hover:bg-ink-800">
          {t.doneAgain}
        </button>
      </div>
    </div>
  );
}

/** Whether a trip from the URL can skip straight to choosing a car. */
export const startsAtCar = (trip: Trip) => isTripReady(trip, netherlandsNow());