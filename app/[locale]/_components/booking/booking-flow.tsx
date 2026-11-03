"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import { mapFrameSrc, type RouteMapLinks } from "@/lib/fleet/map";
import { FLEET, LARGEST_CAR_SEATS, normalizeVehicleKey, suggestVehicle, vehicleByKey, type FleetVehicle, type VehicleKey } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { VehicleGallery, type GalleryCopy } from "../vehicle-gallery";
import { netherlandsNow, type BookingCopy, type TripMessages } from "./copy";
import { bagsText, guestsText } from "./guests-picker";
import { JourneyBar } from "./journey-bar";
import { involvesAirport, isTripReady, MAX_PER_CAR, pickupAtAirport, shortPlace, tripFields, tripToParams, type Trip } from "./trip";
import { Check, pretty, SeatIcon } from "./parts";
import { CarMixPreview, convoySentence, previewCars, ReviewStep, RouteOutline, selectionLabel } from "./review-step";
import { VehicleDetails, type FleetDictionary } from "./vehicle-details";

export type BookingStep = "journey" | "car" | "details" | "review";
/** What the last submission came back with, the same for the website's action and the portal's. */
export type BookingResult = {
  pending: boolean;
  message: string | null;
  fieldErrors: Partial<Record<string, string>>;
};
export type OfferedVehicle = { key: string; name: string };
export type DetailDefaults = {
  notes?: string;
  passengerName?: string;
  passengerPhone?: { country: string; number: string };
  entity?: string;
  entityKvk?: string;
};

// Fields the server checks, by the step that asks for them: an error sends the visitor back there
const JOURNEY_FIELDS = ["collection", "destination", "pickupAt", "returnAt", "durationHours", "flightNumber", "passengers", "luggage", "service"];
const CAR_FIELDS = ["vehicle"];
const DETAILS_FIELDS = ["name", "email", "phone", "phoneCountry", "passengerName", "passengerPhone", "passengerPhoneCountry", "entity", "entityKvk", "notes"];

/** What the visitor typed on the details step, kept while they review (and go back to change it). */
export type DetailsEntry = { who: "me" | "other"; purpose: "business" | "private"; fields: [string, string][] };

const PASSENGER_FIELDS = ["passengerName", "passengerPhone", "passengerPhoneCountry"];
const COMPANY_FIELDS = ["entity", "entityKvk"];
/**
 * The details that are sent: everything typed is kept (so switching back to "someone else" or "business" finds it again),
 * but a passenger is only sent when someone else travels, and a company only for business on the website.
 */
