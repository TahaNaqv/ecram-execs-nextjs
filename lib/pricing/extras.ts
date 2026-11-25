import type { Segment } from "./rates.ts";

/**
 * The add-ons a booking can include (the client's list, November 2026): waiting in the car when the guests get in. Each has
 * its own price before VAT and its own VAT rate: flowers carry the low rate (9%), the rest the high rate (21%).
 *
 * The luggage trailer (the client, 26 Nov 2026) comes first and is priced differently: by the hour, per ride like the cars,
 * at least `minHours` a ride, at a corporate or public rate that already includes 9% VAT. One trailer exists, so at most one
 * a booking, and only with a vehicle (a car, or "let us choose"). A booking with it also holds it (lib/fleet/held.ts).
 *
 * Read by the booking flow in the browser and by the server, which prices the add-ons again when a booking is sent: nothing
 * here may import server-only code. Amounts are whole euro cents.
 */
export const EXTRA_KEYS = ["trailer", "champagne", "chocolates", "flowers", "newspapers"] as const;
/** The add-on that is a second vehicle behind the car rather than something in it. */
export const TRAILER_KEY = "trailer" satisfies (typeof EXTRA_KEYS)[number];
/** Large suitcases the trailer takes (the client, 26 Nov 2026: up to 15 check-in cases, 375 kg), on top of the cars' boots. */
export const TRAILER_SUITCASES = 15;
/** The add-ons kept in stock (the admin's Add-ons page and its low-stock reminders): everything but the trailer. */
export const STOCKED_EXTRA_KEYS = EXTRA_KEYS.filter((key) => key !== TRAILER_KEY);
/** The add-ons that wait in the car (the chat's carousel and booking tool offer these; the trailer is booked on the website). */
export const IN_CAR_EXTRA_KEYS = STOCKED_EXTRA_KEYS;
export type ExtraKey = (typeof EXTRA_KEYS)[number];

/** The chocolate box comes in two selections, so a guest with a dietary need can still have one. */
export const CHOCOLATE_OPTIONS = ["classic", "dairy_free"] as const;
export type ChocolateOption = (typeof CHOCOLATE_OPTIONS)[number];

export type ExtraSpec = {
  /** Price per item before VAT. For an hourly add-on: 0, it is priced from `hourly`. */
  unit: number;
  vatRate: number;
  image: string;
  options?: readonly string[];
  /** At most this many a booking (default MAX_PER_EXTRA). */
  max?: number;
  /** Priced by the hour: the customer's hourly price including VAT, per segment, and the least hours billed per ride. */
  hourly?: { gross: Record<Segment, number>; minHours: number };
};
export const EXTRAS: Record<ExtraKey, ExtraSpec> = {
  // The client's rate card, 26 Nov 2026: €6.25 an hour corporate, €9 public, VAT included, at least 4 hours (€25 / €36)
  trailer: { unit: 0, vatRate: 0.09, image: "/add-ons/trailer.svg", max: 1, hourly: { gross: { corporate: 625, public: 900 }, minHours: 4 } },
  champagne: { unit: 7800, vatRate: 0.21, image: "/add-ons/champagne.webp" },
  chocolates: { unit: 4200, vatRate: 0.21, image: "/add-ons/chocolates.webp", options: CHOCOLATE_OPTIONS },
  flowers: { unit: 6600, vatRate: 0.09, image: "/add-ons/flowers.webp" },
  newspapers: { unit: 1500, vatRate: 0.21, image: "/add-ons/newspapers.webp" },
};

/** The most of any one add-on a booking takes. */
export const MAX_PER_EXTRA = 5;

/** One add-on as the visitor chose it. `option` only for the chocolate box. */
export type ExtraPick = { key: ExtraKey; option?: string; count: number };
/**
 * One add-on as priced: `unit` and `amount` before VAT, `vat` at the add-on's own rate. For the hourly trailer `hours` is
 * what was billed over all rides and `unit` the hourly price before VAT (amount / hours, rounded: amount is exact).
 */
