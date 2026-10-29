import type { Locale } from "@/lib/i18n/config";
import type { ApplicationStatus } from "@/lib/partners/criteria";
import type { RequestStatus } from "@/lib/quotes/constants";

const TZ = "Europe/Amsterdam";

/**
 * BCP-47 tag per app locale, for date formatting only.
 *
 * `locale` defaults to "en" so existing call sites keep working; Phase 5 passes the admin's
 * own `admin_users.locale`. Money is deliberately NOT affected — see {@link formatEuro}.
 */
const TAGS: Record<Locale, string> = { en: "en-GB", nl: "nl-NL" };

/** pickup_at is stored as Netherlands wall-clock time ("2026-11-12 08:30:00"). */
export function formatPickup(value: string, locale: Locale = "en") {
  const [d, t] = value.replace("T", " ").split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(TAGS[locale], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${date} · ${t.slice(0, 5)}`;
}

export function formatTimestamp(value: Date, locale: Locale = "en") {
  return value.toLocaleString(TAGS[locale], {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Always Dutch formatting ("€ 185,50"), in both languages and on purpose: this is a Dutch
 * company quoting in euros, and the amount should read the same on an invoice whichever
 * language the panel is in.
 */
export function formatEuro(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(value));
}

/** Status labels live in `dictionary.admin.statuses`; this is only the styling. */

export const STATUS_STYLE: Record<RequestStatus, string> = {
  new: "bg-zinc-950 text-white ring-zinc-950",
  contacted: "bg-sky-50 text-sky-800 ring-sky-200",
  quoted: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200", // Updated to green/emerald
  cancelled: "bg-white text-zinc-500 ring-zinc-200",
};

export const STATUS_DOT: Record<RequestStatus, string> = {
  new: "bg-white",
  contacted: "bg-sky-500",
  quoted: "bg-amber-500",
  confirmed: "bg-emerald-500",
  completed: "bg-emerald-500", // Updated to green/emerald dot
  cancelled: "bg-zinc-300",
};

/** Compact "3h ago" / "in 2 days" relative to now. */
export function formatRelative(target: Date, now = Date.now(), locale: Locale = "en") {
  const diff = target.getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(TAGS[locale], { numeric: "auto", style: "short" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  }
  return "";
}

/**
 * pickup_at is Netherlands wall-clock time; convert it to an instant for relative display.
 *
 * ⚠ The "en-US" below is timezone arithmetic, NOT display. Do not "localize" it: changing the
 * tag changes how the string parses back and silently corrupts every pickup time.
 */
export function pickupInstant(value: string) {
  const [d, t = "00:00"] = value.replace("T", " ").split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  // Offset of Amsterdam at that moment (CET/CEST)
  const local = new Date(new Date(guess).toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(new Date(guess).toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess - (local.getTime() - utc.getTime()));
}

/** Split "Sun, 11 Oct 2026 · 08:30" into its date and time parts. */
export function pickupParts(value: string, locale: Locale = "en") {
  const [date, time] = formatPickup(value, locale).split(" · ");
  return { date, time };
}

export function isPast(value: Date) {
  return value.getTime() < Date.now();
}

/** Labels live in `dictionary.admin.applicationStatuses`; this is only the styling. */

export const APPLICATION_STYLE: Record<ApplicationStatus, string> = {
  new: "bg-zinc-950 text-white ring-zinc-950",
  reviewing: "bg-sky-50 text-sky-800 ring-sky-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-white text-zinc-500 ring-zinc-200",
};

export const APPLICATION_DOT: Record<ApplicationStatus, string> = {
  new: "bg-white",
  reviewing: "bg-sky-500",
  approved: "bg-emerald-500",
  rejected: "bg-zinc-300",
};

/** "2025-05-16" → "16 May 2025" */
export function formatDate(value: string | null, locale: Locale = "en") {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(TAGS[locale], { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}