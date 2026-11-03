import { normalizeVehicleKey, type VehicleKey } from "../fleet/vehicles.ts";

/**
 * The client's rate card (November 2026), as data. Every booking is billed by the hour per car, at a rate that depends on
 * the car, on whether the booker is a corporate partner, and on the day of the week; at least two hours are billed. The
 * rates are before the service fee and VAT, which are added once to the whole booking.
 *
 * Read by the booking flow in the browser and by the server, which works the price out again when a booking is sent and
 * stores it: nothing here may import server-only code. Amounts are whole euro cents throughout.
 */
export const RATE_CARD_VERSION = "2026-11";

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

/** The fewest hours a booking is billed for. */
export const MIN_HOURS = 2;
/** A transfer is billed for its driving time (and waits at stops), rounded up to this many minutes. */
export const BILLING_STEP_MINUTES = 30;
/** Added once to every booking, before VAT. */
export const SERVICE_FEE_CENTS = 1250;
/** Dutch VAT on passenger transport (the low rate), on the rides and the service fee. */
export const VAT_RATE = 0.09;

/** An amount with VAT added, to the cent. Prices shown to the public include VAT (Dutch consumer pricing rules). */
export const withVat = (cents: number) => Math.round(cents * (1 + VAT_RATE));

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
 * Hours billed for one leg. An hourly booking is billed for the hours booked. A transfer is billed for the drive Google
 * expects (without traffic) plus the waits at its stops, rounded up to the half hour. Either way at least `MIN_HOURS`.
 * Null when a transfer's drive is not known: the price is then only the minimum, and says so.
 */
export function billedHours(leg: { hours?: number | null; driveSeconds?: number | null; waitMinutes?: number }): number | null {
  if (leg.hours && leg.hours > 0) return Math.max(MIN_HOURS, leg.hours);
  if (!leg.driveSeconds || !Number.isFinite(leg.driveSeconds) || leg.driveSeconds <= 0) return null;
  const minutes = leg.driveSeconds / 60 + (leg.waitMinutes ?? 0);
  const steps = Math.ceil(minutes / BILLING_STEP_MINUTES);
  return Math.max(MIN_HOURS, (steps * BILLING_STEP_MINUTES) / 60);
}

/** `rate` and `amount` before VAT; `gross` is `amount` with VAT */
export type PriceLine = { key: VehicleKey; count: number; rate: number; amount: number; gross: number };
export type PriceLeg = { leg: "outward" | "return"; at: string; day: DayKind; hours: number; lines: PriceLine[] };
export type Price = {
  version: string;
  segment: Segment;
  legs: PriceLeg[];
  /** The rides before VAT */
  rides: number;
  /** The service fee before VAT, and with it */
  fee: number;
  feeGross: number;
  vat: number;
  /** What the booking costs, VAT included */
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
  /** Minutes the chauffeur waits at the stops on the way */
  waitMinutes?: number;
  /** The cars, with how many of each */
  cars: { key: string; count: number }[];
  /** The cars are our suggestion, not the visitor's choice */
  suggested?: boolean;
};

/** The price of a booking by the rate card; null when it cannot be priced (no date, or no car the card lists). */
export function priceBooking(input: PriceInput): Price | null {
  const timed = billedHours({ hours: input.hours, driveSeconds: input.driveSeconds, waitMinutes: input.waitMinutes });
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
      const amount = Math.round(rate * hours * car.count);
      lines.push({ key, count: car.count, rate, amount, gross: withVat(amount) });
    }
    if (lines.length === 0) return null;
    legs.push({ leg, at, day, hours, lines });
  }
  if (legs.length === 0) return null;
  const all = legs.flatMap((leg) => leg.lines);
  const rides = all.reduce((sum, line) => sum + line.amount, 0);
  const fee = SERVICE_FEE_CENTS;
  const feeGross = withVat(fee);
  // VAT is added line by line, so the amounts the public sees (each with VAT) add up to the total exactly
  const total = all.reduce((sum, line) => sum + line.gross, 0) + feeGross;
  return { version: RATE_CARD_VERSION, segment: input.segment, legs, rides, fee, feeGross, vat: total - rides - fee, total, exact: timed !== null && !input.suggested };
}

/** "€ 1.234,50" or "€1,234.50": cents as euros in the reader's language. */
export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
}
