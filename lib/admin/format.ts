import type { ApplicationStatus } from "@/lib/partners/criteria";
import type { RequestStatus } from "@/lib/quotes/constants";

const TZ = "Europe/Amsterdam";

/** pickup_at is stored as Netherlands wall-clock time ("2026-11-12 08:30:00"). */
export function formatPickup(value: string) {
  const [d, t] = value.replace("T", " ").split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${date} · ${t.slice(0, 5)}`;
}

export function formatTimestamp(value: Date) {
  return value.toLocaleString("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEuro(value: string | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(value));
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_STYLE: Record<RequestStatus, string> = {
  new: "bg-zinc-950 text-white ring-zinc-950",
  contacted: "bg-sky-50 text-sky-800 ring-sky-200",
  quoted: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  cancelled: "bg-white text-zinc-500 ring-zinc-200",
};

export const STATUS_DOT: Record<RequestStatus, string> = {
  new: "bg-white",
  contacted: "bg-sky-500",
  quoted: "bg-amber-500",
  confirmed: "bg-emerald-500",
  completed: "bg-zinc-400",
  cancelled: "bg-zinc-300",
};

/** Compact "3h ago" / "in 2 days" relative to now. */
export function formatRelative(target: Date, now = Date.now()) {
  const diff = target.getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto", style: "short" });
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

/** pickup_at is Netherlands wall-clock time; convert it to an instant for relative display. */
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
export function pickupParts(value: string) {
  const [date, time] = formatPickup(value).split(" · ");
  return { date, time };
}

export function isPast(value: Date) {
  return value.getTime() < Date.now();
}

export const APPLICATION_LABEL: Record<ApplicationStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  approved: "Approved",
  rejected: "Rejected",
};

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
export function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
