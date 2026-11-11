"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { DateTimeCopy } from "@/components/date-time-field";
import { mapFrameSrc, type RouteMapLinks } from "@/lib/fleet/map";
import { FLEET, LARGEST_CAR_SEATS, normalizeVehicleKey, suggestVehicle, vehicleByKey, type FleetVehicle, type VehicleKey } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { COUNTRY_CODES } from "@/lib/quotes/constants";
import { receiptLineItems } from "@/lib/pricing/receipt-lines";
import { formatCents, hourlyRate, hoursByDay, kmPerHour, MIN_HOURS, type Price, type Segment, SERVICE_FEE_CENTS } from "@/lib/pricing/rates";
import { extraName } from "@/lib/pricing/extras";
import { cleanPhoneInput, PASTE_MAX } from "@/lib/phone";
import { VehicleGallery, type GalleryCopy } from "../vehicle-gallery";
import { netherlandsNow, type AddOnsCopy, type BookingCopy, type TripMessages } from "./copy";
import { guestsText, luggageLine, partyLine } from "./guests-picker";
import { JourneyBar } from "./journey-bar";
import { carsCapacityProblem, involvesAirport, isTripReady, MAX_PER_CAR, normalizeTrip, pickupAtAirport, shortPlace, tripFields, tripToParams, type Trip } from "./trip";
import { Check, pretty, SeatIcon } from "./parts";
import { dayLabel, segmentOf } from "./price";
import { CarMixPreview, convoySentence, previewCars, ReviewStep, RouteOutline, selectionLabel } from "./review-step";
import { buildReceiptPdf, downloadReceiptPdf } from "./receipt-pdf";
import { bookingsSent } from "./sent";
import { VehicleDetails, type FleetDictionary } from "./vehicle-details";
import { ExtrasStep } from "./extras-step";

export type BookingStep = "journey" | "car" | "extras" | "details" | "review";
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

const JOURNEY_FIELDS = ["collection", "destination", "pickupAt", "durationHours", "flightNumber", "passengers", "luggage", "service"];
const CAR_FIELDS = ["vehicle"];
const EXTRAS_FIELDS = ["extras"];
const DETAILS_FIELDS = ["name", "email", "phone", "phoneCountry", "passengerName", "passengerPhone", "passengerPhoneCountry", "entity", "entityKvk", "notes"];

export type DetailsEntry = { who: "me" | "other"; purpose: "business" | "private"; fields: [string, string][] };

const PASSENGER_FIELDS = ["passengerName", "passengerPhone", "passengerPhoneCountry"];
const COMPANY_FIELDS = ["entity", "entityKvk"];