export function sentFields(entry: DetailsEntry, variant: "public" | "portal"): [string, string][] {
  return entry.fields.filter(
    ([k]) => !(entry.who === "me" && PASSENGER_FIELDS.includes(k)) && !((entry.purpose === "private" || variant === "portal") && COMPANY_FIELDS.includes(k)),
  );
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);


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
  cancelHref,
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
  booker?: { name: string; email: string; companyName?: string | null };
  defaultPhone?: { country: string; number: string };
  /** Portal "repeat this booking": the details step starts from the earlier booking's notes and passenger */
  defaults?: DetailDefaults;
  privacyHref?: string;
  /** Where the journey step's Cancel leads */
  cancelHref?: string;
  /** Shown above the flow, e.g. "Filled in from EE-XXXXXX" in the portal */
  notice?: string;
  /** Portal: the session ran out; a sign-in link in place of the submit button */
  lockedNotice?: ReactNode;
}) {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  // The journey as it is being typed, for the outline beside the form; the trip itself changes when the step is done
  const [draft, setDraft] = useState<Trip>(initialTrip);
  // Bumps when Edit is pressed so the journey form mounts again from the trip as it is now
  const [journeyEdit, setJourneyEdit] = useState(0);
  const [step, setStep] = useState<BookingStep>(initialStep);
  const [entered, setEntered] = useState<DetailsEntry | null>(null);
  const [details, setDetails] = useState<FleetVehicle | null>(null);
  const router = useRouter();
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

  // The cars a confirmed booking already holds at this pick-up are not offered. Asked when the car step shows, and again if
  // the trip changes; the answer is only keys. If it cannot be asked every car is offered, and the team is stopped
  // from confirming a clash anyway.
  const [booked, setBooked] = useState<ReadonlySet<string>>(new Set());
  const asked = step === "car" && trip.at ? `${trip.at}|${trip.mode === "hourly" ? trip.hours : ""}|${trip.mode === "oneway" ? trip.ret : ""}` : "";
  useEffect(() => {
    if (!asked) return;
    const [at, hours, ret] = asked.split("|");
    const query = new URLSearchParams({ at });
    if (hours) query.set("hours", hours);
    if (ret) query.set("returnAt", ret);
    const controller = new AbortController();
    fetch(`/api/vehicles/unavailable?${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { busy?: string[] } | null) => {
        if (!data?.busy) return;
        const keys = new Set(data.busy.map((k) => normalizeVehicleKey(k) ?? k));
        setBooked(keys);
        // A car chosen earlier that is taken at this time is let go
        setTrip((current) => {
          const cars = current.cars.filter((c) => !keys.has(c.key));
          const held = current.vehicle !== "" && current.vehicle !== "advise" && keys.has(normalizeVehicleKey(current.vehicle) ?? current.vehicle);
          if (cars.length === current.cars.length && !held) return current;
          return { ...current, cars, vehicle: cars[0]?.key ?? (held ? "" : current.vehicle) };
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [asked]);
  const offered = vehicles.filter((v) => !booked.has(normalizeVehicleKey(v.key) ?? v.key));

  // A server error belongs to a step: go back to it (once per answer from the server)
  const errorKeys = Object.keys(result.fieldErrors);
  const [answered, setAnswered] = useState(result.fieldErrors);
  if (answered !== result.fieldErrors) {
    setAnswered(result.fieldErrors);
    if (errorKeys.some((k) => JOURNEY_FIELDS.includes(k))) setStep("journey");
    else if (errorKeys.some((k) => CAR_FIELDS.includes(k))) setStep("car");
    else if (errorKeys.some((k) => DETAILS_FIELDS.includes(k))) setStep("details");
  }
  const journeyErrors = errorKeys.filter((k) => JOURNEY_FIELDS.includes(k)).map((k) => result.fieldErrors[k]);

  const chosen = vehicleByKey(trip.vehicle);
  const steps: [BookingStep, string][] = [["journey", t.stepJourney], ["car", t.stepCar], ["details", t.stepDetails], ["review", t.stepReview]];
  const stepIndex = steps.findIndex(([s]) => s === step);
  // The book page's own journey step. The review step uses it so the contact details already typed stay on the page.
  const showJourney = () => {
    setDraft(trip);
    setJourneyEdit((n) => n + 1);
    go("journey");
  };
  // Website: Edit and Back return to the homepage bar, with this trip in the URL so the fields are filled.
  const editJourney = () => {
    if (variant === "public" && cancelHref) {
      const q = tripToParams(trip).toString();
      router.push(q ? `${cancelHref}?${q}#enquire` : `${cancelHref}#enquire`);
      return;
    }
    showJourney();
  };

  const tripLine = [
    trip.mode === "hourly"
      ? `${shortPlace(trip.from)} · ${interpolate(t.asDirected, { hours: trip.hours })}`
      : [shortPlace(trip.from), ...trip.stops.filter((s) => s.place).map(() => "…"), shortPlace(trip.to)].join(" → "),
    trip.at ? pretty(trip.at, locale) : "",
    guestsText(t, trip.pax),
    bagsText(t, trip.bags),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="flex w-full flex-col gap-6">
      {notice && <p className="m-0 rounded-xl bg-ink-100 px-4 py-3 text-[14px] text-ink-800">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {step === "car" || step === "details" ? (
          <button
            type="button"
            onClick={editJourney}
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
          <h2 id="booking-journey" ref={heading} tabIndex={-1} className="m-0 font-serif text-[clamp(32px,4vw,44px)] leading-[1.05] font-normal outline-none">
            {t.heading}
          </h2>
          <p className="m-0 mt-2 mb-6 text-[15px] text-ink-600">{t.journeyIntro}</p>
          {journeyErrors.length > 0 && (
            <p role="alert" className="m-0 mb-4 rounded-xl bg-[#fef3f2] px-4 py-3 text-[14px] text-error">
              {journeyErrors.join(" ")}
            </p>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            <JourneyBar
              key={journeyEdit}
              locale={locale}
              copy={t}
              dateTimeCopy={dateTimeCopy}
              messages={messages}
              tone="light"
              layout="stacked"
              initial={trip}
              cancelHref={cancelHref}
              onTripChange={setDraft}
              onDone={(next) => {
                setTrip(next);
                go("car");
              }}
            />
            <RouteOutline trip={draft} copy={t} locale={locale} />
          </div>
        </section>
      )}

      {step === "car" && (
        <CarStep
          headingRef={heading}
          trip={trip}
          vehicles={offered}
          bookedCount={vehicles.length - offered.length}
          copy={t}
          error={result.fieldErrors.vehicle}
          onDetails={setDetails}
          onCars={(key, count) => setTrip((current) => withCarCount(current, key, count))}
          onAdvise={() => setTrip((current) => ({ ...current, cars: [], vehicle: current.vehicle === "advise" ? "" : "advise" }))}
          onBack={editJourney}
          onNext={() => {
            setTrip((current) => {
              if (current.cars.length > 0) return { ...current, vehicle: current.cars[0].key };
              if (current.vehicle === "advise") return current;
              // Nothing chosen, and the party does not fit in one car: leave the mix to us.
              if (current.pax > LARGEST_CAR_SEATS) return { ...current, vehicle: "advise" };
              const pick = suggestVehicle(offered, { pax: current.pax, bags: current.bags });
              return pick ? { ...current, vehicle: pick.key, cars: [{ key: pick.key, count: 1 }] } : { ...current, vehicle: "advise" };
            });
            go("details");
          }}
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
          booker={booker}
          defaultPhone={defaultPhone}
          defaults={defaults}
          privacyHref={privacyHref}
          entered={entered}
          messages={messages}
          gallery={galleryCopy(fleetDict)}
          onBack={() => go("car")}
          onReview={(entry) => {
            setEntered(entry);
            go("review");
          }}
        />
      )}

      {step === "review" && entered && (
        <ReviewStep
          headingRef={heading}
          variant={variant}
          trip={trip}
          entered={entered}
          copy={t}
          locale={locale}
          chosen={chosen}
          vehicleAdvise={vehicleAdvise}
          result={result}
          booker={booker}
          privacyHref={privacyHref}
          lockedNotice={lockedNotice}
          gallery={galleryCopy(fleetDict)}
          onEdit={(next) => (next === "journey" ? showJourney() : go(next))}
          onSend={() => {
            const data = new FormData();
            for (const [k, v] of sentFields(entered, variant)) data.append(k, v);
            for (const [k, v] of tripFields(trip, entered.purpose)) data.append(k, v);
            data.set("locale", locale);
            startTransition(() => submit(data));
          }}
        />
      )}

      <VehicleDetails vehicle={details} onClose={() => setDetails(null)} fleetDict={fleetDict} locale={locale} closeLabel={fleetDict.galleryClose} />
    </div>
  );
}

function galleryCopy(t: FleetDictionary): GalleryCopy {
  return {
    label: t.galleryLabel,
    prev: t.galleryPrev,
    next: t.galleryNext,
    enlarge: t.galleryEnlarge,
    close: t.galleryClose,
    counter: t.galleryCounter,
    lightbox: t.galleryLightbox,
  };
}

function withCarCount(trip: Trip, key: VehicleKey, count: number): Trip {
  const next = trip.cars.filter((c) => c.key !== key);
  const n = Math.min(MAX_PER_CAR, Math.max(0, Math.trunc(count)));
  if (n > 0) next.push({ key, count: n });
  const order = new Map(FLEET.map((v, i) => [v.key, i]));
  next.sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
  return { ...trip, cars: next, vehicle: next[0]?.key ?? "" };
}

function CarStep({ headingRef, trip, vehicles, bookedCount, copy: t, error, onDetails, onCars, onAdvise, onBack, onNext }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  trip: Trip;
  vehicles: OfferedVehicle[];
  /** Cars left out because a confirmed booking already holds them at this time */
  bookedCount: number;
  copy: BookingCopy;
  error?: string;
  onDetails: (v: FleetVehicle) => void;
  onCars: (key: VehicleKey, count: number) => void;
  onAdvise: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const large = trip.pax > LARGEST_CAR_SEATS;
  const convoy = convoySentence(t, trip);
  const cars = vehicles
    .map((v) => FLEET.find((f) => f.key === normalizeVehicleKey(v.key)))
    .filter((v): v is FleetVehicle => Boolean(v))
    .map((v) => ({ vehicle: v, seats: v.specs?.passengers ?? null }));
  const party = guestsText(t, trip.pax);
  const fitting = cars.filter((c) => c.seats === null || c.seats >= trip.pax).length;
  const totalCars = trip.cars.reduce((n, c) => n + c.count, 0);
  const advise = trip.vehicle === "advise" && trip.cars.length === 0;
  const qtyButton = "grid size-9 cursor-pointer place-items-center rounded-full border border-solid border-[#c5d0e6] bg-[#ffffff] text-[18px] leading-none text-[#10224f] hover:border-[#10224f] disabled:cursor-default disabled:opacity-40";

  const card = (c: (typeof cars)[number]) => {
    const count = trip.cars.find((pick) => pick.key === c.vehicle.key)?.count ?? 0;
    const selected = count > 0;
    return (
      <li key={c.vehicle.key} className="relative">
        <div
          className={`flex flex-col rounded-2xl bg-white text-ink-950 ${
            selected ? "border-2 border-solid border-ink-950 p-[7px] shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.12)]" : "border border-solid border-ink-225 p-2"
          }`}
        >
          <button
            type="button"
            aria-pressed={selected}
            onClick={() => onCars(c.vehicle.key, selected ? 0 : 1)}
            className="flex w-full cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-inherit disabled:cursor-default"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- small cover photo from /public; next/image would need sizes per breakpoint for no gain here */}
            <img src={c.vehicle.images[0]} alt="" className="aspect-[16/9.5] w-full rounded-[11px] object-cover" />
            <span className="flex items-center justify-between gap-3 px-1.5 pt-3 pb-1.5">
              <span className="text-[15px] font-semibold">{c.vehicle.name}</span>
              {c.seats !== null && (
                <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-700">
                  <SeatIcon />
                  {interpolate(t.seatsUpTo, { seats: c.seats })}
                </span>
              )}
            </span>
            <span
              className={`m-1.5 flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold ${
                selected ? "bg-ink-950 text-white" : "border border-solid border-ink-225 text-ink-950"
              }`}
            >
              {selected ? (
                <>
                  <Check />
                  {count > 1 ? `${count} · ${t.carSelected}` : t.carSelected}
                </>
              ) : (
                t.carSelect
              )}
            </span>
          </button>
          <span className="flex items-center justify-center gap-2 px-2 pt-1 pb-2">
            <button type="button" aria-label={interpolate(t.fewerOf, { car: c.vehicle.name })} disabled={count <= 0} onClick={() => onCars(c.vehicle.key, count - 1)} className={qtyButton}>
              −
            </button>
            <span className="box-border inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-lg border border-solid border-[#c5d0e6] bg-[#ffffff] [color-scheme:light]">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_PER_CAR}
                aria-label={interpolate(t.countOf, { car: c.vehicle.name })}
                value={count}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value !== "" && Number.isInteger(n)) onCars(c.vehicle.key, n);
                }}
                className="w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-center text-[15px] font-semibold leading-none text-[#10224f] tabular-nums outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </span>
            <button type="button" aria-label={interpolate(t.moreOf, { car: c.vehicle.name })} disabled={count >= MAX_PER_CAR} onClick={() => onCars(c.vehicle.key, count + 1)} className={qtyButton}>
              +
            </button>
          </span>
          {selected && (
            <span aria-hidden="true" className="absolute top-[18px] left-[18px] grid size-8 place-items-center rounded-full bg-ink-950 text-white">
              <Check size={15} />
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDetails(c.vehicle)}
          aria-label={interpolate(t.carDetails, { car: c.vehicle.name })}
          className="absolute top-[18px] right-[18px] grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-[#ffffff] text-[#10224f] shadow-sm hover:bg-[#e8eeff]"
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
        {large ? t.carIntroLarge : interpolate(t.carIntro, { fits: fitting, total: cars.length, party })}
      </p>
      {convoy && <p className="m-0 mt-3 rounded-xl border border-solid border-ink-225 bg-white px-4 py-3 text-[14px] text-ink-950">{convoy}</p>}
      {bookedCount > 0 && <p className="m-0 mt-2 text-[14px] text-ink-600">{interpolate(t.carsBookedNote, { count: bookedCount })}</p>}
      {error && (
        <p role="alert" className="m-0 mt-3 text-[14px] text-error">
          {error}
        </p>
      )}
      <ul aria-labelledby="booking-car" className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map(card)}
        <li>
          <button
            type="button"
            aria-pressed={advise}
            onClick={onAdvise}
            className={`flex h-full min-h-[200px] w-full cursor-pointer flex-col justify-between gap-4 rounded-2xl p-[22px] text-left text-ink-950 ${
              advise ? "border-2 border-solid border-ink-950 bg-white p-[21px]" : "border border-dashed border-ink-400 bg-transparent hover:border-ink-950"
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
              {totalCars > 1
                ? interpolate(t.continueWithCount, { count: totalCars })
                : totalCars === 1
                  ? interpolate(t.continueWith, { car: vehicleByKey(trip.cars[0].key)?.name ?? "" })
                  : advise
                    ? t.continueWithout
                    : t.skipCar}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Calling-code list drawn by us. The browser's own menu paints pale type on white inside the navy page, so the codes disappear. */
function CountryCode({ name, label, country, onChange }: { name: string; label: string; country: string; onChange: (country: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = COUNTRY_CODES.find(([code]) => code === country) ?? COUNTRY_CODES[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <input type="hidden" name={name} value={country} />
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((value) => !value)}
        className="flex cursor-pointer items-center gap-1 border-0 border-r border-solid border-ink-225 bg-transparent p-0 pr-2 text-[16px] font-medium text-ink-950"
      >
        {current[1]} +{current[0]}
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className="absolute top-full left-0 z-50 m-0 mt-2 max-h-60 w-44 list-none overflow-y-auto rounded-xl border border-solid border-[#d5d8e6] bg-[#ffffff] p-1 text-[#10224f] shadow-2xl [color-scheme:light] [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
          {COUNTRY_CODES.map(([code, iso]) => (
            <li key={code} role="option" aria-selected={code === country}>
              <button
                type="button"
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center rounded-lg border-0 px-3 py-2 text-left text-[14px] text-[#10224f] ${code === country ? "bg-[#e7edff] font-semibold" : "bg-transparent hover:bg-[#f2f5ff]"}`}
              >
                {iso} +{code}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailsStep({ headingRef, variant, trip, copy: t, locale, chosen, vehicleAdvise, result, booker, defaultPhone, defaults, privacyHref, entered, messages, gallery, onBack, onReview }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  variant: "public" | "portal";
  trip: Trip;
  copy: BookingCopy;
  locale: Locale;
  chosen: FleetVehicle | undefined;
  vehicleAdvise: string;
  result: BookingResult;
  booker?: { name: string; email: string; companyName?: string | null };
  defaultPhone?: { country: string; number: string };
  defaults?: DetailDefaults;
  privacyHref?: string;
  /** What was typed here before the visitor went on to the review: the form starts from it when they come back */
  entered: DetailsEntry | null;
  messages: TripMessages;
  gallery: GalleryCopy;
  onBack: () => void;
  onReview: (entry: DetailsEntry) => void;
}) {
  const uid = useId();
  const saved = new Map(entered?.fields);
  // A value typed earlier, else what the page brought (the portal's "repeat this booking")
  const typed = (name: string, fallback?: string) => saved.get(name) ?? fallback;
  const [who, setWho] = useState<"me" | "other">(entered?.who ?? (defaults?.passengerName ? "other" : "me"));
  const [purpose, setPurpose] = useState<"business" | "private">(entered?.purpose ?? "business");
  const [phoneCountry, setPhoneCountry] = useState(typed("phoneCountry", defaultPhone?.country) ?? "31");
  const [passengerCountry, setPassengerCountry] = useState(typed("passengerPhoneCountry", defaults?.passengerPhone?.country) ?? "31");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors: Record<string, string | undefined> = { ...result.fieldErrors, ...localErrors };
  const portal = variant === "portal";

  // Checked here, before the review, so the review only ever shows a booking that can be sent; the server checks again
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (k: string) => String(data.get(k) ?? "").trim();
    const found: Record<string, string> = {};
    if (!portal && !value("name")) found.name = messages.nameRequired;
    if (!portal && !EMAIL.test(value("email"))) found.email = messages.emailInvalid;
    if (value("phone").replace(/\D/g, "").length < 6) found.phone = messages.phoneNumberInvalid;
    if (who === "other" && !value("passengerName")) found.passengerName = t.passengerNameRequired;
    setLocalErrors(found);
    const first = ["name", "email", "phone", "passengerName"].find((k) => found[k]);
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    onReview({ who, purpose, fields: [...data.entries()].map(([k, v]) => [k, String(v)]) });
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
      <span className="flex min-w-0 items-center gap-2.5">
        <CountryCode
          name={code}
          label={t.phoneCountry}
          country={country}
          onChange={(next) => {
            setCountry(next);
            const typed = document.getElementById(`${uid}-${number}`);
            if (typed instanceof HTMLInputElement) typed.value = cleanPhoneInput(typed.value, next);
          }}
        />
        <input
          {...aria(number)}
          name={number}
          type="text"
          inputMode="tel"
          autoComplete={prefix ? "off" : "tel-national"}
          maxLength={PASTE_MAX}
          defaultValue={defaultValue}
          placeholder={t.phonePlaceholder}
          onInput={(e) => {
            e.currentTarget.value = cleanPhoneInput(e.currentTarget.value, country);
          }}
          className={`${input} flex-1`}
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

          <div role="group" aria-label={t.whoLabel} className="grid w-full max-w-full grid-cols-2 gap-1 self-start rounded-full bg-ink-100 p-1 sm:inline-grid sm:w-auto">
            {(["me", "other"] as const).map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={who === w}
                onClick={() => setWho(w)}
                className={`min-h-10 min-w-0 cursor-pointer rounded-full border-0 px-3 py-1 text-center text-[13px] leading-tight sm:px-[18px] sm:text-[14px] ${who === w ? "bg-ink-950 font-semibold text-white" : "bg-transparent font-medium text-ink-950"}`}
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
                  {booker.name}
                  {booker.companyName ? ` (${booker.companyName})` : ""} ·{" "}
                  <span className="font-normal text-ink-700">{booker.email}</span>
                </span>
              </div>
            ) : (
              <>
                {field("name", t.yourName, <input {...aria("name")} name="name" type="text" autoComplete="name" maxLength={120} defaultValue={typed("name")} className={input} />, true)}
                {field("email", t.email, <input {...aria("email")} name="email" type="text" inputMode="email" autoComplete="email" spellCheck={false} maxLength={200} defaultValue={typed("email")} placeholder={t.emailPlaceholder} className={input} />)}
              </>
            )}
            {phone("", phoneCountry, setPhoneCountry, t.mobile, typed("phone", defaultPhone?.number))}
            {who === "other" && (
              <>
                {field("passengerName", t.passengerName, <input {...aria("passengerName")} name="passengerName" type="text" autoComplete="off" maxLength={120} defaultValue={typed("passengerName", defaults?.passengerName)} placeholder={t.passengerNamePlaceholder} className={input} />)}
                {phone("passenger", passengerCountry, setPassengerCountry, t.passengerPhone, typed("passengerPhone", defaults?.passengerPhone?.number))}
              </>
            )}
          </div>

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
                  className={`purpose-choice h-11 cursor-pointer rounded-xl border border-solid bg-white px-[18px] text-[14px] text-ink-950 ${
                    purpose === p ? "border-ink-950 font-semibold" : "border-ink-225 font-medium"
                  }`}
                >
                  {p === "business" ? t.purposeBusiness : t.purposePrivate}
                </button>
              ))}
            </div>
          </div>

          {purpose === "business" && !portal && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {field(
                "entity",
                locale === "nl" ? "Bedrijfsnaam" : "Company / Organization",
                <input
                  {...aria("entity")}
                  name="entity"
                  type="text"
                  autoComplete="organization"
                  maxLength={200}
                  defaultValue={typed("entity", defaults?.entity)}
                  placeholder={locale === "nl" ? "bv. Acme B.V." : "e.g. Acme Corporation"}
                  className={input}
                />,
              )}
              {field(
                "entityKvk",
                locale === "nl" ? "KVK-nummer" : "KVK / CoC Number",
                <input
                  {...aria("entityKvk")}
                  name="entityKvk"
                  type="text"
                  autoComplete="off"
                  maxLength={30}
                  defaultValue={typed("entityKvk", defaults?.entityKvk)}
                  placeholder={locale === "nl" ? "8 cijfers (optioneel)" : "8 digits (optional)"}
                  className={input}
                />,
              )}
            </div>
          )}

          {field("notes", t.notes, <textarea {...aria("notes")} name="notes" rows={3} maxLength={2000} defaultValue={typed("notes", defaults?.notes)} placeholder={t.notesPlaceholder} className={`${input} min-h-[64px] resize-y font-normal`} />)}

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
                    <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="text-ink-950 underline underline-offset-2">
                      {t.privacyLink}
                    </a>
                  )}
                </>
              )}
            </p>
            <div className="flex w-full gap-2.5 sm:w-auto">
              <button type="button" onClick={onBack} className="flex h-[52px] cursor-pointer items-center gap-1.5 rounded-xl border border-solid border-ink-225 bg-white px-5 text-[14px] font-semibold text-ink-950 hover:border-ink-950">
                <ArrowLeft />
                {t.back}
              </button>
              <button type="submit" className="flex h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-ink-950 px-7 text-[14px] font-semibold text-white hover:bg-ink-800 sm:flex-none">
                {t.reviewButton}
                <ArrowRight />
              </button>
            </div>
          </div>
          {/* A send the server turned back lands here: say why, as well as marking the fields */}
          <p aria-live="polite" className="m-0 min-h-5 text-[13px] text-error">
            {Object.keys(result.fieldErrors).some((k) => DETAILS_FIELDS.includes(k)) ? (result.message ?? "") : ""}
          </p>
        </form>

        <Summary trip={trip} copy={t} locale={locale} chosen={chosen} vehicleAdvise={vehicleAdvise} portal={portal} gallery={gallery} />
      </div>
    </section>
  );
}

