import { normalizeVehicleKey, type VehicleKey } from "../fleet/vehicles.ts";
import { priceExtras, type ExtraLine, type ExtraPick } from "./extras.ts";

/**
 * The client's 2027 rate card (sent 8 Nov 2026, in use from then), as data. Every booking is billed by the hour per car, at a
 * rate that depends on the car, on whether the booker is a corporate partner, and on the day of the week, in whole hours
 * and at least two. Each billed hour includes a number of kilometres per car; a transfer that drives further pays the
 * kilometres beyond that, per car. At the end 9% VAT is added to the rides (hours and kilometres), then the €12.50 service
 * fee, once per booking, with 21% VAT of its own. Add-ons (lib/pricing/extras.ts) are added at their own prices, each with
 * its own VAT.
 *
 * Read by the booking flow in the browser and by the server, which works the price out again when a booking is sent and
 * stores it: nothing here may import server-only code. Amounts are whole euro cents throughout.
 */
export const RATE_CARD_VERSION = "2027-01";

export type Segment = "corporate" | "public";
export type DayKind = "weekday" | "saturday" | "sunday";

/** Euro cents per hour, per car (the 2027 card prices each model on its own). */
const RATES: Record<VehicleKey, Record<Segment, Record<DayKind, number>>> = {
  hongqi_e_hs9: {
    corporate: { weekday: 7500, saturday: 9375, sunday: 11719 },
    public: { weekday: 9000, saturday: 11250, sunday: 14063 },
  },
  audi: {
    corporate: { weekday: 8000, saturday: 10000, sunday: 12500 },
    public: { weekday: 9500, saturday: 11875, sunday: 14844 },
  },
  mercedes_vle_300: {
    corporate: { weekday: 8500, saturday: 9500, sunday: 10000 },
    public: { weekday: 10000, saturday: 11000, sunday: 11500 },
  },
  range_rover: {
    corporate: { weekday: 10000, saturday: 12500, sunday: 15625 },
    public: { weekday: 12000, saturday: 15000, sunday: 18750 },
  },
  cadillac_escalade: {
    corporate: { weekday: 10500, saturday: 13125, sunday: 16406 },
    public: { weekday: 12500, saturday: 15625, sunday: 19531 },
  },
};

/** Kilometres each billed hour includes, per car (the 2027 card's kilometre allowance). */
const KM_PER_HOUR: Record<VehicleKey, number> = {
  hongqi_e_hs9: 45,
  audi: 45,
  mercedes_vle_300: 40,
  range_rover: 35,
  cadillac_escalade: 35,
};

/** Euro cents per kilometre beyond the allowance, the same for every car. */
const EXTRA_KM_RATE: Record<Segment, number> = { corporate: 150, public: 175 };

/** The fewest hours a booking is billed for: a 45-minute ride is billed as two hours. */
export const MIN_HOURS = 2;
/** Dutch VAT on passenger transport (the low rate), on the rides. */
export const VAT_RATE = 0.09;
/** Added once to every booking, after the rides' VAT, as the client's rate card works it out. */
export const SERVICE_FEE_CENTS = 1250;
/** The service fee is not transport, so it carries the high rate (the client's accountant, 4 Nov 2026): €12.50 + €2.63. */
export const SERVICE_FEE_VAT_RATE = 0.21;

