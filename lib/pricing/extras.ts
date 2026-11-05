/**
 * The add-ons a booking can include (the client's list, November 2026): waiting in the car when the guests get in. Each has
 * its own price before VAT and its own VAT rate: flowers carry the low rate (9%), the rest the high rate (21%).
 *
 * Read by the booking flow in the browser and by the server, which prices the add-ons again when a booking is sent: nothing
 * here may import server-only code. Amounts are whole euro cents.
 */
export const EXTRA_KEYS = ["champagne", "chocolates", "flowers", "newspapers"] as const;
export type ExtraKey = (typeof EXTRA_KEYS)[number];

/** The chocolate box comes in two selections, so a guest with a dietary need can still have one. */
export const CHOCOLATE_OPTIONS = ["classic", "dairy_free"] as const;
export type ChocolateOption = (typeof CHOCOLATE_OPTIONS)[number];

export type ExtraSpec = { unit: number; vatRate: number; image: string; options?: readonly string[] };
export const EXTRAS: Record<ExtraKey, ExtraSpec> = {
  champagne: { unit: 7800, vatRate: 0.21, image: "/add-ons/champagne.webp" },
  chocolates: { unit: 4200, vatRate: 0.21, image: "/add-ons/chocolates.webp", options: CHOCOLATE_OPTIONS },
  flowers: { unit: 6600, vatRate: 0.09, image: "/add-ons/flowers.webp" },
  newspapers: { unit: 1500, vatRate: 0.21, image: "/add-ons/newspapers.webp" },
};

/** The most of any one add-on a booking takes. */
export const MAX_PER_EXTRA = 5;

/** One add-on as the visitor chose it. `option` only for the chocolate box. */
export type ExtraPick = { key: ExtraKey; option?: string; count: number };
/** One add-on as priced: `unit` and `amount` before VAT, `vat` at the add-on's own rate. */
export type ExtraLine = ExtraPick & { unit: number; amount: number; vatRate: number; vat: number };

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
    const pick: ExtraPick = { key, count: Math.min(n, MAX_PER_EXTRA) };
    if (options) pick.option = typeof option === "string" && options.includes(option) ? option : options[0];
    picked.set(key, pick);
  }
  return EXTRA_KEYS.flatMap((k) => (picked.has(k) ? [picked.get(k)!] : []));
}

/** The add-ons with their prices, before and after VAT. */
export function priceExtras(picks: ExtraPick[]): ExtraLine[] {
  return cleanExtras(picks).map((p) => {
    const { unit, vatRate } = EXTRAS[p.key];
    const amount = unit * p.count;
    return { ...p, unit, amount, vatRate, vat: Math.round(amount * vatRate) };
  });
}

/** The words the add-ons are shown with (the `addOns` section of the dictionaries). */
export type ExtraNames = {
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
