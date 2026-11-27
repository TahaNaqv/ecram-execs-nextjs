"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Same route asked again (back to review, or a re-render) reuses the drive already measured. */
const routeEstimates = new Map<string, { meters: number; seconds: number }>();
import {
  FLEET,
  MAX_GALLERY_IMAGES,
  normalizeVehicleKey,
  fitConvoy,
  suggestVehicle,
  vehicleByKey,
  type ConvoyPlan,
  type FleetVehicle,
  type OfferedVehicle,
} from "@/lib/fleet/vehicles";
import { VehicleGallery, type GalleryCopy } from "../vehicle-gallery";
import { interpolate } from "@/lib/i18n/interpolate";
import { localizedPath } from "@/lib/i18n/pathnames";
import type { Locale } from "@/lib/i18n/config";
import type { BookingResult, BookingStep, DetailsEntry } from "./booking-flow";
import { CountryCode } from "./country-code";
import { pretty, SeatIcon } from "./parts";
import { netherlandsNow, type AddOnsCopy, type BookingCopy, type TripMessages } from "./copy";
import { extrasLine } from "@/lib/pricing/extras";
import { AddressField } from "./address-field";
import { DateTimeField, type DateTimeCopy } from "@/components/date-time-field";
import { GuestsPicker, guestsText, partyLine } from "./guests-picker";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { MAX_STOPS } from "@/lib/quotes/stops";
import { adjacentPlaceTexts, carsCapacityProblem, involvesAirport, MAX_PER_CAR, normalizeTrip, samePlace, type Place, type Stop, type Trip } from "./trip";
import { cleanPhoneInput } from "@/lib/phone";
import { isPastWall } from "@/lib/time/amsterdam";
import { formatRouteSpan, spanFromPrice } from "@/lib/pricing/route-span";
import { PriceBreakdown, segmentOf, tripPrice, tripWaitMinutes } from "./price";
import { amsterdamDay, launchSchedule } from "@/lib/payments/schedule";
import { formatCents } from "@/lib/pricing/rates";