function Summary({ trip, copy: t, locale, chosen, vehicleAdvise, portal, gallery }: { trip: Trip; copy: BookingCopy; locale: Locale; chosen: FleetVehicle | undefined; vehicleAdvise: string; portal: boolean; gallery: GalleryCopy }) {
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

  const picks = trip.cars.filter((c) => c.count > 0);
  const convoy = convoySentence(t, trip);
  const listed = picks.length > 1 || (picks[0]?.count ?? 0) > 1
    ? picks.map((p) => `${p.count} × ${vehicleByKey(p.key)?.name ?? p.key}`).join(", ")
    : null;
  if (listed) rows.push([t.reviewVehicle, listed]);
  else if (convoy) rows.push([t.reviewVehicle, convoy]);
  const label = selectionLabel(t, trip);
  const mix = previewCars(trip);
  const lead = picks.length > 0 ? vehicleByKey(picks[0].key) : chosen;
  const displayName = label ?? lead?.name ?? vehicleAdvise;
  const galleryImages = mix.length > 0 ? [] : (lead?.images ?? []);
  const seats = label ? null : (lead?.specs?.passengers ?? null);

  return (
    <aside aria-label={t.summaryLabel} className="overflow-hidden rounded-[24px] border border-solid border-ink-225 bg-white text-ink-950 shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.08)] lg:sticky lg:top-6">
      {mix.length > 0 ? (
        <div className="p-4 pb-0">
          <CarMixPreview cars={mix} copy={gallery} />
        </div>
      ) : (
        <div className="relative aspect-[16/9.5] w-full bg-ink-900">
          <div className="relative isolate h-full w-full overflow-hidden">
            {galleryImages.length > 0 ? (
              <VehicleGallery key={galleryImages.join("|")} name={displayName} images={galleryImages} alt={displayName} copy={gallery} />
            ) : (
              <div className="grid h-full place-items-center px-6 text-center font-serif text-[22px] text-[#fff]">{displayName}</div>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-5 p-6 pt-4">
        <div className="flex items-start justify-between gap-3 border-0 border-b border-solid border-ink-150 pb-4">
          {listed ? (
            <span className="flex flex-col gap-1 font-serif text-[22px] leading-tight font-normal">
              {picks.map((p) => (
                <span key={p.key}>
                  {p.count} × {vehicleByKey(p.key)?.name ?? p.key}
                </span>
              ))}
            </span>
          ) : (
            <span className="font-serif text-[22px] leading-tight font-normal">{displayName}</span>
          )}
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
export function BookingDone({ copy: t, name, reference, map, onAgain }: { copy: BookingCopy; name: string; reference: string; map?: RouteMapLinks | null; onAgain: () => void }) {
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
      {map && <RouteMap map={map} copy={t} />}
      <div>
        <button type="button" onClick={onAgain} className="h-[52px] cursor-pointer rounded-xl border-0 bg-ink-950 px-7 text-[14px] font-semibold text-white hover:bg-ink-800">
          {t.doneAgain}
        </button>
      </div>
    </div>
  );
}

/**
 * The booking's route on Google's map, on the confirmation only: no step before it loads a map. A short frame, shown
 * straight away. With no browser key the frame still draws the route; the page does not fall back to a text link.
 */
export function RouteMap({ map, copy: t }: { map: RouteMapLinks; copy: Pick<BookingCopy, "doneMapTitle" | "doneMapFrame"> }) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-4 text-ink-950">
      <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.doneMapTitle}</span>
      <div className="h-[280px] max-h-[280px] w-full overflow-hidden rounded-[12px]">
        <iframe title={t.doneMapFrame} src={mapFrameSrc(map)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-full w-full border-0" />
      </div>
    </div>
  );
}

/** Whether a trip from the URL can skip straight to choosing a car. */
export const startsAtCar = (trip: Trip) => isTripReady(trip, netherlandsNow());