const WALL_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Which column of the rate card a Dutch wall-clock pick-up ("2026-11-14T08:30", or the database's "2026-11-14 08:30:00") falls in. */
export function dayKind(wall: string): DayKind | null {
  const m = WALL_DATE.exec(wall);
  if (!m) return null;
  const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return day === 0 ? "sunday" : day === 6 ? "saturday" : "weekday";
}

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;
const KINDS: DayKind[] = ["sunday", "weekday", "weekday", "weekday", "weekday", "weekday", "saturday"];

/**
 * A leg's billed hours by rate-card day. Each hour is billed at the rate of the day it starts on (the client, 7 Nov 2026):
 * six hours from Friday 22:11 are two weekday hours and four Saturday hours, and a Saturday that runs past midnight
 * goes on at Sunday's rate. Worked on the Dutch wall clock the booking was made in. A pick-up without a time is one day.
 */
export function hoursByDay(at: string, hours: number): { day: DayKind; hours: number }[] {
  const m = WALL_TIME.exec(at);
  const first = dayKind(at);
  if (!first) return [];
  if (!m) return [{ day: first, hours }];
  const start = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const parts: { day: DayKind; hours: number }[] = [];
  for (let i = 0; i < hours; i++) {
    const day = KINDS[new Date(start + i * 3_600_000).getUTCDay()];
    const last = parts[parts.length - 1];
    if (last && last.day === day) last.hours += 1;
    else parts.push({ day, hours: 1 });
  }
  return parts;
}

/** The hourly rate of one car, or null for a car the rate card does not list. */
export function hourlyRate(key: string, segment: Segment, day: DayKind): number | null {
  const vehicle = normalizeVehicleKey(key);
  return vehicle ? RATES[vehicle][segment][day] : null;
}

/** The kilometres one car's billed hour includes, or null for a car the rate card does not list. */
export function kmPerHour(key: string): number | null {
  const vehicle = normalizeVehicleKey(key);
  return vehicle ? KM_PER_HOUR[vehicle] : null;
}

/** Euro cents per kilometre beyond the allowance. */
export const extraKmRate = (segment: Segment) => EXTRA_KM_RATE[segment];

/**
 * Whole hours billed for one leg, at least `MIN_HOURS`. An hourly booking is billed for the hours booked. A transfer is
 * billed for the drive Google expects (without traffic) plus the chauffeur's waits at the stops, rounded up to the hour:
 * waiting is time on the clock, with no charge of its own. Null when a transfer's drive is not known.
 */
export function billedHours(leg: { hours?: number | null; driveSeconds?: number | null; waitMinutes?: number }): number | null {
  if (leg.hours && leg.hours > 0) return Math.max(MIN_HOURS, Math.ceil(leg.hours));
  if (!leg.driveSeconds || !Number.isFinite(leg.driveSeconds) || leg.driveSeconds <= 0) return null;
  return Math.max(MIN_HOURS, Math.ceil((leg.driveSeconds / 60 + (leg.waitMinutes ?? 0)) / 60));
}

/**
 * `rate` and `amount` before VAT. `day` and `hours` say which part of the leg the line bills: a leg that runs into the
 * weekend has a line per car per rate. Missing on prices stored before 7 Nov 2026, when the whole leg had one rate:
 * read them as the leg's own day and hours.
 */
export type PriceLine = { key: VehicleKey; count: number; rate: number; amount: number; day?: DayKind; hours?: number };
/**
 * The kilometres beyond one car's allowance on a leg (the 2027 card): `included` is hours × the car's kilometres per hour,
 * `extra` what the leg drives beyond it, per car; `amount` is extra × rate × count, before VAT.
 */
export type KmLine = { key: VehicleKey; count: number; included: number; extra: number; rate: number; amount: number };
/**
 * `day` is the pick-up's day; the lines carry the rate of each day the leg runs into. `km` is the leg's distance and, per car
 * that drives beyond its allowance, a line; missing on prices stored before 8 Nov 2026, on hourly bookings (their distance
 * is not known until the trip is done), and when the distance could not be told.
 */
export type PriceLeg = { leg: "outward" | "return"; at: string; day: DayKind; hours: number; lines: PriceLine[]; km?: { distance: number; lines: KmLine[] } };
export type Price = {
  version: string;
  segment: Segment;
  legs: PriceLeg[];
  /** The rides, hours × rate, before VAT */
  rides: number;
  /** 9% of the rides */
  vat: number;
  /** The service fee, added last, before its VAT */
  fee: number;
  /** 21% of the service fee. Missing on prices stored before 4 Nov 2026, when the fee carried no VAT. */
  feeVat?: number;
  /** The add-ons chosen, each before and with its VAT. Missing on prices stored before add-ons (5 Nov 2026), and when there are none. */
  extras?: ExtraLine[];
  /** The add-ons' VAT, all rates together (each line has its own). */
  extrasVat?: number;
  /** What the booking costs: rides + their VAT + service fee + its VAT + add-ons + their VAT. Paid when booked (website) or invoiced (corporate partners). */
  total: number;
  /**
   * What the visitor chose on the form: Business travel or a Private occasion.
   * An airport trip and an hourly booking are still one of these two. Missing on prices stored before this was kept.
   */
  purpose?: "business" | "private";
  /**
   * False when the price is a lower bound: the drive could not be timed (so only the minimum hours are counted), or the
   * team is choosing the car (so the car we would suggest is counted). The flow then says "from".
   */
  exact: boolean;
  /**
   * The transfer's distance and drive, as Google reported them when the price was worked out.
   * Missing on prices stored before this was kept, and on hourly bookings, whose distance is not known until the trip is done.
   */
  distanceMeters?: number;
  driveSeconds?: number;
};

export type PriceInput = {
  segment: Segment;
  /** Pick-up, Dutch wall clock */
  pickupAt: string;
  /** The return journey's pick-up, when there is one; billed for the same hours as the outward journey */
  returnAt?: string | null;
  /** Hours of an hourly booking */
  hours?: number | null;
  /** A transfer's drive without traffic, from Google; null when it could not be told */
  driveSeconds?: number | null;
  /** Minutes the chauffeur waits at the stops on the way, billed as part of the hours */
  waitMinutes?: number;
  /** A transfer's distance, stops included, from Google; null when it could not be told. Not used for hourly bookings. */
  distanceMeters?: number | null;
  /** The cars, with how many of each */
  cars: { key: string; count: number }[];
  /** The cars are our suggestion, not the visitor's choice */
  suggested?: boolean;
  /** The add-ons chosen */
  extras?: ExtraPick[];
};

/** The price of a booking by the rate card; null when it cannot be priced (no date, or no car the card lists). */
export function priceBooking(input: PriceInput): Price | null {
  const timed = billedHours({ hours: input.hours, driveSeconds: input.driveSeconds, waitMinutes: input.waitMinutes });
  // Not timed: the least it can be, the waits alone (and never under the minimum)
  const hours = timed ?? Math.max(MIN_HOURS, Math.ceil((input.waitMinutes ?? 0) / 60));
  // A transfer drives a known distance; each car's hours include some of it, and the rest is paid by the kilometre. The
  // return journey drives it again. An hourly booking's distance is only known once it is done.
  const hourly = Boolean(input.hours && input.hours > 0);
  const distance = !hourly && input.distanceMeters && Number.isFinite(input.distanceMeters) && input.distanceMeters > 0 ? Math.round(input.distanceMeters / 1000) : null;
  const km = distance === null ? null : { distance, lines: kmLines(input.cars, hours, distance, input.segment) };
  const legs: PriceLeg[] = [];
  for (const [leg, at] of [["outward", input.pickupAt], ["return", input.returnAt]] as const) {
    if (!at) continue;
    const day = dayKind(at);
    if (!day) return null;
    const parts = hoursByDay(at, hours);
    const lines: PriceLine[] = [];
    for (const car of input.cars) {
      const key = normalizeVehicleKey(car.key);
      if (!key || !Number.isInteger(car.count) || car.count < 1) continue;
      for (const part of parts) {
        const rate = hourlyRate(key, input.segment, part.day);
        if (rate === null) continue;
        lines.push({ key, count: car.count, rate, amount: rate * part.hours * car.count, day: part.day, hours: part.hours });
      }
    }
    if (lines.length === 0) return null;
    legs.push({ leg, at, day, hours, lines, ...(km ? { km } : {}) });
  }
  if (legs.length === 0) return null;
  const rides = legs.reduce((sum, leg) => sum + leg.lines.reduce((n, line) => n + line.amount, 0) + (leg.km?.lines ?? []).reduce((n, line) => n + line.amount, 0), 0);
  // The client's order: the rides, then 9% VAT on them, then the service fee
  const vat = Math.round(rides * VAT_RATE);
  const fee = SERVICE_FEE_CENTS;
  const feeVat = Math.round(fee * SERVICE_FEE_VAT_RATE);
  const extras = priceExtras(input.extras ?? []);
  const extrasNet = extras.reduce((sum, line) => sum + line.amount, 0);
  const extrasVat = extras.reduce((sum, line) => sum + line.vat, 0);
  return {
    version: RATE_CARD_VERSION,
    segment: input.segment,
    legs,
    rides,
    vat,
    fee,
    feeVat,
    ...(extras.length > 0 ? { extras, extrasVat } : {}),
    total: rides + vat + fee + feeVat + extrasNet + extrasVat,
    // A timed transfer whose distance is not known may still owe kilometres: then it is a lower bound too
    exact: timed !== null && !input.suggested && (hourly || distance !== null),
    // Kept so a later ride-details card can show the same distance and time the price was based on
    ...(!hourly && input.distanceMeters && Number.isFinite(input.distanceMeters) && input.distanceMeters > 0 ? { distanceMeters: input.distanceMeters } : {}),
    ...(!hourly && input.driveSeconds && Number.isFinite(input.driveSeconds) && input.driveSeconds > 0 ? { driveSeconds: input.driveSeconds } : {}),
  };
}

/** Per car that drives beyond its allowance on one leg: the kilometres included, the extra, and what they cost. */
function kmLines(cars: PriceInput["cars"], hours: number, distance: number, segment: Segment): KmLine[] {
  const lines: KmLine[] = [];
  for (const car of cars) {
    const key = normalizeVehicleKey(car.key);
    const perHour = key ? KM_PER_HOUR[key] : null;
    if (!key || perHour == null || !Number.isInteger(car.count) || car.count < 1) continue;
    const included = hours * perHour;
    const extra = Math.max(0, distance - included);
    if (extra === 0) continue;
    const rate = EXTRA_KM_RATE[segment];
    lines.push({ key, count: car.count, included, extra, rate, amount: extra * rate * car.count });
  }
  return lines;
}

/** A stored price before any VAT: the rides, the service fee and the add-ons. */
export function priceNet(p: Price): number {
  return p.total - p.vat - (p.feeVat ?? 0) - (p.extrasVat ?? 0);
}

/** The price's VAT by rate, as an invoice shows it: 9% on the rides (and flowers), 21% on the service fee and the other add-ons. */
const extraLines = (p: { extras?: unknown } | null | undefined): { vatRate?: number; vat?: unknown }[] =>
  (Array.isArray(p?.extras) ? p.extras : []).filter((line): line is { vatRate?: number; vat?: unknown } => !!line && typeof line === "object");

export function vatByRate(p: Price): { low: number; high: number } {
  // Flowers are the add-on at the low rate; every other add-on's VAT is counted with the service fee's, so none is left out
  const low = extraLines(p).filter((line) => line.vatRate === VAT_RATE).reduce((sum, line) => sum + (centsOf(line.vat) ?? 0), 0);
  return { low: (centsOf(p?.vat) ?? 0) + low, high: (centsOf(p?.feeVat) ?? 0) + (centsOf(p?.extrasVat) ?? 0) - low };
}

/** Whether any add-on carries the high rate, so the 21% line is not the service fee's alone. */
export const hasHighRateExtras = (p: Price) => extraLines(p).some((line) => line.vatRate === SERVICE_FEE_VAT_RATE);

/** Whole euro cents from a stored amount. JSON sometimes returns the cents as a numeric string; both are the same number. */
export function centsOf(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const amount = Number(value);
    if (Number.isFinite(amount)) return amount;
  }
  return null;
}

