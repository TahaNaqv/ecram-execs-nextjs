import { normalizeVehicleKey, type VehicleKey } from "../fleet/vehicles.ts";

/**
 * The client's rate card (November 2026), as data. Every booking is billed by the hour per car, at a rate that depends on
 * the car, on whether the booker is a corporate partner, and on the day of the week, in whole hours and at least two. At
 * the end 9% VAT is added to the rides, then the €12.50 service fee, once per booking.
 *
 * Read by the booking flow in the browser and by the server, which works the price out again when a booking is sent and
 * stores it: nothing here may import server-only code. Amounts are whole euro cents throughout.
 */
export const RATE_CARD_VERSION = "2026-11b";

export type Segment = "corporate" | "public";
export type DayKind = "weekday" | "saturday" | "sunday";

/** The two groups the rate card prices: the first three models, and the two larger SUVs. */
const GROUP: Record<VehicleKey, "first" | "second"> = {
  mercedes_vle_300: "first",
  audi: "first",
  hongqi_e_hs9: "first",
  range_rover: "second",
  cadillac_escalade: "second",
};

/** Euro cents per hour. */
const RATES: Record<"first" | "second", Record<Segment, Record<DayKind, number>>> = {
  first: {
    corporate: { weekday: 7700, saturday: 9700, sunday: 11600 },
    public: { weekday: 8400, saturday: 10500, sunday: 12600 },
  },
  second: {
    corporate: { weekday: 10100, saturday: 12700, sunday: 15200 },
    public: { weekday: 11700, saturday: 14700, sunday: 17600 },
  },
};

/** The fewest hours a booking is billed for: a 45-minute ride is billed as two hours. */
export const MIN_HOURS = 2;
/** Dutch VAT on passenger transport (the low rate), on the rides. */
export const VAT_RATE = 0.09;
/** Added once to every booking, after VAT, as the client's rate card works it out. */
export const SERVICE_FEE_CENTS = 1250;

const WALL_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Which column of the rate card a Dutch wall-clock pick-up ("2026-11-14T08:30", or the database's "2026-11-14 08:30:00") falls in. */
export function dayKind(wall: string): DayKind | null {
  const m = WALL_DATE.exec(wall);
  if (!m) return null;
  const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return day === 0 ? "sunday" : day === 6 ? "saturday" : "weekday";
}

/** The hourly rate of one car, or null for a car the rate card does not list. */
export function hourlyRate(key: string, segment: Segment, day: DayKind): number | null {
  const vehicle = normalizeVehicleKey(key);
  return vehicle ? RATES[GROUP[vehicle]][segment][day] : null;
}

/**
 * Whole hours billed for one leg, at least `MIN_HOURS`. An hourly booking is billed for the hours booked. A transfer is
 * billed for the drive Google expects (without traffic), rounded up to the hour. Waiting is not charged: a client who
 * needs the chauffeur to wait books by the hour. Null when a transfer's drive is not known: the price is then only the
 * minimum, and says so.
 */
export function billedHours(leg: { hours?: number | null; driveSeconds?: number | null }): number | null {
  if (leg.hours && leg.hours > 0) return Math.max(MIN_HOURS, Math.ceil(leg.hours));
  if (!leg.driveSeconds || !Number.isFinite(leg.driveSeconds) || leg.driveSeconds <= 0) return null;
  return Math.max(MIN_HOURS, Math.ceil(leg.driveSeconds / 3600));
}

/** `rate` and `amount` before VAT */
export type PriceLine = { key: VehicleKey; count: number; rate: number; amount: number };
export type PriceLeg = { leg: "outward" | "return"; at: string; day: DayKind; hours: number; lines: PriceLine[] };
export type Price = {
  version: string;
  segment: Segment;
  legs: PriceLeg[];
  /** The rides, hours × rate, before VAT */
  rides: number;
  /** 9% of the rides */
  vat: number;
  /** The service fee, added last */
  fee: number;
  /** What the booking costs: rides + VAT + service fee. Paid when booked (website) or invoiced (corporate partners). */
  total: number;
  /**
   * False when the price is a lower bound: the drive could not be timed (so only the minimum hours are counted), or the
   * team is choosing the car (so the car we would suggest is counted). The flow then says "from".
   */
  exact: boolean;
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
  /** The cars, with how many of each */
  cars: { key: string; count: number }[];
  /** The cars are our suggestion, not the visitor's choice */
  suggested?: boolean;
};

/** The price of a booking by the rate card; null when it cannot be priced (no date, or no car the card lists). */
export function priceBooking(input: PriceInput): Price | null {
  const timed = billedHours({ hours: input.hours, driveSeconds: input.driveSeconds });
  const hours = timed ?? MIN_HOURS;
  const legs: PriceLeg[] = [];
  for (const [leg, at] of [["outward", input.pickupAt], ["return", input.returnAt]] as const) {
    if (!at) continue;
    const day = dayKind(at);
    if (!day) return null;
    const lines: PriceLine[] = [];
    for (const car of input.cars) {
      const key = normalizeVehicleKey(car.key);
      const rate = key ? hourlyRate(key, input.segment, day) : null;
      if (!key || rate === null || !Number.isInteger(car.count) || car.count < 1) continue;
      lines.push({ key, count: car.count, rate, amount: rate * hours * car.count });
    }
    if (lines.length === 0) return null;
    legs.push({ leg, at, day, hours, lines });
  }
  if (legs.length === 0) return null;
  const rides = legs.reduce((sum, leg) => sum + leg.lines.reduce((n, line) => n + line.amount, 0), 0);
  // The client's order: the rides, then 9% VAT on them, then the service fee
  const vat = Math.round(rides * VAT_RATE);
  const fee = SERVICE_FEE_CENTS;
  return { version: RATE_CARD_VERSION, segment: input.segment, legs, rides, vat, fee, total: rides + vat + fee, exact: timed !== null && !input.suggested };
}

/** "€ 1.234,50" or "€1,234.50": cents as euros in the reader's language. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
}
