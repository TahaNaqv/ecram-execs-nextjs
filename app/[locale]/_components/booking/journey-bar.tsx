"use client";

import Form from "next/form";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useId, useState, useEffect, useRef, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { interpolate } from "@/lib/i18n/interpolate";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";
import { AddressField } from "./address-field";
import { netherlandsNow, type BookingCopy, type TripMessages } from "./copy";
import { GuestsPicker } from "./guests-picker";
import { useResetAfterBooking } from "./sent";
import { emptyPlace, emptyTrip, normalizeTrip, pickupAtAirport, samePlace, tripFromParams, tripProblems, tripToParams, type Trip, type TripField } from "./trip";

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const CrossIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
const ChevronDownIcon = ({ open }: { open?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const BOOKING_QUERY = ["from", "to", "at", "mode", "stop", "hours", "pax"];

/**
 * The homepage bar. A trip in the URL (Edit on the car step) fills the fields. With no trip in the URL the bar keeps
 * what the visitor typed, including when the browser comes back from /book.
 */
export function HeroJourneyBar(props: Omit<Parameters<typeof JourneyBar>[0], "initial" | "layout" | "onDone" | "onTripChange" | "cancelHref">) {
  const search = useSearchParams();
  const query = search.toString();
  const seeded = BOOKING_QUERY.some((key) => search.has(key)) ? tripFromParams(search) : undefined;
  return <JourneyBar key={seeded ? query : "hero"} initial={seeded} {...props} />;
}

export function JourneyBar({
  locale,
  copy: t,
  dateTimeCopy,
  messages,
  tone,
  layout = "bar",
  initial,
  action,
  onDone,
  onTripChange,
  cancelHref,
}: {
  locale: string;
  copy: BookingCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  tone: "dark" | "light";
  /** "bar": the hero's row of fields. "stacked": the journey step of /book and the portal, one field under the other */
  layout?: "bar" | "stacked";
  initial?: Trip;
  action?: string;
  onDone?: (trip: Trip) => void;
  /** Each change, so the journey step can show the route as it is typed */
  onTripChange?: (trip: Trip) => void;
  /** The journey step's Cancel: where it leads */
  cancelHref?: string;
}) {
  const uid = useId();
  const ids = { from: `${uid}-from`, to: `${uid}-to`, hours: `${uid}-hours`, at: `${uid}-at`, guests: `${uid}-guests`, guestsLabel: `${uid}-guests-label`, flight: `${uid}-flight`, error: `${uid}-error` };
  const [trip, setTrip] = useState<Trip>(initial ?? emptyTrip());
  const [problems, setProblems] = useState<TripField[]>([]);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [waitOpen, setWaitOpen] = useState<number | null>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const waitRef = useRef<HTMLDivElement>(null);
  
  // The date fields hold their own text, so they start again (with a new key) whenever the bar sets a date itself
  const [fieldsKey, setFieldsKey] = useState(0);
  const tripRef = useRef(trip);
  useEffect(() => {
    tripRef.current = trip;
  });
  const tripChange = useRef(onTripChange);
  useEffect(() => {
    tripChange.current = onTripChange;
  });
  useEffect(() => {
    tripChange.current?.(trip);
  }, [trip]);
  // The time the bar filled in by itself, while the visitor has not chosen another: if they leave the page open for hours and then
  // press Continue, that time is brought up to date instead of being refused as a time that has passed
  const autoAt = useRef("");

  // The page is prerendered, so the time it is now in the Netherlands is read when it is shown: the bar starts with it (QA round 3,
  // bug 11). Runs again when Next shows the page again after Back, and then only fills in a date that is missing.
  useEffect(() => {
    if (!hoursOpen) return;
    const close = (event: PointerEvent) => {
      if (!hoursRef.current?.contains(event.target as Node)) setHoursOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHoursOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [hoursOpen]);

  useEffect(() => {
    if (waitOpen === null) return;
    const close = (event: PointerEvent) => {
      if (!waitRef.current?.contains(event.target as Node)) setWaitOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWaitOpen(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [waitOpen]);

  useEffect(() => {
    if (tripRef.current.at) return;
    const now = netherlandsNow();
    autoAt.current = now;
    setTrip((current) => (current.at ? current : { ...current, at: now }));
    setFieldsKey((k) => k + 1);
  }, []);

  // The hero's bar starts again when the visitor comes back after sending a booking (QA round 3, bug 3)
  useResetAfterBooking(() => {
    if (!action) return;
    const now = netherlandsNow();
    autoAt.current = now;
    setTrip({ ...emptyTrip(), at: now });
    setProblems([]);
    setFieldsKey((k) => k + 1);
  });

  const update = (patch: Partial<Trip>) => {
    setTrip((current) => ({ ...current, ...patch }));
    setProblems([]);
  };
  const dark = tone === "dark";
  const airport = pickupAtAirport(trip);

  const message = (field: TripField) =>
    ({
      collection: messages.collectionRequired,
      destination: messages.destinationRequired,
      samePlace: messages.samePlace,
      pickupAt: !trip.at ? messages.pickupInvalid : trip.at < netherlandsNow() ? messages.pickupPast : messages.pickupTooFar,
      durationHours: messages.checkHighlighted,
      guests: messages.guestsRequired,
      flightNumber: messages.flightInvalid,
    })[field];

  const submit = (e: FormEvent<HTMLFormElement>) => {
    let current: Trip = trip;
    if (autoAt.current && trip.at === autoAt.current && tripProblems(current, netherlandsNow()).includes("pickupAt")) {
      const fresh = netherlandsNow();
      current = { ...current, at: fresh };
      autoAt.current = fresh;
      setTrip((t) => ({ ...t, at: fresh }));
      setFieldsKey((k) => k + 1);
      // The form sends the hidden copy of the time that was rendered a moment ago: bring that up to date as well
      const hidden = e.currentTarget.elements.namedItem("at");
      if (hidden instanceof HTMLInputElement) hidden.value = fresh;
    }
    const found = tripProblems(current, netherlandsNow());
    
    // Strict dropdown suggestion check for origin and destination
    if (!current.from.id && !found.includes("collection")) {
      found.push("collection");
    }
    if (current.mode === "oneway" && !current.to.id && !found.includes("destination")) {
      found.push("destination");
    }

    setProblems(found);
    if (found.length > 0) {
      e.preventDefault();
      document.getElementById({ collection: ids.from, destination: ids.to, samePlace: ids.to, pickupAt: ids.at, durationHours: ids.hours, guests: ids.guests, flightNumber: ids.flight }[found[0]])?.focus();
      return;
    }
    if (onDone) {
      e.preventDefault();
      onDone(current);
    }
  };

  const same = trip.mode === "oneway" && samePlace(trip.from.text, trip.to.text);
  const liveProblems: TripField[] = same ? ["samePlace", ...problems.filter((field) => field !== "samePlace")] : problems.filter((field) => field !== "samePlace");
  const invalid = (field: TripField) => liveProblems.includes(field) || (field === "destination" && liveProblems.includes("samePlace"));
  const stacked = layout === "stacked";
  const focusCell = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a, [role='dialog'], [role='listbox'], label")) return;
    event.currentTarget.querySelector<HTMLElement>("input:not([type='hidden']), textarea, select, button")?.focus();
  };
  // A field: in the bar a borderless cell that lights up; on the journey step a bordered box, like the details step's fields
  const cell = (field: TripField | null, children: ReactNode, extra = "") => (
    <div
      onClick={focusCell}
      className={
        stacked
          ? `relative flex min-w-0 cursor-pointer flex-col gap-1 rounded-xl border border-solid bg-white px-3.5 py-2.5 [--field-pad:14px] focus-within:border-ink-950 ${
              field && invalid(field) ? "border-error shadow-[0_0_0_1px_#b42318]" : "border-ink-225"
            } ${extra}`
          : `relative flex min-w-0 cursor-pointer flex-col justify-center gap-1.5 rounded-xl px-3.5 py-2.5 [--field-pad:14px] sm:px-4 sm:py-3 sm:[--field-pad:16px] ${
              dark ? "focus-within:bg-white/10 hover:bg-white/[0.07]" : "focus-within:bg-ink-50 hover:bg-ink-50"
            } ${field && invalid(field) ? "ring-[1.5px] ring-inset ring-[#f97066]" : ""} ${extra}`
      }
    >
      {children}
    </div>
  );
  const label = stacked
    ? "text-[12px] text-ink-600"
    : dark
      ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-250"
      : "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600";
  const describedBy = (field: TripField) => (invalid(field) ? ids.error : undefined);
  const params = action ? tripToParams(trip) : null;
  const quiet = dark ? "text-ink-150 hover:bg-white/10 hover:text-white" : "text-ink-800 hover:bg-ink-100 hover:text-ink-950";
  const removeButton = dark ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-950";
  const input = `w-full min-w-0 border-0 bg-transparent p-0 font-sans text-[16px] font-medium outline-none ${dark ? "text-white placeholder:font-normal placeholder:text-ink-400" : "text-ink-950 placeholder:font-normal placeholder:text-ink-475"}`;
  const canAddStop = trip.mode === "oneway" && trip.stops.length < MAX_STOPS;
  const stops = trip.mode === "oneway" ? trip.stops : [];
  const hasExtras = stops.length > 0 || airport;
  const divider = dark ? "border-white/10" : "border-ink-150";
  const dateClass = `border-0 bg-transparent p-0 font-medium ${dark ? "text-white placeholder:font-normal placeholder:text-ink-400" : "text-ink-950 placeholder:font-normal placeholder:text-ink-475"}`;

  const extraCell = (field: TripField | null, labelFor: string, labelText: string, control: ReactNode, onRemove?: () => void, removeLabel?: string, extra = "") =>
    cell(
      field,
      <>
        <span className="flex items-center justify-between gap-2">
          <label htmlFor={labelFor} className={label}>
            {labelText}
          </label>
          {onRemove && (
            <button
              type="button"
              aria-label={removeLabel}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              className={`relative z-[3] -my-1.5 -mr-2 grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent ${removeButton}`}
            >
              <CrossIcon />
            </button>
          )}
        </span>
        {control}
      </>,
      extra,
    );

  const modeToggle = (
    <div role="group" aria-label={t.modeLabel} className={`flex max-w-full rounded-full p-1 ${dark ? "bg-white/[0.1]" : "bg-ink-100"}`}>
      {(["oneway", "hourly"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          aria-pressed={trip.mode === mode}
          onClick={() => update({ mode, ...(mode === "hourly" ? { to: emptyPlace(), stops: [] } : {}) })}
          className={`h-[34px] min-w-0 cursor-pointer rounded-full border-0 px-3 text-[12px] sm:px-4 sm:text-[13px] ${
            trip.mode === mode
              ? dark
                ? "bg-white font-semibold text-ink-950"
                : "bg-ink-950 font-semibold text-white"
              : `bg-transparent font-medium ${dark ? "text-white" : "text-ink-950"}`
          }`}
        >
          {mode === "oneway" ? t.modeOneWay : t.modeHourly}
        </button>
      ))}
    </div>
  );

  const addButtons = (
    <div className={`flex flex-wrap items-center gap-1 ${stacked ? "-ml-3" : ""}`}>
      {canAddStop && (
        <button
          type="button"
          onClick={() => {
            update({ stops: [...trip.stops, { place: "", wait: 0 }] });
            const next = trip.stops.length;
            window.setTimeout(() => document.getElementById(`${uid}-stop-${next}`)?.focus(), 0);
          }}
          className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-[13px] font-semibold ${quiet}`}
        >
          <PlusIcon />
          {t.addStop}
        </button>
      )}
    </div>
  );

  const fromCell = cell(
    "collection",
    <>
      <label htmlFor={ids.from} className={label}>
        {stacked ? t.pickupLabel : t.from}
      </label>
      <AddressField
        id={ids.from}
        value={trip.from}
        onChange={(from) => update({ from })}
        onPicked={() => document.getElementById(trip.mode === "oneway" ? ids.to : ids.at)?.focus()}
        placeholder={t.addressPlaceholder}
        locale={locale}
        copy={t}
        tone={tone}
        invalid={invalid("collection")}
        describedBy={describedBy("collection")}
      />
    </>,
  );

  const toCell =
    trip.mode === "oneway"
      ? cell(
          "destination",
          <>
            {!stacked && (
              <button
                type="button"
                aria-label={t.swap}
                onClick={() => update({ from: trip.to, to: trip.from })}
                className={`absolute top-1/2 -left-10 z-20 hidden size-[34px] -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-solid lg:grid ${
                  dark ? "border-white/25 bg-[rgb(var(--ec-swap-rgb))] text-white shadow-md" : "border-ink-225 bg-white text-ink-950 shadow-md"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4" />
                </svg>
              </button>
            )}
            <label htmlFor={ids.to} className={label}>
              {stacked ? t.dropoffLabel : t.to}
            </label>
            <AddressField
              id={ids.to}
              value={trip.to}
              onChange={(to) => update({ to })}
              onPicked={() => document.getElementById(ids.at)?.focus()}
              placeholder={t.addressPlaceholder}
              locale={locale}
              copy={t}
              tone={tone}
              alignEnd={!stacked}
              invalid={invalid("destination")}
              describedBy={describedBy("destination")}
            />
          </>,
        )
      : cell(
          "durationHours",
          <>
            <label htmlFor={ids.hours} className={`${label} pointer-events-none`}>
              {t.duration}
            </label>
            <div ref={hoursRef}>
              <span className="flex items-center justify-between gap-2" aria-hidden="true">
                <span className={`truncate text-[16px] font-medium ${trip.hours === "" ? (dark ? "text-ink-400" : "text-ink-475") : dark ? "text-white" : "text-ink-950"}`}>
                  {trip.hours === "" ? t.durationPlaceholder : interpolate(t.hoursOption, { hours: trip.hours })}
                </span>
                <span className={dark ? "text-ink-250" : "text-ink-600"}>
                  <ChevronDownIcon open={hoursOpen} />
                </span>
              </span>
              <button
                type="button"
                id={ids.hours}
                aria-haspopup="listbox"
                aria-expanded={hoursOpen}
                aria-controls={hoursOpen ? `${ids.hours}-list` : undefined}
                aria-invalid={invalid("durationHours")}
                aria-describedby={describedBy("durationHours")}
                onClick={() => setHoursOpen((open) => !open)}
                className="absolute inset-0 z-[1] cursor-pointer border-0 bg-transparent p-0"
              />
              {hoursOpen && (
                <ul
                  id={`${ids.hours}-list`}
                  role="listbox"
                  aria-label={t.duration}
                  className="absolute top-full left-0 z-50 mt-2 box-border max-h-60 w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-solid border-[#c5d4ff] bg-[#ffffff] p-1 text-[#10224f] shadow-lg [color-scheme:light]"
                >
                  {HOURLY_DURATIONS.map((h) => {
                    const selected = trip.hours === h;
                    return (
                      <li key={h}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            update({ hours: h });
                            setHoursOpen(false);
                          }}
                          className={`m-0 w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-[15px] text-[#10224f] ${selected ? "bg-[#e8eeff] font-semibold" : "bg-[#ffffff] hover:bg-[#f4f7ff]"}`}
                        >
                          {interpolate(t.hoursOption, { hours: h })}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>,
          `${hoursOpen ? "z-30" : ""} has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-inset ${dark ? "has-[button:focus-visible]:ring-white/60" : "has-[button:focus-visible]:ring-ink-950"}`,
        );

  const whenCell = cell(
    "pickupAt",
    <>
      <label htmlFor={ids.at} className={label}>
        {stacked ? t.pickupWhen : t.when}
      </label>
      <DateTimeField
        key={`at-${fieldsKey}`}
        id={ids.at}
        locale={locale}
        copy={dateTimeCopy}
        defaultValue={trip.at}
        onValueChange={(at) => {
          if (at !== autoAt.current) autoAt.current = "";
          update({ at });
        }}
        invalid={invalid("pickupAt")}
        describedBy={describedBy("pickupAt")}
        tone={tone}
        size="md"
        fillCell
        className={dateClass}
      />
    </>,
  );

  const guestsCell = cell(
    "guests",
    <>
      <span id={ids.guestsLabel} className={label}>
        {t.guests}
      </span>
      <GuestsPicker
        id={ids.guests}
        labelledBy={ids.guestsLabel}
        pax={trip.pax}
        bags={trip.bags}
        small={trip.small}
        set={trip.guestsSet}
        onChange={(g) => {
          setTrip((current) => normalizeTrip({ ...current, ...g, guestsSet: true }));
          setProblems([]);
        }}
        copy={t}
        tone={tone}
        describedBy={describedBy("guests")}
      />
    </>,
  );

  // Stops are addresses like the others, so they get the same suggestions (and the same one-session-per-address billing)
  const stopCells = stops.map((stop, i) => (
    <Fragment key={i}>
      {extraCell(
        null,
        `${uid}-stop-${i}`,
        interpolate(t.stopLabel, { number: i + 1 }),
        <span className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <AddressField
            id={`${uid}-stop-${i}`}
            value={{ text: stop.place, id: null, kind: null }}
            onChange={(place) => update({ stops: trip.stops.map((s, j) => (j === i ? { ...s, place: place.text } : s)) })}
            placeholder={t.addressPlaceholder}
            locale={locale}
            copy={t}
            tone={tone}
          />
          <div ref={waitOpen === i ? waitRef : undefined} className="relative w-full sm:w-auto sm:shrink-0">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={waitOpen === i}
              aria-controls={waitOpen === i ? `${uid}-wait-${i}` : undefined}
              aria-label={interpolate(t.stopWaitLabel, { number: i + 1 })}
              onClick={() => setWaitOpen((open) => (open === i ? null : i))}
              className={`w-full cursor-pointer border-0 bg-transparent p-0 text-left text-[13px] outline-none sm:w-auto ${dark ? "text-ink-200" : "text-ink-700"}`}
            >
              {stop.wait === 0 ? t.waitNone : interpolate(t.waitMinutes, { minutes: stop.wait })}
            </button>
            {waitOpen === i && (
              <ul
                id={`${uid}-wait-${i}`}
                role="listbox"
                aria-label={interpolate(t.stopWaitLabel, { number: i + 1 })}
                className="absolute top-full left-0 z-50 mt-1 box-border max-h-60 w-full min-w-0 max-w-[calc(100vw-2rem)] list-none overflow-y-auto rounded-xl border border-solid border-[#c5d4ff] bg-[#ffffff] p-1 text-[#10224f] shadow-lg [color-scheme:light] sm:left-auto sm:right-0 sm:w-auto sm:min-w-[148px]"
              >
                {STOP_WAITS.map((w) => {
                  const selected = stop.wait === w;
                  return (
                    <li key={w}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          update({ stops: trip.stops.map((s, j) => (j === i ? { ...s, wait: w } : s)) });
                          setWaitOpen(null);
                        }}
                        className={`m-0 w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-[13px] text-[#10224f] ${selected ? "bg-[#e8eeff] font-semibold" : "bg-[#ffffff] hover:bg-[#f4f7ff]"}`}
                      >
                        {w === 0 ? t.waitNone : interpolate(t.waitMinutes, { minutes: w })}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </span>,
        () => update({ stops: trip.stops.filter((_, j) => j !== i) }),
        interpolate(t.removeStop, { number: i + 1 }),
        waitOpen === i ? "z-30" : "",
      )}
    </Fragment>
  ));

  const flightCell =
    airport &&
    extraCell(
      "flightNumber",
      ids.flight,
      t.flight,
      <input
        id={ids.flight}
        type="text"
        autoComplete="off"
        maxLength={12}
        placeholder={t.flightPlaceholder}
        value={trip.flight}
        onChange={(e) => update({ flight: e.target.value.toUpperCase() })}
        className={input}
      />,
    );

  const errorLine = (
    <p id={ids.error} role="alert" className={`m-0 min-h-5 text-[13px] ${dark ? "text-[#fda29b]" : "text-error"}`}>
      {liveProblems.length > 0 ? [...new Set(liveProblems.map(message))].filter(Boolean).join(" ") : ""}
    </p>
  );

  // The journey step of /book and the portal: one field under the other, then the action
  if (stacked) {
    return (
      <form onSubmit={submit} noValidate className="flex w-full min-w-0 max-w-full flex-col gap-3">
        <div className="flex flex-col gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-4 text-ink-950 md:p-6">
          <div className="mb-1">{modeToggle}</div>
          {fromCell}
          {toCell}
          {whenCell}
          {guestsCell}
          {stopCells}
          {addButtons}
          {flightCell}
        </div>
        {errorLine}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {cancelHref ? (
            <Link href={cancelHref} className="flex h-[52px] items-center rounded-xl border border-solid border-ink-225 bg-white px-5 text-[14px] font-semibold text-ink-950 no-underline hover:border-ink-950">
              {t.cancel}
            </Link>
          ) : (
            <span />
          )}
          <button type="submit" className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 bg-ink-950 px-5 text-[14px] font-semibold text-white hover:bg-ink-800 sm:h-[52px] sm:w-auto sm:px-7">
            {t.chooseCar}
            <ArrowIcon />
          </button>
        </div>
      </form>
    );
  }

  // Extras sit in 3 columns from xl. When the last row still has a free cell, Continue sits in it.
  const totalExtraItems = stops.length + (flightCell ? 1 : 0);
  const remainderInRow = totalExtraItems % 3;
  const buttonFitsInline = totalExtraItems > 0 && remainderInRow !== 0;

  const continueButton = (
    <button
      type="submit"
      className={`flex h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 px-7 text-[14px] font-semibold ${
        buttonFitsInline ? "w-full" : "w-full sm:w-[360px] mx-auto"
      } ${dark ? "bg-white text-ink-950 hover:bg-ink-100" : "bg-ink-950 text-white hover:bg-ink-800"}`}
    >
      {t.continue}
      <ArrowIcon />
    </button>
  );

  const body = (
    <>
      {params && [...params.entries()].map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
      <div
        className={`relative rounded-[18px] border border-solid p-1 sm:rounded-[22px] sm:p-1.5 ${
          dark ? "border-white/25 bg-[rgba(var(--ec-panel-rgb),0.62)] text-white backdrop-blur-xl" : "border-ink-225 bg-white text-ink-950 shadow-sm"
        }`}
      >
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-0 border-b border-solid px-1.5 pt-1 pb-2.5 ${divider}`}>
          {modeToggle}
          {addButtons}
        </div>

        <div className="relative mt-1.5 grid min-w-0 grid-cols-1 gap-x-4 gap-y-0.5 sm:gap-x-5 md:grid-cols-2 md:gap-x-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,1.15fr)]">
          {fromCell}
          {toCell}
          {whenCell}
          {guestsCell}
        </div>

        {hasExtras && (
          <div className={`mx-1.5 mt-1 grid min-w-0 grid-cols-1 gap-2 border-0 border-t border-solid pt-3 md:grid-cols-2 xl:grid-cols-3 ${divider}`}>
            {stopCells}
            {flightCell}
            {buttonFitsInline && <div className="col-span-1 flex items-center">{continueButton}</div>}
          </div>
        )}

        {(!hasExtras || !buttonFitsInline) && (
          <div className={`mx-1.5 mt-1 flex items-center justify-center border-0 border-t border-solid pt-3 ${divider}`}>
            {continueButton}
          </div>
        )}

        {liveProblems.length > 0 && <div className="px-3 pt-2">{errorLine}</div>}
      </div>
    </>
  );

  const formClass = "flex w-full min-w-0 max-w-full flex-col gap-3";
  return action ? (
    <Form action={action} onSubmit={submit} noValidate className={formClass}>
      {body}
    </Form>
  ) : (
    <form onSubmit={submit} noValidate className={formClass}>
      {body}
    </form>
  );
}