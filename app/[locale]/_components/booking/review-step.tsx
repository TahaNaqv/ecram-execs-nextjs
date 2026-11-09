"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { FLEET, MAX_GALLERY_IMAGES, fitConvoy, suggestVehicle, vehicleByKey, type ConvoyPlan, type FleetVehicle } from "@/lib/fleet/vehicles";
import { VehicleGallery, type GalleryCopy } from "../vehicle-gallery";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import type { Locale } from "@/lib/i18n/config";
import type { BookingResult, BookingStep, DetailsEntry } from "./booking-flow";
import { Check, pretty, SeatIcon } from "./parts";
import type { AddOnsCopy, BookingCopy } from "./copy";
import { extrasLine } from "@/lib/pricing/extras";
import { guestsText, partyLine } from "./guests-picker";
import { involvesAirport, pickupAtAirport, type Trip } from "./trip";
import { PriceBreakdown, segmentOf, tripPrice, tripWaitMinutes } from "./price";

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
          {trip.guestsSet && (
            <>
              <dt className="text-ink-500">{t.summaryParty}</dt>
              <dd className="m-0">{partyLine(t, trip.pax, trip.bags, trip.small)}</dd>
            </>
          )}
          {trip.guestsSet && convoySentence(t, trip) && (
            <>
              <dt className="text-ink-500">{t.reviewVehicle}</dt>
              <dd className="m-0">{convoySentence(t, trip)}</dd>
            </>
          )}
        </dl>
      )}
    </aside>
  );
}

const chosenPicks = (trip: Pick<Trip, "cars">) => trip.cars.filter((c) => c.count > 0);

const lineFor = (t: BookingCopy, picks: { key: string; count: number }[]) =>
  picks.map((p) => interpolate(t.convoyCars, { count: p.count, car: vehicleByKey(p.key)?.name ?? p.key })).join(", ");

/** Cars to draw when more than one is in play: the visitor's mix, or the tight fit we suggest. Empty for a single car. */
export function previewCars(trip: Pick<Trip, "pax" | "cars">, offered: readonly { key: string }[] = FLEET): { key: string; name: string; images: string[]; count: number }[] {
  const manual = chosenPicks(trip);
  const source = manual.length > 1 || (manual[0]?.count ?? 0) > 1 ? manual : manual.length === 0 ? (fitConvoy(offered, trip.pax) ?? []) : [];
  return source.flatMap((pick) => {
    const vehicle = vehicleByKey(pick.key);
    return vehicle ? [{ key: vehicle.key, name: vehicle.name, images: vehicle.images.slice(0, MAX_GALLERY_IMAGES), count: pick.count }] : [];
  });
}