/**
 * The rate-card total saved with a booking, as a two-decimal euro string. This is the amount the visitor confirmed
 * (rides, 9% VAT, service fee and its VAT, and any add-ons with their VAT). Null when that snapshot was not stored. It is not worked out again.
 */
export function storedQuoteEuros(price: { total?: unknown } | null | undefined): string | null {
  const cents = centsOf(price?.total);
  if (cents == null) return null;
  return (cents / 100).toFixed(2);
}

/**
 * The one amount every confirmation, booking row and dashboard total uses.
 * The amount stored on the booking wins: it is seeded from the rate-card total (rides, VAT, service fee and add-ons)
 * and later holds a final the team has overridden. The snapshot total is used only when that amount was never stored,
 * so a row, a PDF and a dashboard card cannot each pick a different figure, and nobody adds the rate-card lines up again.
 */
export function bookingTotalEuros(request: {
  priceEstimate?: { total?: unknown } | null;
  quotedAmount?: string | number | null;
}): string | null {
  if (request.quotedAmount != null && request.quotedAmount !== "") {
    const amount = Number(request.quotedAmount);
    if (Number.isFinite(amount)) return amount.toFixed(2);
  }
  return storedQuoteEuros(request.priceEstimate);
}

/** A line's own day and hours, or its leg's on a price stored before lines carried them. */
export const lineDay = (leg: PriceLeg, line: PriceLine): { day: DayKind; hours: number } => ({
  day: line?.day ?? leg?.day ?? "weekday",
  hours: line?.hours ?? leg?.hours ?? 0,
});

/** Whether a leg is billed at more than one day's rate. */
export const legSpansDays = (leg: PriceLeg) => new Set((Array.isArray(leg?.lines) ? leg.lines : []).map((l) => lineDay(leg, l).day)).size > 1;

/**
 * Dutch euros for every amount a person reads: `€ 316,61`.
 * The same helper is used on the website, in emails, on receipts and in the admin panel,
 * so a figure never changes shape between those surfaces.
 */
export function formatCurrency(amount: number): string {
  const value = Number(amount);
  const rounded = Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

/** Cents as Dutch euros. `locale` stays so existing callers compile; the figure itself is always nl-NL / EUR. */
export function formatCents(cents: number, locale: string): string {
  void locale;
  return formatCurrency(cents / 100);
}