type EditableSection = "contact" | "ride" | "vehicle" | null;

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
    ...trip.stops
      .filter((s) => s.place.trim())
      .map((s, index) => ({
        label: interpolate(t.reviewStop, { number: index + 1 }),
        place: s.wait ? `${s.place} (${interpolate(t.waitMinutes, { minutes: s.wait })})` : s.place,
      })),
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
    <aside
      aria-label={t.routeTitle}
      className="flex flex-col gap-5 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6 lg:sticky lg:top-24"
    >
      <span className="text-[11px] font-semibold tracking-[0.16em] text-ink-500 uppercase">{t.routeTitle}</span>
      {points.length === 0 ? (
        <p className="m-0 text-[14px] text-ink-600">{t.routeEmpty}</p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {points.map((w, i) => (
            <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
              {i < points.length - 1 && (
                <span aria-hidden="true" className="absolute top-4 bottom-0 left-[7px] w-px bg-ink-300" />
              )}
              <span
                aria-hidden="true"
                className={`relative mt-1 size-[15px] shrink-0 rounded-full border-2 border-solid border-ink-950 ${
                  i === 0 || i === points.length - 1 ? "bg-ink-950" : "bg-white"
                }`}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[12px] text-ink-600">{w.label}</span>
                <span className="text-[15px] font-medium wrap-break-word">{w.place}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {trip.mode === "hourly" && trip.hours !== "" && (
        <p className="m-0 text-[14px] text-ink-700">{interpolate(t.routeHourly, { hours: trip.hours })}</p>
      )}
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
export function previewCars(
  trip: Pick<Trip, "pax" | "cars">,
  offered: readonly OfferedVehicle[] = FLEET,
): { key: string; name: string; images: string[]; count: number }[] {
  const manual = chosenPicks(trip);
  const source = manual.length > 1 || (manual[0]?.count ?? 0) > 1 ? manual : manual.length === 0 ? fitConvoy(offered, trip.pax) ?? [] : [];
  return source.flatMap((pick) => {
    const vehicle = vehicleByKey(pick.key);
    const extra = offered.find((item) => item.key === pick.key);
    const images = (extra?.images?.length ? extra.images : vehicle?.images) ?? [];
    const name = vehicle?.name ?? extra?.name;
    return name ? [{ key: pick.key, name, images: images.slice(0, MAX_GALLERY_IMAGES), count: pick.count }] : [];
  });
}

/** Every photo of each chosen model, stacked as its own full-width card with arrows. */
export function CarMixPreview({
  cars,
  copy,
}: {
  cars: { key: string; name: string; images: string[]; count: number }[];
  copy: GalleryCopy;
}) {
  if (cars.length === 0) return null;
  return (
    <ul className="m-0 flex w-full list-none flex-col gap-4 p-0">
      {cars.map((car) => (
        <li
          key={car.key}
          className="box-border flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-[12px] border border-solid border-[#d7deee] bg-[#ffffff]"
        >
          <div className="flex items-center px-3 py-2.5">
            <span className="truncate text-[13px] leading-none font-semibold text-[#10224f]">
              {car.count} × {car.name}
            </span>
          </div>
          <div className="relative aspect-video w-full overflow-hidden bg-ink-100">
            <VehicleGallery key={car.images.join("|")} name={car.name} images={car.images} alt={car.name} copy={copy} fit="contain" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "2 × Audi E-Tron GT" or "1 × Audi E-Tron GT, 1 × Cadillac Escalade IQ". Null for one single car. */
export function selectionLabel(
  t: BookingCopy,
  trip: Pick<Trip, "pax" | "vehicle" | "cars">,
  offered: readonly { key: string }[] = FLEET,
): string | null {
  const picks = chosenPicks(trip);
  if (picks.length > 1 || (picks[0] && picks[0].count > 1)) return lineFor(t, picks);
  if (picks.length === 1) return null;
  const plan = fitConvoy(offered, trip.pax);
  return plan ? lineFor(t, plan) : null;
}

/** The sentence shown when more than one car is chosen, or when the party does not fit in one and none was chosen. */
export function convoySentence(
  t: BookingCopy,
  trip: Pick<Trip, "pax" | "vehicle" | "cars">,
  offered: readonly { key: string }[] = FLEET,
): string | null {
  const label = selectionLabel(t, trip, offered);
  if (!label) return null;
  return interpolate(chosenPicks(trip).length > 0 ? t.convoyChosen : t.convoyLine, { cars: label, party: guestsText(t, trip.pax) });
}

export function convoyPlan(
  trip: Pick<Trip, "pax" | "vehicle" | "cars">,
  offered: readonly { key: string }[] = FLEET,
): ConvoyPlan | undefined {
  if (chosenPicks(trip).length > 0) return undefined;
  const plan = fitConvoy(offered, trip.pax);
  const lead = plan ? vehicleByKey(plan[0]?.key) : undefined;
  if (!plan || !lead || plan.length !== 1) return undefined;
  return { count: plan[0].count, vehicle: lead };
}

/** "1 h 25 m" or "45 m" in the visitor's language. */
function minutesText(minutes: number, t: BookingCopy) {
  const total = Math.max(1, Math.round(minutes));
  return total >= 60 ? interpolate(t.reviewHoursMinutes, { hours: Math.floor(total / 60), minutes: total % 60 }) : interpolate(t.reviewMinutes, { minutes: total });
}

function distanceText(est: { meters: number; seconds: number }, t: BookingCopy, locale: Locale) {
  return formatRouteSpan(est, t, locale);
}

function setFieldValue(fields: DetailsEntry["fields"], key: string, nextValue: string): DetailsEntry["fields"] {
  const index = fields.findIndex(([name]) => name === key);
  if (index === -1) return [...fields, [key, nextValue]];
  return fields.map(([name, val], idx) => (idx === index ? [name, nextValue] : [name, val]));
}

/**
 * The last step: the trip and party, then the vehicle and price, then the agreement, then the send.
 * Distance and driving time are asked of Google here, once, and not before (see /api/route-estimate).
 */
function payLabel(status: string, t: { payLivePaid: string; payLivePending: string; payLiveFailed: string; payLiveUnpaid: string }): string {
  if (status === "paid") return t.payLivePaid;
  if (status === "pending" || status === "authorized") return t.payLivePending;
  if (status === "failed" || status === "canceled" || status === "expired") return t.payLiveFailed;
  return t.payLiveUnpaid;
}

function savedReceipt(reference: string): string | null {
  try {
    return sessionStorage.getItem("ee-booking-receipt-for") === reference ? sessionStorage.getItem("ee-booking-receipt") : null;
  } catch {
    return null;
  }
}

function openReviewReceipt(reference: string, locale: string, paidLabel: string) {
  const raw = savedReceipt(reference);
  if (!raw) return;
  let receipt: { passengerName?: string; pickup?: string; dropoff?: string; when?: string; vehicle?: string } = {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    receipt = parsed as typeof receipt;
  } catch {
    return;
  }
  const rows = [
    ["Reference", reference],
    ["Status", paidLabel],
    ["Passenger", receipt?.passengerName ?? ""],
    ["Collection", receipt?.pickup ?? ""],
    ["Destination", receipt?.dropoff ?? ""],
    ["When", receipt?.when ?? ""],
    ["Vehicle", receipt?.vehicle ?? ""],
  ].filter((row) => row[1]);
  const html = `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${reference}</title></head><body style="font-family:Georgia,serif;margin:32px;color:#0a1942"><h1>${reference}</h1><table>${rows
    .map(([label, value]) => `<tr><th align="left" style="padding:6px 16px 6px 0">${label}</th><td>${String(value).replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"))}</td></tr>`)
    .join("")}</table></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) opened.opener = null;
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function checkoutHref(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && (url.hostname === "mollie.com" || url.hostname.endsWith(".mollie.com"))) return true;
    return (url.protocol === "http:" || url.protocol === "https:") && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

export function ReviewStep({
  headingRef,
  variant,
  trip: propTrip,
  entered: propEntered,
  copy: t,
  addOns,
  locale,
  chosen: propChosen,
  vehicleAdvise,
  result,
  booker,
  lockedNotice,
  gallery,
  vehicles = FLEET,
  messages,
  dateTimeCopy,
  onEdit,
  onUpdateTrip,
  onUpdateDetails,
  onSend,
  payOnline = false,
  sentPayment = null,
}: {
  /** Paid at booking (the client's rules of 15 Nov 2026): the button pays, and the schedule is spelled out */
  payOnline?: boolean;
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
  vehicles?: readonly OfferedVehicle[];
  messages: TripMessages;
  dateTimeCopy: DateTimeCopy;
  onEdit: (step: BookingStep) => void;
  /** Optional inline updaters so edits stay on the review step without restarting the flow */
  onUpdateTrip?: (nextTrip: Trip) => void;
  onUpdateDetails?: (nextDetails: DetailsEntry) => void;
  /** `shown`: the payment plan and total the customer agreed to on this screen (checked again by the server) */
  onSend: (quoted: ReturnType<typeof tripPrice>, shown: { plan: string; totalCents: number; payNow?: boolean } | null) => void;
  /** After Book and pay: this screen stays, Mollie is the other tab, and the button follows the payment. */
  sentPayment?: { reference: string; checkoutUrl: string | null; guestKey: string | null; popupBlocked?: boolean } | null;
}) {
  const uid = useId();
  const portal = variant === "portal";

  const [localTrip, setLocalTrip] = useState<Trip>(propTrip);
  const [localEntered, setLocalEntered] = useState<DetailsEntry>(propEntered);

  useEffect(() => {
    setLocalTrip(propTrip);
  }, [propTrip]);

  useEffect(() => {
    setLocalEntered(propEntered);
  }, [propEntered]);

  const trip = onUpdateTrip ? propTrip : localTrip;
  const entered = onUpdateDetails ? propEntered : localEntered;

  const commitTrip = (nextTrip: Trip) => {
    setLocalTrip(nextTrip);
    onUpdateTrip?.(nextTrip);
  };

  const commitEntered = (nextDetails: DetailsEntry) => {
    setLocalEntered(nextDetails);
    onUpdateDetails?.(nextDetails);
  };

  const [editingSection, setEditingSection] = useState<EditableSection>(null);

  // Draft state for inline Contact Details editing
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhoneCountry, setDraftPhoneCountry] = useState("31");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftPurpose, setDraftPurpose] = useState<DetailsEntry["purpose"]>("business");
  const [draftWho, setDraftWho] = useState<DetailsEntry["who"]>("me");
  const [draftPassengerName, setDraftPassengerName] = useState("");
  const [draftPassengerPhone, setDraftPassengerPhone] = useState("");
  const [draftNotes, setDraftNotes] = useState("");

  // Draft state for inline Ride details editing
  const [draftMode, setDraftMode] = useState<Trip["mode"]>("oneway");
  const [draftFrom, setDraftFrom] = useState<Place>({ text: "", id: null, kind: null });
  const [draftTo, setDraftTo] = useState<Place>({ text: "", id: null, kind: null });
  const [draftAt, setDraftAt] = useState("");
  const [draftHours, setDraftHours] = useState<number | "">("");
  const [hoursOpen, setHoursOpen] = useState(false);
  const [draftPax, setDraftPax] = useState<number>(1);
  const [draftBags, setDraftBags] = useState<number>(0);
  const [draftSmall, setDraftSmall] = useState<number>(0);
  const [draftStops, setDraftStops] = useState<Stop[]>([]);

  // Draft state for inline Vehicle editing
  const [draftVehicleKey, setDraftVehicleKey] = useState<string>("advise");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const vehicleOrigin = useRef<Trip | null>(null);

  const value = (k: string) => (entered.fields.find(([name]) => name === k)?.[1] ?? "").trim();

  const discardVehiclePreview = () => {
    if (editingSection === "vehicle" && vehicleOrigin.current) commitTrip(vehicleOrigin.current);
    vehicleOrigin.current = null;
  };

  const startEditContact = () => {
    discardVehiclePreview();
    setFormErrors({});
    setDraftName(portal && booker ? booker.name : value("name"));
    setDraftEmail(portal && booker ? booker.email : value("email"));
    setDraftPhoneCountry(value("phoneCountry") || "31");
    setDraftPhone(value("phone"));
    setDraftPurpose(entered.purpose);
    setDraftWho(entered.who);
    setDraftPassengerName(entered.who === "other" ? value("passengerName") : "");
    setDraftPassengerPhone(value("passengerPhone"));
    setDraftNotes(value("notes"));
    setEditingSection("contact");
  };

  const saveContact = () => {
    const name = draftName.trim();
    const email = draftEmail.trim();
    const country = draftPhoneCountry.replace(/\D/g, "") || "31";
    const phone = cleanPhoneInput(draftPhone, country);
    const found: Record<string, string> = {};
    if (!portal && !name) found.name = messages.nameRequired;
    if (!portal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = messages.emailInvalid;
    if (phone.replace(/\D/g, "").length < 6) found.phone = messages.phoneNumberInvalid;
    if (draftWho === "other" && !draftPassengerName.trim()) found.passenger = t.passengerNameRequired;
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;
    let nextFields = [...entered.fields];
    if (!(portal && booker)) {
      nextFields = setFieldValue(nextFields, "name", name);
      nextFields = setFieldValue(nextFields, "email", email);
    }
    nextFields = setFieldValue(nextFields, "phoneCountry", country);
    nextFields = setFieldValue(nextFields, "phone", phone);
    nextFields = setFieldValue(nextFields, "passengerName", draftWho === "other" ? draftPassengerName.trim() : "");
    nextFields = setFieldValue(nextFields, "passengerPhone", draftWho === "other" ? cleanPhoneInput(draftPassengerPhone, country) : "");
    nextFields = setFieldValue(nextFields, "notes", draftNotes);
    commitEntered({ ...entered, who: draftWho, purpose: draftPurpose, fields: nextFields });
    setFormErrors({});
    setEditingSection(null);
  };

  const startEditRide = () => {
    discardVehiclePreview();
    setFormErrors({});
    setDraftMode(trip.mode);
    setDraftFrom(trip.from);
    setDraftTo(trip.to);
    setDraftAt(trip.at ?? "");
    setDraftHours(trip.hours);
    setDraftPax(Math.max(1, Number(trip.pax) || 1));
    setDraftBags(Math.max(0, Number(trip.bags) || 0));
    setDraftSmall(Math.max(0, Number(trip.small) || 0));
    setDraftStops(trip.stops);
    setEditingSection("ride");
  };

  const saveRide = () => {
    const from = draftFrom.text.trim();
    const to = draftTo.text.trim();
    const found: Record<string, string> = {};
    if (!from) found.from = messages.collectionRequired;
    if (draftMode === "oneway" && !to) found.to = messages.destinationRequired;
    if (from && to && samePlace(from, to)) found.to = messages.samePlace;
    if (draftMode === "hourly" && draftHours === "") found.hours = t.durationPlaceholder;
    if (!draftAt.trim()) found.at = messages.pickupInvalid;
    else if (isPastWall(draftAt.trim(), netherlandsNow())) found.at = messages.pickupPast;
    setFormErrors(found);
    if (Object.keys(found).length > 0) return;
    commitTrip({
      ...trip,
      mode: draftMode,
      from: { ...draftFrom, text: from },
      to: draftMode === "hourly" ? trip.to : { ...draftTo, text: to },
      at: draftAt.trim(),
      hours: draftMode === "hourly" ? draftHours : trip.hours,
      stops: draftMode === "oneway" ? draftStops.filter((stop) => stop.place.trim()) : [],
      pax: Math.max(1, draftPax),
      bags: Math.max(0, draftBags),
      small: Math.max(0, draftSmall),
      guestsSet: true,
    });
    setFormErrors({});
    setEditingSection(null);
  };

  const setVehicleCount = (key: string, count: number) => {
    const others = trip.cars.filter((car) => car.key !== key);
    const cars = key === "advise" || count <= 0 ? (key === "advise" ? [] : others) : [...others, { key, count: Math.min(MAX_PER_CAR, count) }];
    const next = normalizeTrip(cars.length > 0 ? { ...trip, cars, vehicle: cars[0].key } : { ...trip, cars: [], vehicle: "advise" });
    const problem = carsCapacityProblem(next.cars, next.pax, next.bags);
    setFormErrors(
      problem.passengers || problem.luggage
        ? { vehicle: problem.passengers && problem.luggage ? messages.vehicleBoth : problem.passengers ? messages.vehiclePassengers : messages.vehicleLuggage }
        : {},
    );
    setDraftVehicleKey(next.vehicle || "advise");
    commitTrip(next);
  };

  const startEditVehicle = () => {
    vehicleOrigin.current = trip;
    const activePick = trip.cars.find((c) => c.count > 0)?.key;
    setDraftVehicleKey(activePick || trip.vehicle || "advise");
    setFormErrors({});
    setEditingSection("vehicle");
  };

  const saveVehicle = () => {
    vehicleOrigin.current = null;
    setFormErrors({});
    setEditingSection(null);
  };

  const setRideMode = (mode: Trip["mode"]) => {
    if (editingSection === "ride") {
      setDraftMode(mode);
      return;
    }
    if (trip.mode === mode) return;
    commitTrip({ ...trip, mode });
  };

  const cancelEdit = () => {
    if (editingSection === "vehicle" && vehicleOrigin.current) commitTrip(vehicleOrigin.current);
    vehicleOrigin.current = null;
    setFormErrors({});
    setEditingSection(null);
  };

  const [agreed, setAgreed] = useState(false);
  const [payStatus, setPayStatus] = useState("open");
  const [checking, setChecking] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const paid = payStatus === "paid";
  const checkoutUrl = sentPayment && checkoutHref(sentPayment.checkoutUrl) ? sentPayment.checkoutUrl : null;
  const reference = sentPayment?.reference?.trim() ?? "";
  const referenceOk = /^EE-[A-Z0-9]{6}$/i.test(reference);

  const lookUpPayment = useRef<() => void>(() => {});
  lookUpPayment.current = () => {
    const key = sentPayment?.guestKey;
    if (!key || !referenceOk) {
      setPayError(t.payLiveRetry);
      return;
    }
    setChecking(true);
    const params = new URLSearchParams({ ref: reference, k: key, sync: "1" });
    fetch(`/api/booking/state?${params}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { payment?: string | null } | null) => {
        if (!data) {
          setPayError(t.payLiveRetry);
          return;
        }
        setPayError(null);
        setPayStatus(typeof data.payment === "string" && data.payment ? data.payment : "open");
      })
      .catch(() => setPayError(t.payLiveRetry))
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    if (!sentPayment?.guestKey || !referenceOk || paid) return;
    lookUpPayment.current();
    const timer = window.setInterval(() => lookUpPayment.current(), 4000);
    return () => window.clearInterval(timer);
  }, [sentPayment?.guestKey, referenceOk, paid]);
  const [mustAgree, setMustAgree] = useState(false);

  const routed = trip.mode === "oneway" && trip.from.text.trim() && trip.to.text.trim();
  const stopsKey = trip.stops.map((s) => s.place.trim()).filter(Boolean).join("|");
  const routeKey = routed ? `${trip.from.text.trim()}|${stopsKey}|${trip.to.text.trim()}` : "";
  const [estimate, setEstimate] = useState<{ meters: number; seconds: number } | null | "pending">(() => {
    if (!routeKey) return null;
    return routeEstimates.get(routeKey) ?? "pending";
  });

  useEffect(() => {
    if (!routed || !routeKey) {
      setEstimate(null);
      return;
    }
    const cached = routeEstimates.get(routeKey);
    if (cached) {
      setEstimate(cached);
      return;
    }
    setEstimate("pending");
    const query = new URLSearchParams({ from: trip.from.text, to: trip.to.text });
    for (const s of stopsKey.split("|").filter(Boolean)) query.append("stop", s);
    const controller = new AbortController();
    fetch(`/api/route-estimate?${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { meters?: number; seconds?: number } | null) => {
        if (typeof data?.meters === "number" && typeof data.seconds === "number") {
          const found = { meters: data.meters, seconds: data.seconds };
          routeEstimates.set(routeKey, found);
          setEstimate(found);
          return;
        }
        setEstimate(null);
      })
      .catch((err: Error) => err.name !== "AbortError" && setEstimate(null));
    return () => controller.abort();
  }, [routed, routeKey, trip.from.text, trip.to.text, stopsKey]);

  const phone = (country: string, number: string) => (number ? `+${country} ${number}` : "");
  const kind =
    trip.mode === "hourly"
      ? t.modeHourly
      : involvesAirport(trip)
        ? t.reviewAirport
        : entered.purpose === "private"
          ? t.purposePrivate
          : t.purposeBusiness;
  const company =
    entered.purpose === "business" ? [value("entity"), value("entityKvk") && `KVK ${value("entityKvk")}`].filter(Boolean).join(" · ") : "";
  const passenger =
    entered.who === "other"
      ? [value("passengerName"), phone(value("passengerPhoneCountry") || value("phoneCountry"), value("passengerPhone"))]
          .filter(Boolean)
          .join(" · ")
      : t.reviewSameAsBooker;

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

  const segment = segmentOf(variant);
  const drive = estimate && estimate !== "pending" ? estimate : null;
  const waits = tripWaitMinutes(trip);
  const price = tripPrice(trip, segment, drive?.seconds ?? null, drive?.meters ?? null);
  const timing = payOnline && price && price.total > 0 ? launchSchedule(trip.at, amsterdamDay(), price.total, price) : null;
  const payPlan = timing?.plan ?? null;
  const upfront = timing && timing.upfrontCents > 0 ? timing.upfrontCents : null;
  const restCents = timing?.scheduledBalanceCents ?? 0;
  const restOn = timing?.scheduledBalanceDate ? timing.scheduledBalanceDate.toISOString().slice(0, 10) : null;
  const longDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T12:00:00Z`));

  const storedDrive =
    !drive && price && typeof price.distanceMeters === "number" && price.distanceMeters > 0 && typeof price.driveSeconds === "number" && price.driveSeconds > 0
      ? { meters: price.distanceMeters, seconds: price.driveSeconds }
      : null;
  const driveOnly = drive ?? storedDrive;
  const withWaits = driveOnly && waits > 0 ? { meters: driveOnly.meters, seconds: driveOnly.seconds + waits * 60 } : driveOnly;
  const calculated = estimate === "pending" ? null : withWaits ?? spanFromPrice(price);

  if (routed || trip.mode === "hourly" || calculated) {
    const distance =
      estimate === "pending" ? (
        <span className="text-ink-500">{t.reviewDistancePending}</span>
      ) : trip.mode === "hourly" && trip.hours !== "" ? (
        interpolate(t.asDirected, { hours: trip.hours })
      ) : calculated ? (
        distanceText(calculated, t, locale)
      ) : (
        <span className="text-ink-500">{t.reviewDistanceUnavailable}</span>
      );
    ride.push([t.reviewDistance, distance]);
  }
  if (driveOnly && waits > 0) {
    ride.push([
      t.reviewTotalTime,
      interpolate(t.reviewTotalTimeValue, { time: minutesText(driveOnly.seconds / 60 + waits, t), wait: minutesText(waits, t) }),
    ]);
  }

  const picks = trip.cars.filter((c) => c.count > 0);
  const plan = convoyPlan(trip);
  const convoy = convoySentence(t, trip);
  const listed =
    picks.length > 1 || (picks[0]?.count ?? 0) > 1
      ? picks.map((p) => `${p.count} × ${vehicleByKey(p.key)?.name ?? p.key}`).join(", ")
      : null;
  if (listed) ride.push([t.reviewVehicle, listed]);
  else if (convoy) ride.push([t.reviewVehicle, convoy]);

  const extras = extrasLine(addOns, trip.extras);
  if (extras) ride.push([t.reviewExtras, extras]);

  const activeSingleVehicle = picks.length === 1 ? vehicleByKey(picks[0].key) : undefined;
  const label = selectionLabel(t, trip);
  const mix = previewCars(trip, vehicles);
  // Suggested from the cars that can be booked now: a model coming soon is left out of `vehicles`
  const advised =
    trip.vehicle === "advise" && picks.length === 0
      ? suggestVehicle(FLEET.filter((car) => vehicles.some((offer) => (normalizeVehicleKey(offer.key) ?? offer.key) === car.key)), { pax: trip.pax, bags: trip.bags })
      : undefined;
  const lead = picks.length > 0 ? vehicleByKey(picks[0].key) : plan?.vehicle ?? activeSingleVehicle ?? propChosen ?? advised;
  const extra = picks[0] ? vehicles.find((item) => item.key === picks[0].key) : undefined;
  const name = advised?.name || label || lead?.name || extra?.name || vehicleAdvise;
  const photos = (extra?.images?.length ? extra.images : lead?.images ?? []).slice(0, MAX_GALLERY_IMAGES);
  const seats = label ? null : lead?.specs?.passengers ?? null;

  const renderSectionActions = (
    sectionKey: Exclude<EditableSection, null>,
    onStart: () => void,
    onSave: () => void,
  ) => {
    if (editingSection === sectionKey) {
      return (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={cancelEdit}
            className="cursor-pointer rounded-full border border-solid border-ink-225 bg-white px-3 py-1 text-[12px] font-semibold text-ink-700 hover:border-ink-950 hover:text-ink-950"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="cursor-pointer rounded-full border-0 bg-ink-950 px-3 py-1 text-[12px] font-semibold text-white hover:bg-ink-800"
          >
            {t.reviewSave}
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={onStart}
        className="flex cursor-pointer items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-[12px] font-semibold text-ink-950 hover:bg-ink-200"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16z" />
        </svg>
        {t.edit}
      </button>
    );
  };

  const rows = (items: [string, ReactNode][]) => (
    <dl className="m-0 flex h-full flex-1 flex-col">
      {items.map(([k, v], i) => {
        const notes = k === t.notes;
        return (
          <div
            key={`${k}-${i}`}
            className={
              notes
                ? "flex flex-col gap-1.5 border-0 border-b border-solid border-ink-150 py-2.5 text-[14px] last:border-b-0"
                : "flex justify-between gap-4 border-0 border-b border-solid border-ink-150 py-2.5 text-[14px] last:border-b-0"
            }
          >
            <dt className="shrink-0 text-ink-500">{k}</dt>
            <dd
              className={
                notes
                  ? "m-0 max-h-28 min-w-0 overflow-y-auto text-left break-words whitespace-pre-wrap [overflow-wrap:anywhere]"
                  : "m-0 min-w-0 text-right wrap-break-word"
              }
            >
              {v}
            </dd>
          </div>
        );
      })}
    </dl>
  );

  const inputClass =
    "w-full rounded-lg border border-solid border-ink-225 bg-white px-3 py-1.5 text-[13px] text-ink-950 focus:border-ink-950 focus:outline-none";

  return (
    <section aria-labelledby="booking-review" className="scroll-mt-6">
      <h2 id="booking-review" ref={headingRef} tabIndex={-1} className="m-0 mb-6 font-serif text-[clamp(32px,4vw,44px)] leading-[1.05] font-normal outline-none">
        {t.reviewTitle}
      </h2>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          {/* Contact Details Card */}
          <section
            aria-label={t.reviewContact}
            className="box-border flex h-full min-w-0 flex-col gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6"
          >
            <div className="flex shrink-0 items-center justify-between gap-3">
              <h3 className="m-0 text-[16px] font-semibold">{t.reviewContact}</h3>
              {renderSectionActions("contact", startEditContact, saveContact)}
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {editingSection === "contact" ? (
                <div className="flex flex-col gap-3 text-[13px]">
                  {!(portal && booker) && (
                    <>
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] text-ink-500">{t.reviewName}</span>
                        <input type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)} className={inputClass} />
                        {formErrors.name && <span className="text-[12px] text-error">{formErrors.name}</span>}
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] text-ink-500">{t.email}</span>
                        <input type="email" inputMode="email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} className={inputClass} />
                        {formErrors.email && <span className="text-[12px] text-error">{formErrors.email}</span>}
                      </label>
                    </>
                  )}
                  <div className="phone-field flex flex-col gap-1 rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5 focus-within:border-ink-950">
                    <span className="text-[12px] text-ink-600">{t.mobile}</span>
                    <span className="flex min-w-0 items-stretch">
                      <CountryCode
                        name="phoneCountry"
                        label={t.phoneCountry}
                        country={draftPhoneCountry}
                        onChange={(next) => {
                          setDraftPhoneCountry(next);
                          setDraftPhone((current) => cleanPhoneInput(current, next));
                        }}
                      />
                      <input
                        type="text"
                        inputMode="tel"
                        autoComplete="tel-national"
                        value={draftPhone}
                        onChange={(e) => setDraftPhone(cleanPhoneInput(e.target.value, draftPhoneCountry.replace(/\D/g, "") || "31"))}
                        className="phone-number min-w-0 flex-1 border-0 bg-transparent py-0 pr-0 pl-3 font-sans text-[16px] font-medium text-ink-950 outline-none"
                      />
                    </span>
                    {formErrors.phone && <span className="text-[12px] text-error">{formErrors.phone}</span>}
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-ink-500">{t.reviewTrip}</span>
                    <select value={draftPurpose} onChange={(e) => setDraftPurpose(e.target.value as DetailsEntry["purpose"])} className={inputClass}>
                      <option value="business">{t.purposeBusiness}</option>
                      <option value="private">{t.purposePrivate}</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-ink-500">{t.reviewPassenger}</span>
                    <select value={draftWho} onChange={(e) => setDraftWho(e.target.value as DetailsEntry["who"])} className={inputClass}>
                      <option value="me">{t.reviewSameAsBooker}</option>
                      <option value="other">{t.whoOther}</option>
                    </select>
                  </label>
                  {draftWho === "other" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] text-ink-500">{t.passengerName}</span>
                        <input
                          type="text"
                          value={draftPassengerName}
                          onChange={(e) => setDraftPassengerName(e.target.value)}
                          className={inputClass}
                        />
                        {formErrors.passenger && <span className="text-[12px] text-error">{formErrors.passenger}</span>}
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] text-ink-500">{t.mobile}</span>
                        <input
                          type="tel"
                          value={draftPassengerPhone}
                          onChange={(e) => setDraftPassengerPhone(e.target.value)}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  )}
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-ink-500">{t.notes}</span>
                    <textarea
                      rows={2}
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                </div>
              ) : (
                rows(contact)
              )}
            </div>
          </section>

          {/* Ride Details Card with SERVICE TYPE segmented toggle */}
          <section
            aria-label={t.reviewRide}
            className="box-border flex h-full min-w-0 flex-col gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6"
          >
            <div className="flex shrink-0 items-center justify-between gap-3">
              <h3 className="m-0 text-[16px] font-semibold">{t.reviewRide}</h3>
              {renderSectionActions("ride", startEditRide, saveRide)}
            </div>

            <div className="w-fit max-w-full self-start border-0 border-b border-solid border-ink-150 pb-3">
              <span className="mb-2 block text-xs uppercase tracking-wider text-slate-400">{t.modeLabel}</span>
              <div role="group" aria-label={t.modeLabel} className="review-mode-track inline-flex w-fit max-w-full rounded-full p-1">
                {(["oneway", "hourly"] as const).map((mode) => {
                  const selected = (editingSection === "ride" ? draftMode : trip.mode) === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={selected}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRideMode(mode);
                      }}
                      className={`review-mode-pill h-[34px] cursor-pointer rounded-full border-0 px-3 text-[12px] sm:px-4 sm:text-[13px] ${selected ? "review-mode-pill-on font-bold" : "review-mode-pill-off font-medium"}`}
                    >
                      {mode === "oneway" ? t.modeOneWay : t.modeHourly}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {editingSection === "ride" ? (
                <div className="flex flex-col gap-3 text-[13px]">
                  <div className="flex flex-col gap-1 rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5 focus-within:border-ink-950">
                    <span className="text-[12px] text-ink-600">{t.reviewPickup}</span>
                    <AddressField
                      id={`${uid}-from`}
                      value={draftFrom}
                      onChange={setDraftFrom}
                      placeholder={t.addressPlaceholder}
                      locale={locale}
                      copy={t}
                      tone="light"
                      excludePlaces={adjacentPlaceTexts({ ...trip, from: draftFrom, to: draftTo, mode: draftMode }, { kind: "from" })}
                      invalid={Boolean(formErrors.from)}
                    />
                    {formErrors.from && <span className="text-[12px] text-error">{formErrors.from}</span>}
                  </div>
                  {draftMode === "oneway" ? (
                    <div className="flex flex-col gap-1 rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5 focus-within:border-ink-950">
                      <span className="text-[12px] text-ink-600">{t.reviewDropoff}</span>
                      <AddressField
                        id={`${uid}-to`}
                        value={draftTo}
                        onChange={setDraftTo}
                        placeholder={t.addressPlaceholder}
                        locale={locale}
                        copy={t}
                        tone="light"
                        excludePlaces={adjacentPlaceTexts({ ...trip, from: draftFrom, to: draftTo, mode: draftMode }, { kind: "to" })}
                        invalid={Boolean(formErrors.to)}
                      />
                      {formErrors.to && <span className="text-[12px] text-error">{formErrors.to}</span>}
                    </div>
                  ) : (
                    <div className="relative flex flex-col gap-1 rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5">
                      <span className="text-[12px] text-ink-600">{t.duration}</span>
                      <button
                        type="button"
                        aria-haspopup="listbox"
                        aria-expanded={hoursOpen}
                        onClick={() => setHoursOpen((open) => !open)}
                        className="flex h-9 cursor-pointer items-center justify-between border-0 bg-transparent p-0 text-left text-[16px] font-medium text-ink-950"
                      >
                        {draftHours === "" ? t.durationPlaceholder : interpolate(t.hoursOption, { hours: draftHours })}
                      </button>
                      {hoursOpen && (
                        <ul role="listbox" aria-label={t.duration} className="absolute top-full left-0 z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-solid border-[#c5d4ff] bg-[#ffffff] p-1 text-[#10224f] shadow-lg">
                          {HOURLY_DURATIONS.map((h) => (
                            <li key={h}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={draftHours === h}
                                onClick={() => {
                                  setDraftHours(h);
                                  setHoursOpen(false);
                                }}
                                className={`w-full cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-[15px] text-[#10224f] ${draftHours === h ? "bg-[#e8eeff] font-semibold" : "bg-[#ffffff]"}`}
                              >
                                {interpolate(t.hoursOption, { hours: h })}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {formErrors.hours && <span className="text-[12px] text-error">{formErrors.hours}</span>}
                    </div>
                  )}
                  {draftMode === "oneway" && (
                    <div className="flex flex-col gap-2">
                      {draftStops.map((stop, index) => (
                        <div key={index} className="flex flex-col gap-1 rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5">
                          <span className="flex items-center justify-between gap-2 text-[12px] text-ink-600">
                            {interpolate(t.stopLabel, { number: index + 1 })}
                            <button
                              type="button"
                              onClick={() => setDraftStops((current) => current.filter((_, j) => j !== index))}
                              className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold text-ink-700"
                            >
                              {interpolate(t.removeStop, { number: index + 1 })}
                            </button>
                          </span>
                          <AddressField
                            id={`${uid}-stop-${index}`}
                            value={{ text: stop.place, id: null, kind: null }}
                            onChange={(place) => setDraftStops((current) => current.map((item, j) => (j === index ? { ...item, place: place.text } : item)))}
                            placeholder={t.addressPlaceholder}
                            locale={locale}
                            copy={t}
                            tone="light"
                            excludePlaces={adjacentPlaceTexts({ ...trip, from: draftFrom, to: draftTo, stops: draftStops, mode: draftMode }, { kind: "stop", index })}
                          />
                        </div>
                      ))}
                      {draftStops.length < MAX_STOPS && (
                        <button
                          type="button"
                          onClick={() => setDraftStops((current) => [...current, { place: "", wait: 0 }])}
                          className="inline-flex h-9 w-fit cursor-pointer items-center rounded-full border border-solid border-ink-225 bg-white px-3 text-[13px] font-semibold text-ink-950"
                        >
                          {t.addStop}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="review-when relative flex flex-col gap-1 rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5">
                    <label htmlFor={`${uid}-at`} className="text-[12px] text-ink-600">{t.summaryWhen}</label>
                    <DateTimeField
                      id={`${uid}-at`}
                      locale={locale}
                      copy={dateTimeCopy}
                      defaultValue={draftAt}
                      onValueChange={setDraftAt}
                      invalid={Boolean(formErrors.at)}
                      tone="light"
                      size="md"
                      appearance="site"
                      className="review-when-input border-0 bg-transparent shadow-none ring-0 outline-none appearance-none"
                    />
                    {formErrors.at && <span className="text-[12px] text-error">{formErrors.at}</span>}
                  </div>
                  <div className="relative rounded-xl border border-solid border-ink-225 bg-white px-3.5 py-2.5">
                    <span id={`${uid}-guests-label`} className="mb-1 block text-[12px] text-ink-600">{t.guests}</span>
                    <GuestsPicker
                      id={`${uid}-guests`}
                      labelledBy={`${uid}-guests-label`}
                      pax={draftPax}
                      bags={draftBags}
                      small={draftSmall}
                      set
                      onChange={(next) => {
                        setDraftPax(next.pax);
                        setDraftBags(next.bags);
                        setDraftSmall(next.small);
                      }}
                      copy={t}
                      tone="light"
                      appearance="site"
                    />
                  </div>
                </div>
              ) : (
                rows(ride)
              )}
            </div>
          </section>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {/* Vehicle Card */}
          <section
            aria-label={t.reviewVehicle}
            className="box-border flex h-full min-w-0 flex-col justify-between gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6"
          >
            <div className="flex shrink-0 items-center justify-between gap-3">
              <h3 className="m-0 text-[16px] font-semibold">{t.reviewVehicle}</h3>
              {renderSectionActions("vehicle", startEditVehicle, saveVehicle)}
            </div>

            {editingSection === "vehicle" ? (
              <div className="flex max-h-[28rem] flex-1 flex-col gap-2 overflow-y-auto">
                <button
                  type="button"
                  aria-pressed={trip.cars.length === 0}
                  onClick={() => setVehicleCount("advise", 0)}
                  className={`cursor-pointer rounded-xl border border-solid px-3 py-2.5 text-left text-[14px] font-semibold ${trip.cars.length === 0 ? "border-ink-950 bg-ink-950 text-white" : "border-ink-225 bg-white text-ink-950"}`}
                >
                  {vehicleAdvise}
                </button>
                <div className="grid grid-cols-2 gap-2">
                {vehicles.map((item) => {
                  const count = trip.cars.find((car) => car.key === item.key)?.count ?? 0;
                  const selected = count > 0;
                  return (
                    <div key={item.key} className={`rounded-xl border border-solid p-2 ${selected ? "border-2 border-ink-950" : "border-ink-225"}`}>
                      <button type="button" aria-pressed={selected} onClick={() => setVehicleCount(item.key, selected ? 0 : 1)} className="flex w-full cursor-pointer flex-col gap-2 border-0 bg-transparent p-1 text-left">
                        {item.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.images[0]} alt="" className="aspect-[16/10] w-full rounded-lg object-cover" />
                        ) : (
                          <span className="block aspect-[16/10] w-full rounded-lg bg-ink-100" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold text-ink-950">{item.name}</span>
                          <span className="text-[12px] font-medium text-ink-600">{selected ? t.carSelected : t.carSelect}</span>
                        </span>
                      </button>
                      {selected && (
                        <span className="mt-1 flex h-10 items-center justify-end gap-2 px-1">
                          <button type="button" aria-label={interpolate(t.fewerOf, { car: item.name })} onClick={() => setVehicleCount(item.key, count - 1)} className="grid size-8 cursor-pointer place-items-center rounded-full border border-solid border-ink-225 bg-white text-ink-950">−</button>
                          <output className="w-6 text-center text-[15px] font-semibold tabular-nums">{count}</output>
                          <button type="button" aria-label={interpolate(t.moreOf, { car: item.name })} disabled={count >= MAX_PER_CAR} onClick={() => setVehicleCount(item.key, count + 1)} className="grid size-8 cursor-pointer place-items-center rounded-full border border-solid border-ink-225 bg-white text-ink-950 disabled:cursor-not-allowed disabled:opacity-40">+</button>
                        </span>
                      )}
                    </div>
                  );
                })}
                </div>
                {formErrors.vehicle && <span className="text-[12px] text-error">{formErrors.vehicle}</span>}
              </div>
            ) : (
              <>
                {mix.length > 0 ? (
                  <div className="min-h-0 flex-1">
                    <CarMixPreview cars={mix} copy={gallery} />
                  </div>
                ) : photos.length > 0 ? (
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[12px] bg-ink-100">
                    <VehicleGallery key={photos.join("|")} name={name} images={photos} alt={name} copy={gallery} fit="contain" />
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
              </>
            )}
          </section>

          {/* Price Card */}
          <section
            aria-label={t.reviewPrice}
            className="box-border flex h-full min-w-0 flex-col justify-between gap-3 rounded-[20px] border border-solid border-ink-150 bg-white p-5 text-ink-950 md:p-6"
          >
            <h3 className="m-0 shrink-0 text-[16px] font-semibold">{t.reviewPrice}</h3>
            <div className="flex min-h-0 flex-1 flex-col justify-between">
              <PriceBreakdown
                price={price}
                names={addOns}
                pending={estimate === "pending"}
                hourly={trip.mode === "hourly"}
                timed={Boolean(estimate && estimate !== "pending")}
                copy={t}
                locale={locale}
              />
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
                  {payPlan && payPlan !== "C" ? ` ${t.payConsent}` : ""}
                </span>
              </label>
              {payPlan && upfront != null && (
                <div className="mt-2 flex flex-col gap-1 pl-[26px] text-[12.5px] leading-snug text-ink-700">
                  <p className="m-0">
                    {payPlan === "C"
                      ? interpolate(t.payNowFull, { amount: formatCents(upfront, locale) })
                      : interpolate(t.payNowFee, {
                          amount: formatCents(upfront, locale),
                          rest: formatCents(restCents, locale),
                          date: restOn ? longDate(restOn) : "",
                        })}
                  </p>
                  <p className="m-0">{timing?.autoConfirmed ? t.payAutoApproved : t.payReviewed}</p>
                </div>
              )}
              {mustAgree && (
                <span id={`${uid}-agree-error`} className="mt-1 block pl-[26px] text-[12px] text-error">
                  {t.reviewAgreeRequired}
                </span>
              )}
            </div>
          </section>
        </div>

        {sentPayment && (
          <div className="flex flex-col gap-1 rounded-lg border border-solid border-ink-225 bg-white px-4 py-3 text-ink-950">
            {referenceOk ? <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase">{reference}</p> : null}
            <p className="m-0 text-[15px] font-semibold">{payLabel(payStatus, t)}</p>
            {upfront != null ? <p className="m-0 text-[14px] tabular-nums">{formatCents(upfront, locale)}</p> : null}
          </div>
        )}
        <p aria-live="polite" className={result.message || payError || (sentPayment?.popupBlocked && !paid) ? "m-0 text-[13px] text-error" : "sr-only"}>
          {result.message ?? payError ?? (sentPayment?.popupBlocked && !paid ? t.payLiveBlocked : !paid && sentPayment && !checkoutUrl ? t.payLiveMissing : "")}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-4">
          <div className="flex w-full gap-2.5 lg:w-auto">
            <button
              type="button"
              onClick={() => onEdit("details")}
              className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-solid border-ink-225 bg-white px-4 text-[13px] font-semibold tracking-wide text-ink-950 hover:border-ink-950"
            >
              <ArrowLeft />
              {t.back}
            </button>
            {lockedNotice ??
              (sentPayment ? (
                <>
                {paid ? (
                  <button
                    type="button"
                    disabled={!referenceOk}
                    onClick={() => openReviewReceipt(reference, locale, t.payLivePaid)}
                    className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                  >
                    {savedReceipt(reference) ? t.payLiveReceipt : t.payLivePaid}
                  </button>
                ) : checkoutUrl ? (
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white no-underline hover:bg-ink-800 sm:flex-none">
                    {t.payLiveNow}
                  </a>
                ) : (
                  <button type="button" disabled className="inline-flex h-11 flex-1 cursor-not-allowed items-center justify-center rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white opacity-60 sm:flex-none">
                    {t.payLiveNow}
                  </button>
                )}
                {!paid && (
                  <button
                    type="button"
                    disabled={checking}
                    onClick={() => lookUpPayment.current()}
                    className="inline-flex h-11 cursor-pointer items-center justify-center rounded-lg border border-solid border-ink-225 bg-white px-4 text-[13px] font-semibold tracking-wide text-ink-950 hover:border-ink-950 disabled:cursor-progress disabled:opacity-70"
                  >
                    {checking ? t.payLiveChecking : t.payLiveCheck}
                  </button>
                )}
                </>
              ) : (
              <button
                type="button"
                disabled={result.pending}
                onClick={() => {
                  if (!agreed) {
                    setMustAgree(true);
                    document.getElementById(`${uid}-agree`)?.focus();
                    return;
                  }
                  onSend(price, payPlan && price ? { plan: payPlan, totalCents: price.total, payNow: Boolean(timing?.autoConfirmed) } : null);
                }}
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-ink-950 px-5 text-[13px] font-semibold tracking-wide text-white hover:bg-ink-800 disabled:cursor-progress disabled:opacity-70 sm:flex-none"
              >
                {result.pending ? t.sending : timing?.autoConfirmed && upfront != null ? interpolate(t.submitPay, { amount: formatCents(upfront, locale) }) : t.submit}
                {!result.pending && <ArrowRight />}
              </button>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}