/** Every photo of each chosen model, stacked as its own full-width card with arrows. */
export function CarMixPreview({ cars, copy }: { cars: { key: string; name: string; images: string[]; count: number }[]; copy: GalleryCopy }) {
  if (cars.length === 0) return null;
  return (
    <ul className="m-0 flex w-full list-none flex-col gap-4 p-0">
      {cars.map((car) => (
        <li key={car.key} className="box-border flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-[12px] border border-solid border-[#d7deee] bg-[#ffffff]">
          <div className="flex items-center px-3 py-2.5">
            <span className="truncate text-[13px] leading-none font-semibold text-[#10224f]">
              {car.count} × {car.name}
            </span>
          </div>
          <div className="relative aspect-video w-full overflow-hidden bg-ink-100">
            <VehicleGallery key={car.images.join("|")} name={car.name} images={car.images} alt={car.name} copy={copy} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "2 × Audi e-tron GT" or "1 × Audi e-tron GT, 1 × Cadillac Escalade IQ". Null for one single car. */
export function selectionLabel(t: BookingCopy, trip: Pick<Trip, "pax" | "vehicle" | "cars">, offered: readonly { key: string }[] = FLEET): string | null {
  const picks = chosenPicks(trip);
  if (picks.length > 1 || (picks[0] && picks[0].count > 1)) return lineFor(t, picks);
  if (picks.length === 1) return null;
  const plan = fitConvoy(offered, trip.pax);
  return plan ? lineFor(t, plan) : null;
}

/** The sentence shown when more than one car is chosen, or when the party does not fit in one and none was chosen. */
export function convoySentence(t: BookingCopy, trip: Pick<Trip, "pax" | "vehicle" | "cars">, offered: readonly { key: string }[] = FLEET): string | null {
  const label = selectionLabel(t, trip, offered);
  if (!label) return null;
  // The visitor's own mix is their choice, not something the party requires
  return interpolate(chosenPicks(trip).length > 0 ? t.convoyChosen : t.convoyLine, { cars: label, party: guestsText(t, trip.pax) });
}

export function convoyPlan(trip: Pick<Trip, "pax" | "vehicle" | "cars">, offered: readonly { key: string }[] = FLEET): ConvoyPlan | undefined {
  if (chosenPicks(trip).length > 0) return undefined;
  const plan = fitConvoy(offered, trip.pax);
  const lead = plan ? vehicleByKey(plan[0]?.key) : undefined;
  if (!plan || !lead || plan.length !== 1) return undefined;
  return { count: plan[0].count, vehicle: lead };
}

/** "121.5 km · 1 h 25 m" from Google's answer, in the visitor's language. */
/** "1 h 25 m" or "45 m" in the visitor's language. */
function minutesText(minutes: number, t: BookingCopy) {
  const total = Math.max(1, Math.round(minutes));
  return total >= 60 ? interpolate(t.reviewHoursMinutes, { hours: Math.floor(total / 60), minutes: total % 60 }) : interpolate(t.reviewMinutes, { minutes: total });
}

function distanceText(est: { meters: number; seconds: number }, t: BookingCopy, locale: Locale) {
  const km = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 }).format(est.meters / 1000);
  return interpolate(t.reviewDistanceValue, { km, time: minutesText(est.seconds / 60, t) });
}

/**
 * The last step: the trip and party, then the vehicle and price, then the agreement, then the send.
 * Distance and driving time are asked of Google here, once, and not before (see /api/route-estimate).
 */
export function ReviewStep({
  headingRef,
  variant,
  trip,
  entered,
  copy: t,
  addOns,
  locale,
  chosen,
  vehicleAdvise,
  result,
  booker,
  lockedNotice,
  gallery,
  onEdit,
  onSend,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  variant: "public" | "portal";
  trip: Trip;
  entered: DetailsEntry;
  copy: BookingCopy;
  addOns: AddOnsCopy;
  locale: Locale;
  chosen: FleetVehicle | undefined;
  vehicleAdvise: string;
  result: BookingResult;
  booker?: { name: string; email: string; companyName?: string | null };
  lockedNotice?: ReactNode;
  gallery: GalleryCopy;
  onEdit: (step: BookingStep) => void;
  onSend: (quoted: ReturnType<typeof tripPrice>) => void;
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
  ride.push([t.summaryParty, partyLine(t, trip.pax, trip.bags, trip.small)]);
  if (pickupAtAirport(trip) && trip.flight.trim()) ride.push([t.summaryFlight, trip.flight.trim()]);
  if (routed && estimate) ride.push([t.reviewDistance, estimate === "pending" ? <span className="text-ink-500">{t.reviewDistancePending}</span> : distanceText(estimate, t, locale)]);
  // The drive and the waits together: the time the price is worked out on
  const waits = tripWaitMinutes(trip);
  if (routed && estimate && estimate !== "pending" && waits > 0) {
    ride.push([t.reviewTotalTime, interpolate(t.reviewTotalTimeValue, { time: minutesText(estimate.seconds / 60 + waits, t), wait: minutesText(waits, t) })]);
  }

  const picks = trip.cars.filter((c) => c.count > 0);
  const plan = convoyPlan(trip);
  const convoy = convoySentence(t, trip);
  const listed = picks.length > 1 || (picks[0]?.count ?? 0) > 1
    ? picks.map((p) => `${p.count} × ${vehicleByKey(p.key)?.name ?? p.key}`).join(", ")
    : null;
  if (listed) ride.push([t.reviewVehicle, listed]);
  else if (convoy) ride.push([t.reviewVehicle, convoy]);
  const extras = extrasLine(addOns, trip.extras);
  if (extras) ride.push([t.reviewExtras, extras]);
  const label = selectionLabel(t, trip);
  const mix = previewCars(trip);
  const advised = trip.vehicle === "advise" && picks.length === 0 ? suggestVehicle(FLEET, { pax: trip.pax, bags: trip.bags }) : undefined;
  const lead = picks.length > 0 ? vehicleByKey(picks[0].key) : plan?.vehicle ?? chosen ?? advised;
  const name = advised?.name || label || lead?.name || vehicleAdvise;
  const photos = (lead?.images ?? []).slice(0, MAX_GALLERY_IMAGES);
  const seats = label ? null : (lead?.specs?.passengers ?? null);

  const segment = segmentOf(variant);
  const price = tripPrice(trip, segment, estimate && estimate !== "pending" ? estimate.seconds : null, estimate && estimate !== "pending" ? estimate.meters : null);

  const card = (title: string, children: ReactNode) => (
    <section aria-label={title} className="box-border flex h-full min-w-0 flex-col justify-between gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6">
      <h3 className="m-0 shrink-0 text-[16px] font-semibold">{title}</h3>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
  const rows = (items: [string, ReactNode][]) => (
    <dl className="m-0 flex h-full flex-1 flex-col justify-between">
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
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          {card(t.reviewContact, rows(contact))}
          {card(t.reviewRide, rows(ride))}
        </div>
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          <section aria-label={t.reviewVehicle} className="box-border flex h-full min-w-0 flex-col justify-between gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6">
            <h3 className="m-0 shrink-0 text-[16px] font-semibold">{t.reviewVehicle}</h3>
            {mix.length > 0 ? (
              <div className="min-h-0 flex-1">
                <CarMixPreview cars={mix} copy={gallery} />
              </div>
            ) : photos.length > 0 ? (
              <div className="relative min-h-48 w-full flex-1 overflow-hidden rounded-[12px] bg-ink-100">
                <div className="absolute inset-0">
                  <VehicleGallery key={photos.join("|")} name={name} images={photos} alt={name} copy={gallery} />
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1" />
            )}
            <div className="flex shrink-0 items-start justify-between gap-3">
              {listed ? (
                <span className="flex flex-col gap-1 font-serif text-[22px] leading-tight">
                  {picks.map((p) => (
                    <span key={p.key}>
                      {p.count} × {vehicleByKey(p.key)?.name ?? p.key}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="min-w-0 font-serif text-[22px] leading-tight">{name}</span>
              )}
              {seats !== null && (
                <span className="flex shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap text-ink-700">
                  <SeatIcon />
                  {interpolate(t.seatsUpTo, { seats })}
                </span>
              )}
            </div>
            {convoy && <p className="m-0 shrink-0 text-[14px] leading-snug text-ink-700">{convoy}</p>}
          </section>
          <section aria-label={t.reviewPrice} className="box-border flex h-full min-w-0 flex-col justify-between gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6">
            <h3 className="m-0 shrink-0 text-[16px] font-semibold">{t.reviewPrice}</h3>
            <div className="flex min-h-0 flex-1 flex-col justify-between">
              <PriceBreakdown price={price} names={addOns} pending={estimate === "pending"} hourly={trip.mode === "hourly"} timed={Boolean(estimate && estimate !== "pending")} copy={t} locale={locale} />
            </div>
            <div className="shrink-0 border-0 border-t border-solid border-ink-150 pt-3">
              <label htmlFor={`${uid}-agree`} className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug">
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
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#0a0a0b]"
                />
                <span>
                  {t.reviewAgree}{" "}
                  <a href={localizedPath("/terms", locale)} target="_blank" rel="noopener noreferrer" className="text-ink-950 underline underline-offset-2">
                    {t.termsLink}
                  </a>
                  {t.termsAfter}
                </span>
              </label>
              {mustAgree && (
                <span id={`${uid}-agree-error`} className="mt-1 block pl-[26px] text-[12px] text-error">
                  {t.reviewAgreeRequired}
                </span>
              )}
            </div>
          </section>
        </div>
       
        <p aria-live="polite" className={result.message ? "m-0 text-[13px] text-error" : "sr-only"}>
          {result.message ?? ""}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-4">
          <div className="flex w-full gap-2.5 lg:w-auto">
            <button type="button" onClick={() => onEdit("details")} className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-ink-225 bg-white px-4 text-[13px] font-semibold tracking-wide text-ink-950 hover:border-ink-950">
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
                  onSend(price);
                }}
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white hover:bg-ink-800 disabled:cursor-progress disabled:opacity-70 sm:flex-none"
              >
                {result.pending ? t.sending : t.submit}
                {!result.pending && <ArrowRight />}
              </button>
            )}
          </div>
          {/* Nothing is paid yet: every booking is reviewed by hand first (the client, 8 Nov 2026) */}
          <p className="m-0 w-full text-right text-[13px] text-ink-600">{t.submitNote}</p>
        </div>
      </div>
    </section>
  );
}