export type ExtraLine = ExtraPick & { unit: number; amount: number; vatRate: number; vat: number; hours?: number };

const isKey = (k: unknown): k is ExtraKey => typeof k === "string" && (EXTRA_KEYS as readonly string[]).includes(k);

/**
 * The add-ons as they may be booked, whatever was sent: known add-ons only, each once, 1 to MAX_PER_EXTRA of it, the
 * chocolate box with one of its selections (the first when none or an unknown one is given), the rest without one. In
 * the catalogue's order.
 */
export function cleanExtras(raw: unknown): ExtraPick[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Map<ExtraKey, ExtraPick>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { key, option, count } = item as Record<string, unknown>;
    if (!isKey(key) || picked.has(key) || typeof count !== "number" || !Number.isInteger(count) || count < 1) continue;
    const n = count;
    const options = EXTRAS[key].options;
    const pick: ExtraPick = { key, count: Math.min(n, EXTRAS[key].max ?? MAX_PER_EXTRA) };
    if (options) pick.option = typeof option === "string" && options.includes(option) ? option : options[0];
    picked.set(key, pick);
  }
  return EXTRA_KEYS.flatMap((k) => (picked.has(k) ? [picked.get(k)!] : []));
}

/** What an hourly add-on is billed for: per ride, the ride's hours but at least its minimum. */
export function hourlyExtraHours(spec: NonNullable<ExtraSpec["hourly"]>, legHours: readonly number[]): number {
  return legHours.reduce((sum, hours) => sum + Math.max(spec.minHours, Math.ceil(hours)), 0);
}

/**
 * The add-ons with their prices, before and after VAT. An hourly add-on (the trailer) needs the booking's segment and the
 * hours of each ride; without them it is left out rather than priced at nothing.
 */
export function priceExtras(picks: ExtraPick[], ctx?: { segment: Segment; legHours: readonly number[] }): ExtraLine[] {
  return cleanExtras(picks).flatMap((p): ExtraLine[] => {
    const { unit, vatRate, hourly } = EXTRAS[p.key];
    if (hourly) {
      if (!ctx || ctx.legHours.length === 0) return [];
      const hours = hourlyExtraHours(hourly, ctx.legHours);
      // The rate includes VAT, as the rides' customer prices do: the VAT is the part of the gross at this rate
      const gross = hourly.gross[ctx.segment] * hours * p.count;
      const vat = Math.round((gross * vatRate) / (1 + vatRate));
      const amount = gross - vat;
      return [{ ...p, unit: Math.round(amount / hours), amount, vatRate, vat, hours }];
    }
    const amount = unit * p.count;
    return [{ ...p, unit, amount, vatRate, vat: Math.round(amount * vatRate) }];
  });
}

/** Whether the add-ons include the trailer. Accepts anything (a stored booking's extras). */
export function hasTrailer(raw: unknown): boolean {
  return Array.isArray(raw) && raw.some((item) => !!item && typeof item === "object" && (item as { key?: unknown }).key === TRAILER_KEY);
}

/** The words the add-ons are shown with (the `addOns` section of the dictionaries). */
export type ExtraNames = {
  trailer: string;
  champagne: string;
  chocolates: string;
  flowers: string;
  newspapers: string;
  chocolatesClassic: string;
  chocolatesDairyFree: string;
};

/** "Van Soest Luxury Chocolate Box (dairy-free selection)". */
export function extraName(names: ExtraNames, pick: Pick<ExtraPick, "key" | "option">): string {
  const name = names[pick.key] ?? pick.key;
  if (pick.key !== "chocolates" || !pick.option) return name;
  return `${name} (${pick.option === "dairy_free" ? names.chocolatesDairyFree : names.chocolatesClassic})`;
}

/** "2 × Moët & Chandon Brut Impérial (75cl), 1 × Financial Newspaper Bundle (FT & FD)", or null for none. */
export function extrasLine(names: ExtraNames, raw: unknown): string | null {
  const picks = cleanExtras(raw);
  return picks.length > 0 ? picks.map((p) => `${p.count} × ${extraName(names, p)}`).join(", ") : null;
}
