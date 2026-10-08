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
  new: "bg-zinc-900 text-white",
  contacted: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
  quoted: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  confirmed: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200",
  completed: "bg-zinc-100 text-zinc-700 ring-1 ring-inset ring-zinc-200",
  cancelled: "bg-white text-zinc-400 ring-1 ring-inset ring-zinc-200 line-through",
};
