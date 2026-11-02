"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import type { FleetVehicle } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import type { BookingResult, BookingStep, DetailsEntry } from "./booking-flow";
import { Check, pretty, SeatIcon } from "./parts";
import type { BookingCopy } from "./copy";
import { bagsText, guestsText } from "./guests-picker";
import { involvesAirport, pickupAtAirport, type Trip } from "./trip";

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

/** The places a trip passes, in order, as the visitor typed them; an hourly trip is its pick-up and the hours. */
function waypoints(trip: Trip, t: BookingCopy): { label: string; place: string }[] {
  if (trip.mode === "hourly") return trip.from.text ? [{ label: t.reviewPickup, place: trip.from.text }] : [];
  return [
    { label: t.reviewPickup, place: trip.from.text },
    ...trip.stops.filter((s) => s.place.trim()).map((s) => ({ label: t.reviewStop, place: s.wait ? `${s.place} (${interpolate(t.waitMinutes, { minutes: s.wait })})` : s.place })),
    { label: t.reviewDropoff, place: trip.to.text },
  ].filter((w) => w.place.trim());
}

/**
 * Beside the journey form: the route as text, pick-up to drop-off with the stops between, drawn with a line and dots. No map
 * is loaded while the visitor is still planning (the client's rule: Google's map is only shown once the booking is in).
 */
export function RouteOutline({ trip, copy: t, locale }: { trip: Trip; copy: BookingCopy; locale: Locale }) {
  const points = waypoints(trip, t);
  return (
    <aside aria-label={t.routeTitle} className="flex flex-col gap-5 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6 lg:sticky lg:top-24">
      <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.routeTitle}</span>
      {points.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-600">{t.routeEmpty}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {points.map((w, i) => (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < points.length - 1 && <span aria-hidden="true" className="absolute top-4 bottom-0 left-[7px] w-px bg-ink-300" />}
              <span aria-hidden="true" className={`relative mt-1 size-[15px] shrink-0 rounded-full border-2 border-solid border-ink-950 ${i === 0 || i === points.length - 1 ? "bg-ink-950" : "bg-white"}`} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[12px] text-ink-600">{w.label}</span>
                <span className="text-[15px] font-medium wrap-break-word">{w.place}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {trip.mode === "hourly" && trip.hours !== "" && <p className="m-0 text-[14px] text-ink-700">{interpolate(t.routeHourly, { hours: trip.hours })}</p>}
      {(trip.at || trip.guestsSet) && (
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-0 border-t border-solid border-ink-150 pt-4 text-[14px]">
          {trip.at && (
            <>
              <dt className="text-ink-500">{t.summaryWhen}</dt>
              <dd className="m-0">{pretty(trip.at, locale)}</dd>
            </>
          )}
          {trip.ret && (
            <>
              <dt className="text-ink-500">{t.summaryReturn}</dt>
              <dd className="m-0">{pretty(trip.ret, locale)}</dd>
            </>
          )}
          {trip.guestsSet && (
            <>
              <dt className="text-ink-500">{t.summaryParty}</dt>
              <dd className="m-0">{`${guestsText(t, trip.pax)} · ${bagsText(t, trip.bags)}`}</dd>
            </>
          )}
        </dl>
      )}
    </aside>
  );
}

/** "121.5 km · 1 h 25 m" from Google's answer, in the visitor's language. */
function distanceText(est: { meters: number; seconds: number }, t: BookingCopy, locale: Locale) {
  const km = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 }).format(est.meters / 1000);
  const total = Math.max(1, Math.round(est.seconds / 60));
  const time = total >= 60 ? interpolate(t.reviewHoursMinutes, { hours: Math.floor(total / 60), minutes: total % 60 }) : interpolate(t.reviewMinutes, { minutes: total });
  return interpolate(t.reviewDistanceValue, { km, time });
}

/**
 * The last step: everything the visitor is about to send, in three cards they can each go back to change, then one
 * agreement and the send. Distance and driving time are asked of Google here, once, and not before (see /api/route-estimate).
 */
