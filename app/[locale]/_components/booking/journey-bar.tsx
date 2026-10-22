"use client";

import Form from "next/form";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { interpolate } from "@/lib/i18n/interpolate";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
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

/**
 * Step one of the booking flow: where from, where to (or for how long), when and who. In the homepage hero it is a
 * search bar that sends the trip to /book in the URL (`action`); on /book and in the portal it hands the trip back to
 * the flow (`onDone`). Nothing reaches the server here: the trip is only checked, and the last step posts it.
 */
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
  /** /book, localised: the hero navigates there with the trip in the query */
  action?: string;
  onDone?: (trip: Trip) => void;
}) {
  const uid = useId();
  const ids = { from: `${uid}-from`, to: `${uid}-to`, hours: `${uid}-hours`, at: `${uid}-at`, ret: `${uid}-ret`, guests: `${uid}-guests`, guestsLabel: `${uid}-guests-label`, flight: `${uid}-flight`, error: `${uid}-error` };
  const [trip, setTrip] = useState<Trip>(initial ?? emptyTrip());
  const [problems, setProblems] = useState<TripField[]>([]);
  const [returning, setReturning] = useState(Boolean(initial?.ret));
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
      durationHours: "",
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
  const chip = dark
    ? "border-white/20 bg-white/[0.08] text-white hover:bg-white/15"
    : "border-ink-225 bg-white text-ink-950 hover:border-ink-950";
  const fieldBox = dark ? "border-white/20 bg-ink-950/60 text-white" : "border-ink-225 bg-white text-ink-950";

  const body = (
    <>
      {params && [...params.entries()].map(([k, v], i) => <input key={`${k}-${i}`} type="hidden" name={k} value={v} />)}
      <div
        className={`relative grid grid-cols-1 rounded-[20px] border border-solid p-1.5 md:grid-cols-2 lg:grid-cols-[1.3fr_1.3fr_1.1fr_0.85fr_auto] ${
          dark ? "border-white/20 bg-[rgba(18,18,20,0.62)] text-white backdrop-blur-xl" : "border-ink-225 bg-white text-ink-950 shadow-sm"
        }`}
      >
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
                  className={`absolute top-1/2 left-[-17px] z-10 hidden size-[34px] -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-solid lg:grid ${
                    dark ? "border-white/20 bg-ink-850 text-white" : "border-ink-225 bg-white text-ink-950"
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
              <>
                <label htmlFor={ids.hours} className={label}>
                  {t.duration}
                </label>
                <select
                  id={ids.hours}
                  value={trip.hours}
                  onChange={(e) => update({ hours: Number(e.target.value) })}
                  className={`w-full cursor-pointer border-0 bg-transparent p-0 text-[16px] font-medium outline-none ${dark ? "text-white [&>option]:text-ink-950" : "text-ink-950"}`}
                >
                  {HOURLY_DURATIONS.map((h) => (
                    <option key={h} value={h}>
                      {interpolate(t.hoursOption, { hours: h })}
                    </option>
                  ))}
                </select>
              </>,
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

      <div className="flex flex-wrap items-start gap-2.5">
        {airport && (
          <label htmlFor={ids.flight} className={`flex h-11 items-center gap-2.5 rounded-full border border-solid pr-2 pl-4 text-[12px] font-semibold tracking-[0.06em] uppercase ${fieldBox}`}>
            {t.flight}
            <input
              id={ids.flight}
              type="text"
              autoComplete="off"
              maxLength={12}
              placeholder={t.flightPlaceholder}
              value={trip.flight}
              onChange={(e) => update({ flight: e.target.value.toUpperCase() })}
              className={`w-[130px] min-w-0 border-0 bg-transparent p-0 text-[16px] font-medium tracking-normal normal-case outline-none ${dark ? "text-white placeholder:text-ink-400" : "text-ink-950 placeholder:text-ink-475"}`}
            />
          </label>
        )}

        {trip.mode === "oneway" &&
          trip.stops.map((stop, i) => (
            <span key={i} className={`flex h-11 max-w-full items-center gap-2 rounded-full border border-solid pr-1 pl-4 ${fieldBox}`}>
              <label htmlFor={`${uid}-stop-${i}`} className="text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase opacity-80">
                {interpolate(t.stopLabel, { number: i + 1 })}
              </label>
              <input
                id={`${uid}-stop-${i}`}
                type="text"
                autoComplete="off"
                maxLength={200}
                placeholder={t.addressPlaceholder}
                value={stop.place}
                onChange={(e) => update({ stops: trip.stops.map((s, j) => (j === i ? { ...s, place: e.target.value } : s)) })}
                className={`w-[170px] min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-medium outline-none ${dark ? "text-white placeholder:text-ink-400" : "text-ink-950 placeholder:text-ink-475"}`}
              />
              <select
                aria-label={interpolate(t.stopWaitLabel, { number: i + 1 })}
                value={stop.wait}
                onChange={(e) => update({ stops: trip.stops.map((s, j) => (j === i ? { ...s, wait: Number(e.target.value) } : s)) })}
                className={`cursor-pointer border-0 bg-transparent p-0 text-[13px] outline-none ${dark ? "text-ink-200 [&>option]:text-ink-950" : "text-ink-700"}`}
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
                onClick={() => update({ stops: trip.stops.filter((_, j) => j !== i) })}
                className={`grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent ${dark ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-ink-600 hover:bg-ink-100"}`}
              >
                <CrossIcon />
              </button>
            </span>
          ))}
        {trip.mode === "oneway" && trip.stops.length < MAX_STOPS && (
          <button
            type="button"
            onClick={() => {
              update({ stops: [...trip.stops, { place: "", wait: 0 }] });
              const next = trip.stops.length;
              window.setTimeout(() => document.getElementById(`${uid}-stop-${next}`)?.focus(), 0);
            }}
            className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border border-solid px-4 text-[13px] font-semibold ${chip}`}
          >
            <PlusIcon />
            {t.addStop}
          </button>
        )}

        {returning ? (
          <span className={`flex h-11 max-w-full items-center gap-2 rounded-full border border-solid pr-1 pl-4 ${fieldBox} ${invalid("returnAt") ? "ring-[1.5px] ring-[#f97066]" : ""}`}>
            <label htmlFor={ids.ret} className="text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap uppercase opacity-80">
              {t.returnLabel}
            </label>
            <span className="w-[190px] min-w-0 flex-1">
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
                className={`border-0 bg-transparent p-0 font-medium ${dark ? "text-white placeholder:text-ink-400" : "text-ink-950 placeholder:text-ink-475"}`}
              />
            </span>
            <button
              type="button"
              aria-label={t.removeReturn}
              onClick={() => {
                setReturning(false);
                update({ ret: "" });
              }}
              className={`grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-transparent ${dark ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-ink-600 hover:bg-ink-100"}`}
            >
              <CrossIcon />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReturning(true);
              window.setTimeout(() => document.getElementById(ids.ret)?.focus(), 0);
            }}
            className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border border-solid px-4 text-[13px] font-semibold ${chip}`}
          >
            <PlusIcon />
            {t.addReturn}
          </button>
        )}
      </div>

      <p id={ids.error} role="alert" className={`m-0 min-h-5 text-[13px] ${dark ? "text-[#fda29b]" : "text-error"}`}>
        {problems.length > 0 ? [...new Set(problems.map(message))].filter(Boolean).join(" ") : ""}
      </p>
    </>
  );

  const formClass = "flex w-full flex-col gap-3";
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div
        role="group"
        aria-label={t.modeLabel}
        className={`flex rounded-full border border-solid p-1 ${dark ? "border-white/20 bg-white/[0.14]" : "border-ink-225 bg-ink-100"}`}
      >
        {(["oneway", "hourly"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={trip.mode === mode}
            onClick={() => update({ mode, ...(mode === "hourly" ? { to: emptyPlace(), stops: [] } : {}) })}
            className={`h-[38px] cursor-pointer rounded-full border-0 px-5 text-[14px] ${
              trip.mode === mode
                ? dark
                  ? "bg-white font-semibold text-ink-950"
                  : "bg-ink-950 font-semibold text-white"
                : dark
                  ? "bg-transparent font-medium text-white"
                  : "bg-transparent font-medium text-ink-950"
            }`}
          >
            {mode === "oneway" ? t.modeOneWay : t.modeHourly}
          </button>
        ))}
      </div>
      {action ? (
        <Form action={action} onSubmit={submit} noValidate className={formClass}>
          {body}
        </Form>
      ) : (
        <form onSubmit={submit} noValidate className={formClass}>
          {body}
        </form>
      )}
    </div>
  );
}
