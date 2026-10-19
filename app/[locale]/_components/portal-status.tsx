import type { RequestStatus } from "@/lib/quotes/constants";

const TONE: Record<RequestStatus, string> = {
  new: "bg-ink-100 text-ink-700",
  contacted: "bg-ink-100 text-ink-700",
  quoted: "bg-amber-100 text-amber-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  completed: "bg-ink-950 text-white",
  cancelled: "bg-ink-100 text-ink-450 line-through",
};

/** A booking's status as a small label, in the partner's words (the dictionary's `portal.statuses`). */
export function PortalStatus({ status, labels }: { status: RequestStatus; labels: Record<RequestStatus, string> }) {
  return <span className={`inline-block px-2.5 py-1 text-[11px] font-semibold tracking-[0.14em] whitespace-nowrap uppercase ${TONE[status]}`}>{labels[status]}</span>;
}
