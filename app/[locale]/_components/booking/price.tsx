"use client";

import type { ReactNode } from "react";
import { vehicleByKey } from "@/lib/fleet/vehicles";
import { carsToPrice } from "@/lib/pricing/booking";
import { formatCents, hasHighRateExtras, priceBooking, vatByRate, type DayKind, type Price, type Segment } from "@/lib/pricing/rates";
import { extraName } from "@/lib/pricing/extras";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import type { AddOnsCopy, BookingCopy } from "./copy";
import { pretty } from "./parts";
import type { Trip } from "./trip";

/** The website's bookings are at the standard rates, the portal's at the corporate rates. */
export const segmentOf = (variant: "public" | "portal"): Segment => (variant === "portal" ? "corporate" : "public");

export const dayLabel = (t: BookingCopy, day: DayKind) => (day === "sunday" ? t.rateSunday : day === "saturday" ? t.rateSaturday : t.rateWeekday);

/** Minutes the chauffeur waits at the trip's stops (a stop left blank is not sent, nor is its wait). */
export const tripWaitMinutes = (trip: Trip) => (trip.mode === "hourly" ? 0 : trip.stops.filter((s) => s.place.trim()).reduce((sum, s) => sum + s.wait, 0));

/** The trip's price by the rate card, as the server will work it out (lib/pricing/quote.ts), from the drive time the review fetched. */
export function tripPrice(trip: Trip, segment: Segment, driveSeconds: number | null): (Price & { suggested: boolean }) | null {
  if (!trip.at) return null;
  const { cars, suggested } = carsToPrice({ vehicles: trip.cars, vehicle: trip.vehicle, passengers: trip.pax, luggage: trip.bags });
  const hourly = trip.mode === "hourly";
  const price = priceBooking({
    segment,
    pickupAt: trip.at,
    hours: hourly && trip.hours !== "" ? trip.hours : null,
    driveSeconds: hourly ? null : driveSeconds,
    waitMinutes: hourly ? 0 : tripWaitMinutes(trip),
    cars,
    suggested,
    extras: trip.extras,
  });
  return price ? { ...price, suggested } : null;
}

/** The price on the review step: each car on each leg, the service fee, VAT and the total, with what the figure rests on. */
export function PriceBreakdown({
  price,
  names,
  pending,
  hourly,
  timed,
  copy: t,
  locale,
}: {
  price: (Price & { suggested: boolean }) | null;
  /** The add-ons' names */
  names: AddOnsCopy;
  pending: boolean;
  hourly: boolean;
  /** Whether Google timed the drive (a transfer's hours rest on it) */
  timed: boolean;
  copy: BookingCopy;
  locale: Locale;
}) {
  const euro = (cents: number) => formatCents(cents, locale);
  if (pending) return <p className="m-0 text-[14px] text-ink-500">{t.pricePending}</p>;
  if (!price) return <p className="m-0 text-[14px] text-ink-700">{t.reviewPriceNote}</p>;

  const row = (key: string, label: ReactNode, value: ReactNode, strong = false) => (
    <div key={key} className={`flex justify-between gap-4 py-2 text-[14px] ${strong ? "border-0 border-t border-solid border-ink-150 pt-3 text-[16px] font-semibold" : ""}`}>
      <dt className={`min-w-0 ${strong ? "" : "text-ink-600"}`}>{label}</dt>
      <dd className="m-0 shrink-0 text-right tabular-nums">{value}</dd>
    </div>
  );
  const legs = price.legs.length > 1;
  // VAT as an invoice groups it: flowers with the rides at 9%, the other add-ons with the service fee at 21%
  const vat = vatByRate(price);

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
                <span className="text-[12px]">{interpolate(t.priceLineHours, { hours: leg.hours, rate: euro(line.rate) })}</span>
              </span>,
              euro(line.amount),
            ),
          ),
        ])}
        {(price.extras ?? []).map((line) =>
          row(
            `extra-${line.key}`,
            <span className="flex flex-col">
              <span className="text-ink-950">{extraName(names, line)}</span>
              <span className="text-[12px]">{`${line.count} × ${euro(line.unit)}`}</span>
            </span>,
            euro(line.amount),
          ),
        )}
        {row("vat", t.priceVat, euro(vat.low))}
        {row("fee", t.priceServiceFee, euro(price.fee))}
        {vat.high ? row("feeVat", hasHighRateExtras(price) ? t.priceVatHigh : t.priceFeeVat, euro(vat.high)) : null}
        {row("total", t.priceTotal, price.exact ? euro(price.total) : interpolate(t.priceFrom, { price: euro(price.total) }), true)}
      </dl>
    </div>
  );
}