export function ReviewStep({
  headingRef,
  variant,
  trip,
  entered,
  copy: t,
  locale,
  chosen,
  vehicleAdvise,
  result,
  booker,
  privacyHref,
  lockedNotice,
  onEdit,
  onSend,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  variant: "public" | "portal";
  trip: Trip;
  entered: DetailsEntry;
  copy: BookingCopy;
  locale: Locale;
  chosen: FleetVehicle | undefined;
  vehicleAdvise: string;
  result: BookingResult;
  booker?: { name: string; email: string; companyName?: string | null };
  privacyHref?: string;
  lockedNotice?: ReactNode;
  onEdit: (step: BookingStep) => void;
  onSend: () => void;
}) {
  const uid = useId();
  const portal = variant === "portal";
  const value = (k: string) => (entered.fields.find(([name]) => name === k)?.[1] ?? "").trim();
  const [agreed, setAgreed] = useState(false);
  const [mustAgree, setMustAgree] = useState(false);

  const routed = trip.mode === "oneway" && trip.from.text.trim() && trip.to.text.trim();
  const stopsKey = trip.stops.map((s) => s.place.trim()).filter(Boolean).join("|");
  const [estimate, setEstimate] = useState<{ meters: number; seconds: number } | null | "pending">(routed ? "pending" : null);
  useEffect(() => {
    if (!routed) return;
    const query = new URLSearchParams({ from: trip.from.text, to: trip.to.text });
    for (const s of stopsKey.split("|").filter(Boolean)) query.append("stop", s);
    const controller = new AbortController();
    fetch(`/api/route-estimate?${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { meters?: number; seconds?: number } | null) =>
        setEstimate(typeof data?.meters === "number" && typeof data?.seconds === "number" ? { meters: data.meters, seconds: data.seconds } : null),
      )
      .catch((err: Error) => err.name !== "AbortError" && setEstimate(null));
    return () => controller.abort();
  }, [routed, trip.from.text, trip.to.text, stopsKey]);

  const phone = (country: string, number: string) => (number ? `+${country} ${number}` : "");
  const kind =
    trip.mode === "hourly" ? t.modeHourly : involvesAirport(trip) ? t.reviewAirport : entered.purpose === "private" ? t.purposePrivate : t.purposeBusiness;
  const company = entered.purpose === "business" ? [value("entity"), value("entityKvk") && `KVK ${value("entityKvk")}`].filter(Boolean).join(" · ") : "";
  const passenger = entered.who === "other" ? [value("passengerName"), phone(value("passengerPhoneCountry") || value("phoneCountry"), value("passengerPhone"))].filter(Boolean).join(" · ") : t.reviewSameAsBooker;

  const contact: [string, ReactNode][] = [
    [t.reviewName, portal && booker ? booker.name : value("name")],
    [t.email, portal && booker ? booker.email : value("email")],
    [t.mobile, phone(value("phoneCountry"), value("phone"))],
    [t.reviewTrip, kind],
  ];
  if (portal && booker?.companyName) contact.push([t.reviewCompany, booker.companyName]);
  else if (company) contact.push([t.reviewCompany, company]);
  contact.push([t.reviewPassenger, passenger]);
  if (value("notes")) contact.push([t.notes, value("notes")]);

  const ride: [string, ReactNode][] = waypoints(trip, t).map((w) => [w.label, w.place]);
  if (trip.mode === "hourly" && trip.hours !== "") ride.push([t.duration, interpolate(t.asDirected, { hours: trip.hours })]);
  if (trip.at) ride.push([t.summaryWhen, pretty(trip.at, locale)]);
  if (trip.ret) ride.push([t.summaryReturn, pretty(trip.ret, locale)]);
  ride.push([t.summaryParty, `${guestsText(t, trip.pax)} · ${bagsText(t, trip.bags)}`]);
  if (pickupAtAirport(trip) && trip.flight.trim()) ride.push([t.summaryFlight, trip.flight.trim()]);
  if (routed && estimate) ride.push([t.reviewDistance, estimate === "pending" ? <span className="text-ink-500">{t.reviewDistancePending}</span> : distanceText(estimate, t, locale)]);

  const name = chosen?.name ?? vehicleAdvise;
  const seats = chosen?.specs?.passengers ?? null;

  const card = (title: string, step: BookingStep, children: ReactNode) => (
    <section aria-label={title} className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 text-[16px] font-semibold">{title}</h3>
        <button
          type="button"
          onClick={() => onEdit(step)}
          aria-label={interpolate(t.reviewEdit, { section: title })}
          className="cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 text-[11px] font-semibold tracking-[0.16em] text-ink-600 uppercase hover:bg-ink-100 hover:text-ink-950"
        >
          {t.edit}
        </button>
      </div>
      {children}
    </section>
  );
  const rows = (items: [string, ReactNode][]) => (
    <dl className="m-0 flex flex-col">
      {items.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="flex justify-between gap-4 border-0 border-b border-solid border-ink-150 py-2.5 text-[14px] last:border-b-0">
          <dt className="shrink-0 text-ink-500">{k}</dt>
          <dd className="m-0 min-w-0 text-right wrap-break-word">{v}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section aria-labelledby="booking-review" className="scroll-mt-6">
      <h2 id="booking-review" ref={headingRef} tabIndex={-1} className="m-0 mb-6 font-serif text-[clamp(32px,4vw,44px)] leading-[1.05] font-normal outline-none">
        {t.reviewTitle}
      </h2>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {card(t.reviewContact, "details", rows(contact))}
        {card(t.reviewRide, "journey", rows(ride))}
        {card(
          t.reviewVehicle,
          "car",
          <>
            {chosen?.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element -- small cover photo from /public, as on the car step
              <img src={chosen.images[0]} alt="" className="aspect-[16/9.5] w-full rounded-[12px] object-cover" />
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="font-serif text-[22px] leading-tight">{name}</span>
              {seats !== null && (
                <span className="flex items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-700">
                  <SeatIcon />
                  {interpolate(t.seatsUpTo, { seats })}
                </span>
              )}
            </div>
            {rows([[t.reviewPrice, <span key="price" className="text-ink-700">{t.reviewPriceNote}</span>]])}
          </>,
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:px-6">
        <div className="flex max-w-[60ch] flex-col gap-1">
          <label htmlFor={`${uid}-agree`} className="flex cursor-pointer items-start gap-3 text-[14px]">
            <input
              id={`${uid}-agree`}
              type="checkbox"
              checked={agreed}
              aria-invalid={mustAgree || undefined}
              aria-describedby={mustAgree ? `${uid}-agree-error` : undefined}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) setMustAgree(false);
              }}
              className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-[#0a0a0b]"
            />
            <span>
              {t.reviewAgree}{" "}
              {privacyHref ? (
                <Link href={privacyHref} className="text-ink-950 underline underline-offset-2">
                  {t.privacyLink.toLowerCase()}
                </Link>
              ) : (
                t.privacyLink.toLowerCase()
              )}
              .
            </span>
          </label>
          {mustAgree && (
            <span id={`${uid}-agree-error`} className="pl-[30px] text-[12px] text-error">
              {t.reviewAgreeRequired}
            </span>
          )}
        </div>
        <div className="flex w-full gap-2.5 sm:w-auto">
          <button type="button" onClick={() => onEdit("details")} className="flex h-[52px] cursor-pointer items-center gap-1.5 rounded-xl border border-solid border-ink-225 bg-white px-5 text-[14px] font-semibold text-ink-950 hover:border-ink-950">
            <ArrowLeft />
            {t.back}
          </button>
          {lockedNotice ?? (
            <button
              type="button"
              disabled={result.pending}
              onClick={() => {
                if (!agreed) {
                  setMustAgree(true);
                  document.getElementById(`${uid}-agree`)?.focus();
                  return;
                }
                onSend();
              }}
              className="flex h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-ink-950 px-7 text-[14px] font-semibold text-white hover:bg-ink-800 disabled:cursor-progress disabled:opacity-70 sm:flex-none"
            >
              {result.pending ? t.sending : t.submit}
              {!result.pending && <ArrowRight />}
            </button>
          )}
        </div>
      </div>
      <p aria-live="polite" className="m-0 mt-3 min-h-5 text-[13px] text-error">
        {result.message ?? ""}
      </p>
      {!portal && (
        <p className="m-0 flex items-center gap-2 text-[13px] text-ink-600">
          <Check />
          {t.next1}
        </p>
      )}
    </section>
  );
}
