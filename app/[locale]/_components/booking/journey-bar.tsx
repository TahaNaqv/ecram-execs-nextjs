"use client";

import Form from "next/form";
import { Fragment, useId, useState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { interpolate } from "@/lib/i18n/interpolate";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";
import { AddressField } from "./address-field";
import { netherlandsNow, type BookingCopy, type TripMessages } from "./copy";
import { GuestsPicker } from "./guests-picker";
import { emptyPlace, emptyTrip, pickupAtAirport, tripProblems, tripToParams, type Trip, type TripField } from "./trip";

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
const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function JourneyBar({
  locale,
  copy: t,
  dateTimeCopy,
  messages,
  tone,
  initial,
  action,
  onDone,
}: {
  locale: string;
  copy: BookingCopy;
  dateTimeCopy: DateTimeCopy;
  messages: TripMessages;
  tone: "dark" | "light";
  initial?: Trip;
  action?: string;
  onDone?: (trip: Trip) => void;
}) {
  const uid = useId();
  const ids = { from: `${uid}-from`, to: `${uid}-to`, hours: `${uid}-hours`, at: `${uid}-at`, ret: `${uid}-ret`, guests: `${uid}-guests`, guestsLabel: `${uid}-guests-label`, flight: `${uid}-flight`, error: `${uid}-error` };
  const [trip, setTrip] = useState<Trip>(initial ?? emptyTrip());
  const [problems, setProblems] = useState<TripField[]>([]);
  const [returning, setReturning] = useState(Boolean(initial?.ret));
  
  // Custom duration dropdown state
  const [hoursOpen, setHoursOpen] = useState(false);
  const hoursRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hoursOpen) return;
    const outside = (e: MouseEvent) => !hoursRef.current?.contains(e.target as Node) && setHoursOpen(false);
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [hoursOpen]);

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
      pickupAt: !trip.at ? messages.pickupInvalid : trip.at < netherlandsNow() ? messages.pickupPast : messages.pickupTooFar,
      returnAt: messages.returnBeforePickup,
      durationHours: messages.checkHighlighted,
      flightNumber: messages.flightInvalid,
    })[field];

  const submit = (e: FormEvent<HTMLFormElement>) => {
    const found = tripProblems({ ...trip, ret: returning ? trip.ret : "" }, netherlandsNow());
    setProblems(found);
    if (found.length > 0) {
      e.preventDefault();
      document.getElementById({ collection: ids.from, destination: ids.to, pickupAt: ids.at, returnAt: ids.ret, durationHours: ids.hours, flightNumber: ids.flight }[found[0]])?.focus();
      return;
    }
    if (onDone) {
      e.preventDefault();
      onDone({ ...trip, ret: returning ? trip.ret : "" });
    }
  };

  const invalid = (field: TripField) => problems.includes(field);
  const cell = (field: TripField | null, children: ReactNode, extra = "") => (
    <div
      className={`relative flex min-w-0 flex-col justify-center gap-1.5 rounded-xl px-[18px] py-3 ${
        dark ? "focus-within:bg-white/10 hover:bg-white/[0.07]" : "focus-within:bg-ink-50 hover:bg-ink-50"
      } ${field && invalid(field) ? "ring-[1.5px] ring-inset ring-[#f97066]" : ""} ${extra}`}
    >
      {children}
    </div>
  );
  const label = dark ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-250" : "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-600";
  const describedBy = (field: TripField) => (invalid(field) ? ids.error : undefined);
  const params = action ? tripToParams({ ...trip, ret: returning ? trip.ret : "" }) : null;
  const quiet = dark ? "text-ink-150 hover:bg-white/10 hover:text-white" : "text-ink-800 hover:bg-ink-100 hover:text-ink-950";
  const removeButton = dark ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-950";
  const input = `w-full min-w-0 border-0 bg-transparent p-0 font-sans text-[16px] font-medium outline-none ${dark ? "text-white placeholder:font-normal placeholder:text-ink-400" : "text-ink-950 placeholder:font-normal placeholder:text-ink-475"}`;
  const canAddStop = trip.mode === "oneway" && trip.stops.length < MAX_STOPS;
  const stops = trip.mode === "oneway" ? trip.stops : [];
  const hasExtras = stops.length > 0 || returning || airport;
  const divider = dark ? "border-white/10" : "border-ink-150";

  const extraCell = (field: TripField | null, labelFor: string, labelText: string, control: ReactNode, onRemove?: () => void, removeLabel?: string) =>
    cell(
      field,
      <>
        <span className="flex items-center justify-between gap-2">
          <label htmlFor={labelFor} className={label}>
            {labelText}
          </label>
          {onRemove && (
            <button type="button" aria-label={removeLabel} onClick={onRemove} className={`-my-1.5 -mr-2 grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent ${removeButton}`}>
              <CrossIcon />
            </button>
          )}
        </span>
        {control}
      </>,
    );

  const body = (
    <>
      {params && [...params.entries()].map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
      <div
        className={`relative rounded-[22px] border border-solid p-1.5 ${
          dark ? "border-white/20 bg-[rgba(18,18,20,0.62)] text-white backdrop-blur-xl" : "border-ink-225 bg-white text-ink-950 shadow-sm"
        }`}
      >
        <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-0 border-b border-solid px-1.5 pt-1 pb-2.5 ${divider}`}>
          <div role="group" aria-label={t.modeLabel} className={`flex rounded-full p-1 ${dark ? "bg-white/[0.1]" : "bg-ink-100"}`}>
            {(["oneway", "hourly"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={trip.mode === mode}
                onClick={() => update({ mode, ...(mode === "hourly" ? { to: emptyPlace(), stops: [] } : {}) })}
                className={`h-[34px] cursor-pointer rounded-full border-0 px-4 text-[13px] ${
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
          <div className="flex flex-wrap items-center gap-1">
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
            {!returning && (
              <button
                type="button"
                onClick={() => {
                  setReturning(true);
                  window.setTimeout(() => document.getElementById(ids.ret)?.focus(), 0);
                }}
                className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-[13px] font-semibold ${quiet}`}
              >
                <PlusIcon />
                {t.addReturn}
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-1.5 grid grid-cols-1 gap-x-6 md:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(205px,1.1fr)_minmax(165px,0.85fr)_auto]">
        {cell(
          "collection",
          <>
            <label htmlFor={ids.from} className={label}>
              {t.from}
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
        )}
        {trip.mode === "oneway"
          ? cell(
              "destination",
              <>
                <button
                  type="button"
                  aria-label={t.swap}
                  onClick={() => update({ from: trip.to, to: trip.from })}
                  className={`absolute top-1/2 -left-10 z-20 hidden size-[34px] -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-solid lg:grid ${
                    dark ? "border-white/20 bg-ink-850 text-white shadow-md" : "border-ink-225 bg-white text-ink-950 shadow-md"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <path d="M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4" />
                  </svg>
                </button>
                <label htmlFor={ids.to} className={label}>
                  {t.to}
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
                  alignEnd
                  invalid={invalid("destination")}
                  describedBy={describedBy("destination")}
                />
              </>,
            )
          : cell(
              "durationHours",
              <div ref={hoursRef} className="relative w-full min-w-0">
                <span id={`${ids.hours}-label`} className={label}>
                  {t.duration}
                </span>
                <button
                  id={ids.hours}
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={hoursOpen}
                  onClick={() => setHoursOpen((o) => !o)}
                  className={`w-full cursor-pointer border-0 bg-transparent p-0 text-left text-[16px] font-medium outline-none truncate ${
                    dark ? (trip.hours === "" ? "text-ink-400" : "text-white") : (trip.hours === "" ? "text-ink-475" : "text-ink-950")
                  }`}
                >
                  {trip.hours === "" ? "Select hours" : trip.hours === 1 ? "1 hour" : `${trip.hours} hours`}
                </button>
                {hoursOpen && (
                  <ul
                    role="listbox"
                    aria-labelledby={`${ids.hours}-label`}
                    className="absolute top-full left-0 z-50 mt-3 max-h-60 w-full min-w-[220px] overflow-y-auto rounded-2xl border border-solid border-white/15 bg-ink-900 p-2 text-white shadow-2xl"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <li
                        key={h}
                        role="option"
                        aria-selected={trip.hours === h}
                        onClick={() => {
                          update({ hours: h });
                          setHoursOpen(false);
                        }}
                        className={`flex cursor-pointer items-center rounded-xl px-4 py-2.5 text-[15px] font-medium transition-colors ${
                          trip.hours === h ? "bg-white/15 font-semibold text-white" : "text-ink-200 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {h === 1 ? "1 hour" : `${h} hours`}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
        {cell(
          "pickupAt",
          <>
            <label htmlFor={ids.at} className={label}>
              {t.when}
            </label>
            <DateTimeField
              id={ids.at}
              locale={locale}
              copy={dateTimeCopy}
              defaultValue={trip.at}
              onValueChange={(at) => update({ at })}
              invalid={invalid("pickupAt")}
              describedBy={describedBy("pickupAt")}
              tone={tone}
              size="md"
              className={`border-0 bg-transparent p-0 font-medium ${dark ? "text-white placeholder:font-normal placeholder:text-ink-400" : "text-ink-950 placeholder:font-normal placeholder:text-ink-475"}`}
            />
          </>,
        )}
        {cell(
          null,
          <>
            <span id={ids.guestsLabel} className={label}>
              {t.guests}
            </span>
            <GuestsPicker id={ids.guests} labelledBy={ids.guestsLabel} pax={trip.pax} bags={trip.bags} onChange={(g) => update(g)} copy={t} tone={tone} />
          </>,
        )}
        <button
          type="submit"
          className={`m-1 flex min-h-[52px] cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 px-7 text-[14px] font-semibold md:col-span-2 lg:col-span-1 ${
            dark ? "bg-white text-ink-950 hover:bg-ink-100" : "bg-ink-950 text-white hover:bg-ink-800"
          }`}
        >
          {t.continue}
          <ArrowIcon />
        </button>
        </div>

        {hasExtras && (
          <div className={`mt-1.5 grid grid-cols-1 border-0 border-t border-solid pt-1.5 md:grid-cols-2 lg:grid-cols-3 ${divider}`}>
            {stops.map((stop, i) => (
              <Fragment key={i}>
                {extraCell(
                null,
                `${uid}-stop-${i}`,
                interpolate(t.stopLabel, { number: i + 1 }),
                <span className="flex items-center gap-3">
                  <input
                    id={`${uid}-stop-${i}`}
                    type="text"
                    autoComplete="off"
                    maxLength={200}
                    placeholder={t.addressPlaceholder}
                    value={stop.place}
                    onChange={(e) => update({ stops: trip.stops.map((s, j) => (j === i ? { ...s, place: e.target.value } : s)) })}
                    className={input}
                  />
                  <select
                    aria-label={interpolate(t.stopWaitLabel, { number: i + 1 })}
                    value={stop.wait}
                    onChange={(e) => update({ stops: trip.stops.map((s, j) => (j === i ? { ...s, wait: Number(e.target.value) } : s)) })}
                    className={`shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[13px] outline-none ${dark ? "text-ink-200 [&>option]:text-ink-950" : "text-ink-700"}`}
                  >
                    {STOP_WAITS.map((w) => (
                      <option key={w} value={w}>
                        {w === 0 ? t.waitNone : interpolate(t.waitMinutes, { minutes: w })}
                      </option>
                    ))}
                  </select>
                </span>,
                  () => update({ stops: trip.stops.filter((_, j) => j !== i) }),
                  interpolate(t.removeStop, { number: i + 1 }),
                )}
              </Fragment>
            ))}
            {returning &&
              extraCell(
                "returnAt",
                ids.ret,
                t.returnLabel,
                <DateTimeField
                  id={ids.ret}
                  locale={locale}
                  copy={dateTimeCopy}
                  defaultValue={trip.ret}
                  onValueChange={(ret) => update({ ret })}
                  invalid={invalid("returnAt")}
                  describedBy={describedBy("returnAt")}
                  tone={tone}
                  size="md"
                  className={`border-0 bg-transparent p-0 font-medium ${dark ? "text-white placeholder:font-normal placeholder:text-ink-400" : "text-ink-950 placeholder:font-normal placeholder:text-ink-475"}`}
                />,
                () => {
                  setReturning(false);
                  update({ ret: "" });
                },
                t.removeReturn,
              )}
            {airport &&
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
              )}
          </div>
        )}
      </div>

      <p id={ids.error} role="alert" className={`m-0 min-h-5 text-[13px] ${dark ? "text-[#fda29b]" : "text-error"}`}>
        {problems.length > 0 ? [...new Set(problems.map(message))].filter(Boolean).join(" ") : ""}
      </p>
    </>
  );

  const formClass = "flex w-full flex-col gap-3";
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