export function sentFields(entry: DetailsEntry, _variant: "public" | "portal"): [string, string][] {
  return entry.fields.filter(
    ([k]) => !(entry.who === "me" && PASSENGER_FIELDS.includes(k)) && !(entry.purpose === "private" && COMPANY_FIELDS.includes(k)),
  );
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_STEPS: BookingStep[] = ["journey", "car", "extras", "details", "review"];

type BookingDraft = { sent: number; step: BookingStep; trip: Trip; draft: Trip; entered: DetailsEntry | null };

const draftKey = () => `ee-booking-draft:${window.location.pathname}${window.location.search}`;

const isTrip = (value: unknown): value is Trip => {
  if (!value || typeof value !== "object") return false;
  const trip = value as Trip;
  return (trip.mode === "oneway" || trip.mode === "hourly") && !!trip.from && typeof trip.from.text === "string" && !!trip.to && Array.isArray(trip.stops) && Array.isArray(trip.cars);
};

const readDraft = (): BookingDraft | null => {
  const key = draftKey();
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    let data: BookingDraft;
    try {
      data = JSON.parse(raw) as BookingDraft;
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
    if (data.sent !== bookingsSent()) return null;
    if (!DRAFT_STEPS.includes(data.step) || !isTrip(data.trip) || !isTrip(data.draft)) return null;
    const entered = data.entered;
    if (entered != null) {
      if (entered.who !== "me" && entered.who !== "other") return null;
      if (entered.purpose !== "business" && entered.purpose !== "private") return null;
      if (!Array.isArray(entered.fields)) return null;
      entered.fields = entered.fields.map((pair) => [String(pair?.[0] ?? ""), String(pair?.[1] ?? "")] as [string, string]);
    }
    if (data.step === "review" && !entered) return null;
    data.trip = normalizeTrip(data.trip);
    data.draft = normalizeTrip(data.draft);
    return data;
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
};

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

export function BookingFlow({
  variant,
  locale,
  copy: t,
  addOns,
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
  /** The add-ons' names and notes */
  addOns: AddOnsCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  fleetDict: FleetDictionary;
  vehicleAdvise: string;
  vehicles: OfferedVehicle[];
  initialTrip: Trip;
  initialStep: BookingStep;
  result: BookingResult;
  submit: (data: FormData) => void;
  booker?: { name: string; email: string; companyName?: string | null };
  defaultPhone?: { country: string; number: string };
  defaults?: DetailDefaults;
  privacyHref?: string;
  cancelHref?: string;
  notice?: string;
  lockedNotice?: ReactNode;
}) {
  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [draft, setDraft] = useState<Trip>(initialTrip);
  const [journeyEdit, setJourneyEdit] = useState(0);
  const [step, setStep] = useState<BookingStep>(initialStep);
  const [entered, setEntered] = useState<DetailsEntry | null>(null);
  const [details, setDetails] = useState<FleetVehicle | null>(null);
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const focused = useRef<BookingStep>(initialStep);

  useEffect(() => {
    if (focused.current === step) return;
    focused.current = step;
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest("section")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [step]);

  const [ready, setReady] = useState(false);
  useEffect(() => {
    const saved = readDraft();
    if (saved) {
      setTrip(saved.trip);
      setDraft(saved.draft);
      setEntered(saved.entered);
      setStep(saved.step);
      setJourneyEdit((n) => n + 1);
      focused.current = saved.step;
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      const saved: BookingDraft = { sent: bookingsSent(), step, trip, draft, entered };
      sessionStorage.setItem(draftKey(), JSON.stringify(saved));
    } catch {}
  }, [ready, step, trip, draft, entered]);
  const go = setStep;


  const errorKeys = Object.keys(result.fieldErrors);
  const [answered, setAnswered] = useState(result.fieldErrors);
  if (answered !== result.fieldErrors) {
    setAnswered(result.fieldErrors);
    if (errorKeys.some((k) => JOURNEY_FIELDS.includes(k))) setStep("journey");
    else if (errorKeys.some((k) => CAR_FIELDS.includes(k))) setStep("car");
    else if (errorKeys.some((k) => EXTRAS_FIELDS.includes(k))) setStep("extras");
    else if (errorKeys.some((k) => DETAILS_FIELDS.includes(k))) setStep("details");
  }
  const journeyErrors = errorKeys.filter((k) => JOURNEY_FIELDS.includes(k)).map((k) => result.fieldErrors[k]);

  const chosen = vehicleByKey(trip.vehicle);
  const steps: [BookingStep, string][] = [["journey", t.stepJourney], ["car", t.stepCar], ["extras", t.stepExtras], ["details", t.stepDetails], ["review", t.stepReview]];
  const stepIndex = steps.findIndex(([s]) => s === step);
  const showJourney = () => {
    setDraft(trip);
    setJourneyEdit((n) => n + 1);
    go("journey");
  };
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
    partyLine(t, trip.pax, trip.bags, trip.small),
  ].filter(Boolean).join("  ·  ");

  if (!ready) return null;

  return (
    <div className="flex w-full flex-col gap-6">
      {notice && <p className="m-0 rounded-xl bg-ink-100 px-4 py-3 text-[14px] text-ink-800">{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {step === "car" || step === "extras" || step === "details" ? (
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
              initial={draft}
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
          segment={segmentOf(variant)}
          locale={locale}
          vehicles={vehicles}
          copy={t}
          error={result.fieldErrors.vehicle}
          onDetails={setDetails}
          onCars={(key, count) => setTrip((current) => withCarCount(current, key, count))}
          onAdvise={() => setTrip((current) => normalizeTrip({ ...current, cars: [], vehicle: current.vehicle === "advise" ? "" : "advise" }))}
          onBack={editJourney}
          onNext={() => {
            let next = trip;
            if (trip.cars.length > 0) next = { ...trip, vehicle: trip.cars[0].key };
            else if (trip.vehicle !== "advise") {
              if (trip.pax > LARGEST_CAR_SEATS) next = { ...trip, vehicle: "advise" };
              else {
                const pick = suggestVehicle(vehicles, { pax: trip.pax, bags: trip.bags });
                next = pick ? { ...trip, vehicle: pick.key, cars: [{ key: pick.key, count: 1 }] } : { ...trip, vehicle: "advise" };
              }
            }
            setTrip(next);
            go("extras");
          }}
        />
      )}

      {step === "extras" && (
        <ExtrasStep
          headingRef={heading}
          extras={trip.extras}
          locale={locale}
          copy={t}
          names={addOns}
          onChange={(extras) => setTrip((current) => ({ ...current, extras }))}
          onBack={() => go("car")}
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
          booker={booker}
          defaultPhone={defaultPhone}
          defaults={defaults}
          privacyHref={privacyHref}
          entered={entered}
          messages={messages}
          gallery={galleryCopy(fleetDict)}
          onDraft={setEntered}
          onBack={() => go("extras")}
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
          addOns={addOns}
          locale={locale}
          chosen={chosen}
          vehicleAdvise={vehicleAdvise}
          result={result}
          booker={booker}
          lockedNotice={lockedNotice}
          gallery={galleryCopy(fleetDict)}
          onEdit={(next) => (next === "journey" ? showJourney() : go(next))}
          onSend={(quoted) => {
            rememberRideReceipt(buildRideReceipt({ trip, entered, booker, quoted, copy: t, addOns, locale }));
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

/** The trip with this many of one car, the other cars kept. Choosing a car is choosing yourself, so "let us choose" goes. */
function withCarCount(trip: Trip, key: VehicleKey, count: number): Trip {
  const others = trip.cars.filter((c) => c.key !== key);
  const cars = count > 0 ? [...others, { key, count: Math.min(MAX_PER_CAR, count) }] : others;
  return normalizeTrip({ ...trip, cars, vehicle: cars.length > 0 ? cars[0].key : "" });
}

function CarStep({ headingRef, trip, segment, locale, vehicles, copy: t, error, onDetails, onCars, onAdvise, onBack, onNext }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  trip: Trip;
  segment: Segment;
  locale: Locale;
  vehicles: OfferedVehicle[];
  copy: BookingCopy;
  error?: string;
  onDetails: (v: FleetVehicle) => void;
  onCars: (key: VehicleKey, count: number) => void;
  onAdvise: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const cars = vehicles
    .map((v) => FLEET.find((f) => f.key === normalizeVehicleKey(v.key)))
    .filter((v): v is FleetVehicle => Boolean(v))
    .map((v) => ({ vehicle: v, seats: v.specs?.passengers ?? null }));
  const party = guestsText(t, trip.pax);
  const totalCars = trip.cars.reduce((n, c) => n + c.count, 0);
  const advise = trip.vehicle === "advise" && trip.cars.length === 0;
  const recommendation = suggestVehicle(cars.map((c) => c.vehicle), { pax: trip.pax, bags: trip.bags });
  // The days the booking is billed at: an hourly booking's own hours, a transfer's two-hour minimum (its drive is timed
  // on the review). Past midnight into the weekend the next day's rate applies, so both rates are shown.
  const days = trip.at ? hoursByDay(trip.at, trip.mode === "hourly" && trip.hours !== "" ? trip.hours : MIN_HOURS).map((part) => part.day) : [];
  const split = days.length > 1;
  const rateOf = (key: string) =>
    days.flatMap((day) => {
      const rate = hourlyRate(key, segment, day);
      if (rate === null) return [];
      const price = formatCents(rate, locale);
      return [split ? interpolate(t.carRateDay, { price, day: dayLabel(t, day) }) : interpolate(t.carRate, { price })];
    });
  // Several cars may be chosen (the client, 7 Nov 2026): together they have to seat the party and take its suitcases
  const fit = carsCapacityProblem(trip.cars, trip.pax, trip.bags);
  const blockedSelection = fit.passengers || fit.luggage;
  const luggage = luggageLine(t, trip.bags, trip.small);
  const fitMessage = fit.passengers && fit.luggage
    ? interpolate(t.carsFitBoth, { party, bags: luggage })
    : fit.passengers
      ? interpolate(t.carsFitPassengers, { party })
      : fit.luggage
        ? interpolate(t.carsFitLuggage, { bags: luggage })
        : null;
  const qtyButton = "grid size-9 cursor-pointer place-items-center rounded-full border border-solid border-ink-225 bg-white text-[18px] leading-none text-ink-950 hover:border-ink-950 disabled:cursor-default disabled:opacity-40";
  const card = (c: (typeof cars)[number]) => {
    const count = trip.cars.find((pick) => pick.key === c.vehicle.key)?.count ?? 0;
    const selected = count > 0;
    // The car we would book is marked on its own card, so it can be chosen and counted like any other (the client, 8 Nov 2026)
    const recommended = recommendation?.key === c.vehicle.key;
    return (
      <li key={c.vehicle.key} className="relative">
        {/* border-box: the site has no CSS reset, so without it the border and padding come on top of h-full and the card runs 18px into the next row (the client, 9 Nov 2026) */}
        <div
          className={`box-border flex h-full flex-col rounded-2xl bg-white text-ink-950 ${
            recommended
              ? `border-2 border-solid border-emerald-500 p-[7px] ${selected ? "shadow-[0_0_0_4px_rgba(16,185,129,0.25)]" : ""}`
              : selected
                ? "border-2 border-solid border-ink-950 p-[7px] shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.12)]"
                : "border border-solid border-ink-225 p-2"
          }`}
        >
          <button
            type="button"
            aria-pressed={selected}
            // The badge sits above the button, so it is read out as the button's description
            aria-describedby={recommended ? `recommended-${c.vehicle.key}` : undefined}
            onClick={() => onCars(c.vehicle.key, selected ? 0 : 1)}
            className="flex w-full flex-1 cursor-pointer flex-col border-0 bg-transparent p-0 text-left text-inherit"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.vehicle.images[0]} alt="" className="aspect-[16/9.5] w-full rounded-[11px] object-cover" />
            <span className="flex min-w-0 items-center justify-between gap-3 px-1.5 pt-3 pb-1.5">
              <span className="min-w-0 text-[15px] font-semibold">{c.vehicle.name}</span>
              {c.seats !== null && (
                <span className="flex shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-700">
                  <SeatIcon />
                  {interpolate(t.seatsUpTo, { seats: c.seats })}
                </span>
              )}
            </span>
            {rateOf(c.vehicle.key).map((rate) => (
              <span key={rate} className="px-1.5 pb-1 text-[14px] font-medium text-ink-700 tabular-nums">
                {rate}
              </span>
            ))}
            {kmPerHour(c.vehicle.key) !== null && (
              <span className="px-1.5 pb-1 text-[12px] text-ink-600">{interpolate(t.carKmIncluded, { km: kmPerHour(c.vehicle.key)! })}</span>
            )}
            {recommended && <span className="px-1.5 pt-0.5 pb-1 text-[13px] font-semibold text-emerald-600">{interpolate(t.recommendedBasis, { party, bags: luggage })}</span>}
            {/* At the foot of every card, so the buttons of a row line up; once chosen it makes room for the counter beside it, so nothing moves */}
            <span
              className={`m-1.5 mt-auto box-border flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold ${
                selected ? "mr-[134px] bg-ink-950 text-white" : "border border-solid border-ink-225 text-ink-950"
              }`}
            >
              {selected ? (
                <>
                  <Check />
                  {t.carSelected}
                </>
              ) : (
                t.carSelect
              )}
            </span>
          </button>
          {selected && (
            <span className="absolute right-[15px] bottom-[15px] flex h-11 w-[120px] items-center justify-between">
              <button type="button" aria-label={interpolate(t.fewerOf, { car: c.vehicle.name })} onClick={() => onCars(c.vehicle.key, count - 1)} className={qtyButton}>
                −
              </button>
              <output aria-label={interpolate(t.countOf, { car: c.vehicle.name })} className="w-10 text-center text-[16px] font-semibold tabular-nums">
                {count}
              </output>
              <button
                type="button"
                aria-label={interpolate(t.moreOf, { car: c.vehicle.name })}
                disabled={count >= MAX_PER_CAR}
                onClick={() => onCars(c.vehicle.key, count + 1)}
                className={qtyButton}
              >
                +
              </button>
            </span>
          )}
          {/* On the photo, so every card's photo, name and price start at the same height */}
          {(selected || recommended) && (
            <span className="pointer-events-none absolute top-[18px] left-[18px] flex items-center gap-1.5">
              {selected && (
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-ink-950 text-white">
                  <Check size={15} />
                </span>
              )}
              {recommended && (
                <span id={`recommended-${c.vehicle.key}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-emerald-500 px-3 text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap text-[#ffffff] uppercase shadow-sm">
                  <Check size={12} />
                  {t.recommendedTitle}
                </span>
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDetails(c.vehicle)}
          aria-label={interpolate(t.carDetails, { car: c.vehicle.name })}
          className={`absolute top-[18px] right-[18px] grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-[#ffffff] text-[#10224f] shadow-sm hover:bg-[#e8eeff]`}
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
      {days.length > 0 && (
        <p className="m-0 mt-2 text-[13px] text-ink-600">
          {split
            ? interpolate(t.carRatesSplit, { days: days.map((day) => dayLabel(t, day)).join(t.carRatesAnd), fee: formatCents(SERVICE_FEE_CENTS, locale) })
            : interpolate(t.carRates, { day: dayLabel(t, days[0]), fee: formatCents(SERVICE_FEE_CENTS, locale) })}
        </p>
      )}
      <p className="m-0 mt-2 text-[13px] text-ink-600">{t.carsSeveral}</p>
      <ul aria-labelledby="booking-car" className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {[...cars].sort((a, b) => Number(b.vehicle.key === recommendation?.key) - Number(a.vehicle.key === recommendation?.key)).map(card)}
        <li>
          {/* We choose the car. The car we would book is marked on its own card above */}
          <button
            type="button"
            aria-pressed={advise}
            onClick={onAdvise}
            className={`flex h-full min-h-[200px] w-full cursor-pointer flex-col justify-between gap-4 rounded-2xl text-left text-ink-950 ${
              advise ? "border-2 border-solid border-ink-950 bg-white p-[21px]" : "border border-dashed border-ink-400 bg-transparent p-[22px] hover:border-ink-950"
            }`}
          >
            <span className="grid size-11 place-items-center rounded-xl border border-solid border-ink-225 bg-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z" />
              </svg>
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="font-serif text-[26px] leading-none">{t.noPreference}</span>
              <span className="text-[13px] text-ink-600">{interpolate(t.noPreferenceNote, { party, bags: luggage })}</span>
            </span>
          </button>
        </li>
      </ul>

      {(fitMessage || error) && (
        <p role="alert" className="m-0 mt-6 text-[13px] leading-snug text-error">
          {fitMessage ?? error}
        </p>
      )}
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
            <button type="button" onClick={onBack} className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-ink-225 bg-white px-4 text-[13px] font-semibold tracking-wide text-ink-950 hover:border-ink-950">
              <ArrowLeft />
              {t.back}
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={blockedSelection}
              className={`inline-flex h-11 flex-1 items-center justify-center rounded-lg border-0 px-5 text-[13px] font-semibold tracking-wide md:flex-none ${
                blockedSelection ? "cursor-not-allowed bg-ink-225 text-ink-600" : "cursor-pointer bg-ink-950 text-white hover:bg-ink-800"
              }`}
            >
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
        <ul role="listbox" aria-label={label} className="absolute top-full left-0 z-50 m-0 mt-2 max-h-60 w-[min(11rem,calc(100vw-2.5rem))] list-none overflow-y-auto rounded-xl border border-solid border-[#d5d8e6] bg-[#ffffff] p-1 text-[#10224f] shadow-2xl [color-scheme:light] [scrollbar-width:thin] [scrollbar-color:#d4d4d8_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
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

function DetailsStep({ headingRef, variant, trip, copy: t, locale, chosen, vehicleAdvise, result, booker, defaultPhone, defaults, privacyHref, entered, messages, gallery, onDraft, onBack, onReview }: {
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
  entered: DetailsEntry | null;
  messages: TripMessages;
  gallery: GalleryCopy;
  onDraft: (entry: DetailsEntry) => void;
  onBack: () => void;
  onReview: (entry: DetailsEntry) => void;
}) {
  const uid = useId();
  const saved = new Map(entered?.fields);
  const typed = (name: string, fallback?: string) => saved.get(name) ?? fallback;
  const [who, setWho] = useState<"me" | "other">(entered?.who ?? (defaults?.passengerName ? "other" : "me"));
  const [purpose, setPurpose] = useState<"business" | "private">(entered?.purpose ?? "business");
  const [phoneCountry, setPhoneCountry] = useState(typed("phoneCountry", defaultPhone?.country) ?? "31");
  const [passengerCountry, setPassengerCountry] = useState(typed("passengerPhoneCountry", defaults?.passengerPhone?.country) ?? "31");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const errors: Record<string, string | undefined> = { ...result.fieldErrors, ...localErrors };
  const portal = variant === "portal";
  const formRef = useRef<HTMLFormElement>(null);
  const purposeStarted = useRef(true);

  const snapshot = (form: HTMLFormElement): DetailsEntry => {
    const fields = new Map(entered?.fields);
    for (const [k, v] of new FormData(form).entries()) fields.set(k, String(v));
    if (who === "me") for (const key of PASSENGER_FIELDS) fields.delete(key);
    if (purpose === "private") for (const key of COMPANY_FIELDS) fields.delete(key);
    return { who, purpose, fields: [...fields] };
  };

  useEffect(() => {
    if (purposeStarted.current) {
      purposeStarted.current = false;
      return;
    }
    const form = formRef.current;
    if (form) onDraft(snapshot(form));
  }, [who, purpose, phoneCountry, passengerCountry]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const value = (k: string) => String(data.get(k) ?? "").trim();
    const found: Record<string, string> = {};
    if (!portal && !value("name")) found.name = messages.nameRequired;
    if (!portal && !EMAIL.test(value("email"))) found.email = messages.emailInvalid;
    if (value("phone").replace(/\D/g, "").length < 6) found.phone = messages.phoneNumberInvalid;
    if (who === "other" && !value("passengerName")) found.passengerName = t.passengerNameRequired;
    if (purpose === "business" && !value("entity")) found.entity = locale === "nl" ? "Vul het bedrijf in." : "Please enter the company or organization.";
    if (purpose === "business" && value("entityKvk").replace(/\D/g, "").length !== 8) found.entityKvk = locale === "nl" ? "Vul een KVK-nummer van 8 cijfers in." : "Enter an 8-digit KVK / CoC number.";
    setLocalErrors(found);
    const first = ["name", "email", "phone", "passengerName", "entity", "entityKvk"].find((k) => found[k]);
    if (first) {
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    const entry = snapshot(e.currentTarget);
    onDraft(entry);
    onReview(entry);
  };

  const field = (name: string, label: string, control: ReactNode, wide = false) => (
    <div className={`flex min-w-0 flex-col gap-1 rounded-xl border border-solid bg-white px-3.5 py-2.5 focus-within:border-ink-950 focus-within:shadow-[0_0_0_1px_#0a0a0b] ${errors[name] ? "border-error shadow-[0_0_0_1px_#b42318]" : "border-ink-225"} ${wide ? "md:col-span-2" : ""}`}>
      <label htmlFor={`${uid}-${name}`} className="text-[12px] text-ink-600">{label}</label>
      {control}
      {errors[name] && <span id={`${uid}-${name}-error`} className="text-[12px] text-error">{errors[name]}</span>}
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
          onInput={(e) => { e.currentTarget.value = cleanPhoneInput(e.currentTarget.value, country); }}
          className={`${input} flex-1`}
        />
      </span>,
    );
  };

  const formId = `${uid}-details`;
  const actionButtons = () => (
    <div className="flex w-full min-w-0 gap-2 sm:gap-2.5">
      <button type="button" onClick={onBack} className="inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-solid border-ink-225 bg-white px-3 text-[13px] font-semibold tracking-wide text-ink-950 hover:border-ink-950 sm:flex-none sm:px-4">
        <ArrowLeft />
        {t.back}
      </button>
      <button type="submit" form={formId} className="inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-ink-950 px-4 text-[13px] font-semibold tracking-wide text-white hover:bg-ink-800 sm:flex-none sm:px-5">
        {t.reviewButton}
        <ArrowRight />
      </button>
    </div>
  );

  return (
    <section aria-labelledby="booking-details" className="scroll-mt-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <form
          id={formId}
          ref={formRef}
          onSubmit={onSubmit}
          onInput={(e) => onDraft(snapshot(e.currentTarget))}
          noValidate
          className="flex min-w-0 max-w-full flex-col gap-5 rounded-[20px] border border-solid border-ink-150 bg-white p-4 sm:gap-6 sm:p-5 md:p-8"
        >
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
                  {booker.name}{booker.companyName ? ` (${booker.companyName})` : ""} · <span className="font-normal text-ink-700">{booker.email}</span>
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
            <p id={`${uid}-purpose`} className="m-0 mb-2.5 text-[13px] font-semibold">{t.purposeLabel}</p>
            <div role="group" aria-labelledby={`${uid}-purpose`} className="flex flex-wrap gap-2">
              {(["business", "private"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={purpose === p}
                  onClick={() => setPurpose(p)}
                  className={`purpose-choice h-11 cursor-pointer rounded-xl border border-solid bg-white px-[18px] text-[14px] text-ink-950 ${purpose === p ? "border-ink-950 font-semibold" : "border-ink-225 font-medium"}`}
                >
                  {p === "business" ? t.purposeBusiness : t.purposePrivate}
                </button>
              ))}
            </div>
          </div>

          {purpose === "business" && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {field(
                "entity",
                locale === "nl" ? "Bedrijfsnaam *" : "Company / Organization *",
                <input {...aria("entity")} name="entity" type="text" required autoComplete="organization" maxLength={200} defaultValue={typed("entity", defaults?.entity ?? booker?.companyName ?? undefined)} placeholder={locale === "nl" ? "Verplicht, bv. Acme B.V." : "Required, e.g. Acme Corporation"} className={input} />,
              )}
              {field(
                "entityKvk",
                locale === "nl" ? "KVK-nummer *" : "KVK / CoC Number *",
                <input
                  {...aria("entityKvk")}
                  name="entityKvk"
                  type="text"
                  inputMode="numeric"
                  required
                  autoComplete="off"
                  maxLength={8}
                  defaultValue={typed("entityKvk", defaults?.entityKvk)}
                  placeholder={locale === "nl" ? "Verplicht, 8 cijfers" : "Required, 8 digits"}
                  onInput={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/\D/g, "").slice(0, 8);
                  }}
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

          <div className="flex min-w-0 flex-col items-stretch gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <p className="m-0 max-w-[40ch] text-[12px] text-ink-600">
              {portal ? null : (
                <>
                  {t.privacyNote}{" "}
                  {privacyHref && <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="text-ink-950 underline underline-offset-2">{t.privacyLink}</a>}
                </>
              )}
            </p>
            <div className="hidden lg:block">{actionButtons()}</div>
          </div>
          <p aria-live="polite" className="m-0 min-h-5 text-[13px] text-error">
            {Object.keys(result.fieldErrors).some((k) => DETAILS_FIELDS.includes(k)) ? (result.message ?? "") : ""}
          </p>
        </form>

        <Summary trip={trip} copy={t} locale={locale} chosen={chosen} vehicleAdvise={vehicleAdvise} portal={portal} gallery={gallery} />
        <div className="lg:hidden">{actionButtons()}</div>
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
  rows.push([t.summaryParty, partyLine(t, trip.pax, trip.bags, trip.small)]);
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
  const advised = trip.vehicle === "advise" && picks.length === 0 ? suggestVehicle(FLEET, { pax: trip.pax, bags: trip.bags }) : undefined;
  const shown = picks.length > 0 ? vehicleByKey(picks[0].key) : chosen ?? advised;
  const displayName = advised?.name || label || shown?.name || vehicleAdvise;
  const galleryImages = mix.length > 0 ? [] : (shown?.images ?? []);
  const seats = label ? null : (shown?.specs?.passengers ?? null);

  return (
    <aside aria-label={t.summaryLabel} className="overflow-hidden rounded-[24px] border border-solid border-ink-225 bg-white text-ink-950 shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.08)] lg:sticky lg:top-6">
      {mix.length > 0 ? (
        <div className="p-4 pb-0">
          <CarMixPreview cars={mix} copy={gallery} />
        </div>
      ) : (
        <div className="relative aspect-[16/9.5] w-full bg-[#081b62]">
          <div className="relative isolate h-full w-full overflow-hidden">
            {galleryImages.length > 0 ? (
              <VehicleGallery key={galleryImages.join("|")} name={shown?.name ?? displayName} images={galleryImages} alt={shown?.name ?? displayName} copy={gallery} />
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
                <span key={p.key}>{p.count} × {vehicleByKey(p.key)?.name ?? p.key}</span>
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
              <span aria-hidden="true" className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-visible rounded-full bg-ink-950 text-[13px] leading-none font-semibold tracking-normal text-white">
                <span className="block">{i + 1}</span>
              </span>
              {line}
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

const RECEIPT_KEY = "ee-booking-receipt";

export type RideReceipt = {
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  leadPassenger: string;
  pickup: string;
  dropoff: string;
  when: string;
  hourly: boolean;
  stops: string[];
  price: Price | null;
  /** The add-ons' names as shown when booking, in the order of `price.extras` */
  extraNames?: string[];
  /** Vehicle model as shown when booking, for the receipt itinerary. */
  vehicle?: string;
  /** Passenger and luggage line, for the receipt itinerary. */
  passengers?: string;
};

const detailValue = (entry: DetailsEntry, key: string) => (entry.fields.find(([name]) => name === key)?.[1] ?? "").trim();

const phoneText = (country: string, number: string) => {
  const trimmed = number.trim();
  return trimmed ? `+${country.trim()} ${trimmed}` : "";
};

const storedPrice = (quoted: (Price & { suggested?: boolean }) | null): Price | null => {
  if (!quoted) return null;
  return {
    version: quoted.version,
    segment: quoted.segment,
    legs: quoted.legs,
    rides: quoted.rides,
    vat: quoted.vat,
    fee: quoted.fee,
    feeVat: quoted.feeVat,
    ...(quoted.extras ? { extras: quoted.extras, extrasVat: quoted.extrasVat } : {}),
    total: quoted.total,
    exact: quoted.exact,
  };
};

function buildRideReceipt({
  trip,
  entered,
  booker,
  quoted,
  copy: t,
  addOns,
  locale,
}: {
  trip: Trip;
  entered: DetailsEntry;
  booker?: { name: string; email: string };
  quoted: (Price & { suggested?: boolean }) | null;
  copy: BookingCopy;
  addOns: AddOnsCopy;
  locale: Locale;
}): RideReceipt {
  const hourly = trip.mode === "hourly";
  const lead = entered.who === "other"
    ? [detailValue(entered, "passengerName"), phoneText(detailValue(entered, "passengerPhoneCountry") || detailValue(entered, "phoneCountry"), detailValue(entered, "passengerPhone"))].filter(Boolean).join(" · ")
    : t.reviewSameAsBooker;
  return {
    passengerName: (booker?.name ?? detailValue(entered, "name")).trim(),
    passengerEmail: (booker?.email ?? detailValue(entered, "email")).trim(),
    passengerPhone: phoneText(detailValue(entered, "phoneCountry"), detailValue(entered, "phone")),
    leadPassenger: lead,
    pickup: trip.from.text.trim(),
    dropoff: hourly ? (trip.hours === "" ? "" : interpolate(t.asDirected, { hours: trip.hours })) : trip.to.text.trim(),
    when: trip.at ? pretty(trip.at, locale) : "",
    hourly,
    stops: hourly ? [] : trip.stops.map((s) => s.place.trim()).filter(Boolean),
    price: storedPrice(quoted),
    extraNames: (quoted?.extras ?? []).map((line) => extraName(addOns, line)),
    vehicle: receiptVehicle(trip, t),
    passengers: partyLine(t, trip.pax, trip.bags, trip.small),
  };
}

function receiptVehicle(trip: Trip, t: BookingCopy): string {
  const picks = trip.cars.filter((c) => c.count > 0);
  if (picks.length > 0) return picks.map((p) => `${p.count} × ${vehicleByKey(p.key)?.name ?? p.key}`).join(", ");
  if (trip.vehicle === "advise") return t.noPreference;
  return vehicleByKey(trip.vehicle)?.name ?? "";
}

function rememberRideReceipt(receipt: RideReceipt) {
  try {
    sessionStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
  } catch {}
}

function isRideReceipt(value: unknown): value is RideReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as RideReceipt;
  if (typeof receipt.passengerName !== "string" || typeof receipt.passengerEmail !== "string" || typeof receipt.passengerPhone !== "string") return false;
  if (typeof receipt.leadPassenger !== "string" || typeof receipt.pickup !== "string" || typeof receipt.dropoff !== "string") return false;
  if (typeof receipt.when !== "string" || typeof receipt.hourly !== "boolean" || !Array.isArray(receipt.stops)) return false;
  if (receipt.extraNames !== undefined && !(Array.isArray(receipt.extraNames) && receipt.extraNames.every((n) => typeof n === "string"))) return false;
  if (receipt.vehicle !== undefined && typeof receipt.vehicle !== "string") return false;
  if (receipt.passengers !== undefined && typeof receipt.passengers !== "string") return false;
  if (receipt.price == null) return true;
  return typeof receipt.price === "object" && typeof receipt.price.total === "number" && Array.isArray(receipt.price.legs);
}

const RECEIPT_FOR_KEY = "ee-booking-receipt-for";

/** Ties the receipt kept in this tab to the booking it was sent as, once the server has given it a reference. */
export function claimRideReceipt(reference: string) {
  try {
    sessionStorage.setItem(RECEIPT_FOR_KEY, reference);
  } catch {}
}

/** The receipt kept in this tab, as stored, but only for the booking it belongs to (a link to another booking has none). */
export function storedRideReceipt(reference: string): string | null {
  try {
    return sessionStorage.getItem(RECEIPT_FOR_KEY) === reference ? sessionStorage.getItem(RECEIPT_KEY) : null;
  } catch {
    return null;
  }
}

/** A stored receipt read back, or null when it is missing or not one. */
export function parseRideReceipt(raw: string | null): RideReceipt | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    return isRideReceipt(data) ? data : null;
  } catch {
    return null;
  }
}

function readRideReceipt(): RideReceipt | null {
  try {
    const raw = sessionStorage.getItem(RECEIPT_KEY);
    if (!raw) return null;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      sessionStorage.removeItem(RECEIPT_KEY);
      sessionStorage.removeItem(RECEIPT_FOR_KEY);
      return null;
    }
    return isRideReceipt(data) ? data : null;
  } catch {
    return null;
  }
}

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
    <path d="M8 8h8M8 12h8M8 16h4" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export function BookingStatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink-950 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-white uppercase">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-white" />
      {label}
    </span>
  );
}

/**
 * The receipt's price lines: the chauffeur service, each add-on, the service fee, the total before VAT and the VAT by
 * rate (9% on the rides and flowers, 21% on the service fee and the other add-ons), from the price the visitor confirmed.
 * None when that price is unknown or the server's total differs from it, so the receipt never splits a total it cannot.
 */
function receiptLines(p: Price | null, serverTotal: number | null, names: string[], t: BookingCopy): { label: string; cents: number }[] {
  if (!p || (serverTotal !== null && serverTotal !== p.total)) return [];
  // A receipt kept from an older page may lack the add-on lines: show no breakdown rather than one that does not add up
  return receiptLineItems(p, t, names) ?? [];
}

/** Small pill button on the side that opens the complete styled booking confirmation receipt modal */
export function DownloadableReceiptCard({
  copy: t,
  locale,
  reference,
  status,
  name,
  receipt,
  price,
}: {
  copy: BookingCopy;
  locale: Locale;
  reference: string;
  status: string;
  name: string;
  receipt: RideReceipt | null;
  price?: { total: number; exact: boolean } | null;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const quoted = receipt?.price ?? null;
  const totalAmount = price?.total ?? quoted?.total ?? 0;
  const euro = (cents: number) => formatCents(cents, locale);
  const lines = receiptLines(quoted, price?.total ?? null, receipt?.extraNames ?? [], t).map(({ label, cents }) => ({ label, value: euro(cents) }));
  const total = euro(totalAmount);
  const clientName = receipt?.passengerName || name;
  const route = receipt ? `${receipt.pickup} → ${receipt.dropoff}` : "";

  const onDownload = () => {
    const safe = reference.replace(/[^\w.-]+/g, "") || "receipt";
    downloadReceiptPdf(
      `ecram-execs-receipt-${safe}.pdf`,
      buildReceiptPdf({
        reference,
        status,
        clientName,
        clientEmail: receipt?.passengerEmail ?? "",
        clientPhone: receipt?.passengerPhone ?? "",
        route,
        when: receipt?.when ?? "",
        pickup: receipt?.pickup,
        stops: receipt?.stops,
        dropoff: receipt?.dropoff,
        vehicle: receipt?.vehicle,
        passengers: receipt?.passengers,
        lines,
        total,
      }),
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-full border border-[#10224f]/15 bg-[#f6f1e7] px-4 py-2.5 text-[13px] font-semibold tracking-wide text-[#10224f] shadow-sm transition hover:border-[#10224f]/35 hover:bg-[#ffffff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#10224f]"
      >
        <ReceiptIcon />
        <span>{t.receiptTitle}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3" onClick={() => setIsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[calc(100dvh-24px)] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl bg-[#081b62] font-sans text-[#ffffff] shadow-2xl"
          >
            <div className="grid shrink-0 grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-start gap-2 px-4 pt-4 pb-3">
              <span aria-hidden="true" />
              <div className="min-w-0 text-center">
                <p className="m-0 font-serif text-[11px] tracking-[0.22em] text-zinc-300 uppercase">Ecram Execs</p>
                <h3 id="receipt-title" className="m-0 mt-1 font-serif text-[20px] leading-none font-normal tracking-wide text-[#ffffff] uppercase">{t.receiptHeading}</h3>
                <p className="m-0 mt-1.5 text-[12px] text-zinc-200">Reference: {reference}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.receiptClose}
                className="grid size-8 cursor-pointer place-items-center justify-self-end rounded-full bg-[#ffffff] text-[#10224f] hover:bg-[#e7edff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffffff]"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-3">
              <div className="grid grid-cols-2 gap-3 border-t border-zinc-400/30 pt-3 text-[13px]">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">Client</span>
                  <strong className="text-[13px] font-semibold break-words text-[#ffffff]">{clientName}</strong>
                  {receipt?.passengerEmail && <span className="break-all text-[12px] text-zinc-200">{receipt.passengerEmail}</span>}
                  {receipt?.passengerPhone && <span className="text-[12px] text-zinc-200">{receipt.passengerPhone}</span>}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-zinc-400 uppercase">Itinerary</span>
                  {receipt?.pickup && <strong className="text-[13px] font-semibold break-words text-[#ffffff]">{receipt.pickup}</strong>}
                  {receipt?.stops.map((stop, index) => (
                    <span key={`${stop}-${index}`} className="break-words text-[12px] text-zinc-200">{stop}</span>
                  ))}
                  {receipt?.dropoff && <span className="break-words text-[13px] font-semibold text-[#ffffff]">{receipt.dropoff}</span>}
                  {!receipt?.pickup && !receipt?.dropoff && route && <strong className="text-[13px] font-semibold break-words text-[#ffffff]">{route}</strong>}
                  {receipt?.when && <span className="text-[12px] text-zinc-200">{receipt.when}</span>}
                  {receipt?.vehicle && <span className="text-[12px] text-zinc-200">{receipt.vehicle}</span>}
                  {receipt?.passengers && <span className="text-[12px] text-zinc-200">{receipt.passengers}</span>}
                  {receipt?.leadPassenger && <span className="text-[12px] text-zinc-200">{receipt.leadPassenger}</span>}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5 border-t border-zinc-400/30 pt-3 text-[13px] text-zinc-200">
                {lines.map((line) => (
                  <div key={line.label} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">{line.label}</span>
                    <span className="shrink-0 font-medium text-[#ffffff] tabular-nums">{line.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#06144a] px-3.5 py-3">
                <span className="font-serif text-[12px] tracking-wide text-zinc-200 uppercase">{t.priceTotal}</span>
                <span className="Ecram Execs · Amsterdam, Netherlands ">{total}</span>
              </div>

              <p className="m-0 mt-3 text-center text-[11px] text-zinc-400">Ecram Execs · Amsterdam, Netherlands</p>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-zinc-400/30 px-5 py-3">
              <button
                type="button"
                onClick={onDownload}
                className="flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ffffff] text-[13px] font-semibold text-[#10224f] hover:bg-[#e8eeff]"
              >
                <DownloadIcon />
                {t.receiptDownload}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-10 cursor-pointer items-center justify-center rounded-xl border border-solid border-[#ffffff]/40 bg-transparent px-4 text-[13px] font-semibold text-[#ffffff] hover:bg-[#ffffff]/10"
              >
                {t.receiptClose}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The thank-you after a website request */
export function BookingDone({ copy: t, locale, name, reference, map, price, onAgain }: {
  copy: BookingCopy;
  locale: Locale;
  name: string;
  reference: string;
  map?: RouteMapLinks | null;
  price?: { total: number; exact: boolean } | null;
  onAgain: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(false);
  const [receipt, setReceipt] = useState<RideReceipt | null>(null);
  useEffect(() => {
    if (shown.current) return;
    shown.current = true;
    setReceipt(readRideReceipt());
    heading.current?.focus({ preventScroll: true });
    heading.current?.closest("section")?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  return (
    <div role="status" className="mx-auto flex max-w-[640px] flex-col gap-6 py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
         
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <BookingStatusBadge label={t.doneEyebrow} />
              <span className="text-[12px] font-semibold tracking-[0.16em] text-ink-600 uppercase">{reference}</span>
            </div>
            <h2 ref={heading} tabIndex={-1} className="m-0 font-serif text-[clamp(32px,5vw,44px)] leading-[1.08] font-normal outline-none">
              {interpolate(t.doneHeading, { name })}
            </h2>
          </div>
        </div>
        <DownloadableReceiptCard copy={t} locale={locale} reference={reference} status={t.doneEyebrow} name={name} receipt={receipt} price={price} />
      </div>
      <p className="m-0 text-[15px] text-ink-600">{t.doneNote}</p>
      {map && <RouteMap map={map} copy={t} />}
      <div>
        <button type="button" onClick={onAgain} className="inline-flex h-11 cursor-pointer items-center rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white hover:bg-ink-800">
          {t.doneAgain}
        </button>
      </div>
    </div>
  );
}

export function RouteMap({ map, copy: t }: { map: RouteMapLinks; copy: Pick<BookingCopy, "doneMapTitle" | "doneMapFrame"> }) {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-4 text-ink-950">
      <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.doneMapTitle}</span>
      <div className="h-[280px] max-h-[280px] w-full overflow-hidden rounded-[12px]">
        <iframe title={t.doneMapFrame} src={mapFrameSrc(map)} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-full w-full border-0" />
      </div>
    </div>
  );
}

export const startsAtCar = (trip: Trip) => isTripReady(trip, netherlandsNow());