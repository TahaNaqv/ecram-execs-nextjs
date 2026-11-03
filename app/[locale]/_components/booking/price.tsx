"use client";

import type { ReactNode } from "react";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { carsToPrice } from "@/lib/pricing/booking";
import { formatCents, priceBooking, withVat, type DayKind, type Price, type Segment } from "@/lib/pricing/rates";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import type { BookingCopy } from "./copy";
import { pretty } from "./parts";
import type { Trip } from "./trip";

/** The website shows its prices with VAT (Dutch consumer pricing rules); the portal shows a business's prices before VAT. */
export const segmentOf = (variant: "public" | "portal"): Segment => (variant === "portal" ? "corporate" : "public");
/** An amount as the segment reads it: with VAT for the public, before VAT for a corporate partner. */
export const shown = (cents: number, segment: Segment) => (segment === "public" ? withVat(cents) : cents);

export const dayLabel = (t: BookingCopy, day: DayKind) => (day === "sunday" ? t.rateSunday : day === "saturday" ? t.rateSaturday : t.rateWeekday);

/** The trip's price by the rate card, as the server will work it out (lib/pricing/quote.ts), from the drive time the review fetched. */
export function tripPrice(trip: Trip, segment: Segment, driveSeconds: number | null): (Price & { suggested: boolean }) | null {
  if (!trip.at) return null;
  const { cars, suggested } = carsToPrice({ vehicles: trip.cars, vehicle: trip.vehicle, passengers: trip.pax, luggage: trip.bags });
  const hourly = trip.mode === "hourly";
  const stops = trip.stops.filter((s) => s.place.trim());
  const price = priceBooking({
    segment,
    pickupAt: trip.at,
    returnAt: trip.ret || null,
    hours: hourly && trip.hours !== "" ? trip.hours : null,
    driveSeconds: hourly ? null : driveSeconds,
    waitMinutes: hourly ? 0 : stops.reduce((sum, s) => sum + s.wait, 0),
    cars,
    suggested,
  });
  return price ? { ...price, suggested } : null;
}

const hoursText = (hours: number, locale: Locale) => new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 }).format(hours);

/** The price on the review step: each car on each leg, the service fee, VAT and the total, with what the figure rests on. */
export function PriceBreakdown({
  price,
  pending,
  hourly,
  timed,
  segment,
  copy: t,
  locale,
}: {
  price: (Price & { suggested: boolean }) | null;
  pending: boolean;
  hourly: boolean;
  /** Whether Google timed the drive (a transfer's hours rest on it) */
  timed: boolean;
  segment: Segment;
  copy: BookingCopy;
  locale: Locale;
}) {
  const euro = (cents: number) => formatCents(cents, locale);
  if (pending) return <p className="m-0 text-[14px] text-ink-500">{t.pricePending}</p>;
  if (!price) return <p className="m-0 text-[14px] text-ink-700">{t.reviewPriceNote}</p>;

  const publicPrice = segment === "public";
  const row = (key: string, label: ReactNode, value: ReactNode, strong = false) => (
    <div key={key} className={`flex justify-between gap-4 py-2 text-[14px] ${strong ? "border-0 border-t border-solid border-ink-150 pt-3 text-[16px] font-semibold" : ""}`}>
      <dt className={`min-w-0 ${strong ? "" : "text-ink-600"}`}>{label}</dt>
      <dd className="m-0 shrink-0 text-right tabular-nums">{value}</dd>
    </div>
  );
  const legs = price.legs.length > 1;
  const untimed = !hourly && !timed;
  const notes = [!hourly && t.priceHoursNote, untimed && t.priceUntimed, price.suggested && t.priceSuggested, t.priceConfirm].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-3">
      <dl className="m-0 flex flex-col">
        {price.legs.flatMap((leg) => [
          ...(legs ? [<div key={`${leg.leg}-head`} className="pt-2 text-[12px] font-semibold tracking-[0.08em] text-ink-500 uppercase">{interpolate(leg.leg === "return" ? t.priceReturn : t.priceOutward, { date: pretty(leg.at, locale) })}</div>] : []),
          ...leg.lines.map((line) =>
            row(
              `${leg.leg}-${line.key}`,
              <span className="flex flex-col">
                <span className="text-ink-950">{`${line.count} × ${vehicleByKey(line.key)?.name ?? line.key}`}</span>
                <span className="text-[12px]">{interpolate(t.priceLineHours, { hours: hoursText(leg.hours, locale), rate: euro(shown(line.rate, segment)) })}</span>
              </span>,
              euro(publicPrice ? line.gross : line.amount),
            ),
          ),
        ])}
        {row("fee", t.priceServiceFee, euro(publicPrice ? price.feeGross : price.fee))}
        {publicPrice ? null : row("vat", t.priceVat, euro(price.vat))}
        {row("total", publicPrice ? t.priceTotal : t.priceTotalExVat, price.exact ? euro(price.total) : interpolate(t.priceFrom, { price: euro(price.total) }), true)}
        {publicPrice && row("vat", t.priceVatIncluded, euro(price.vat))}
      </dl>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12px] leading-snug text-ink-600">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}
