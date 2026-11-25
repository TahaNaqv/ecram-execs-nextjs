const TONE = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  UNPAID: "bg-amber-100 text-amber-900 ring-amber-200",
  OPEN: "bg-sky-50 text-sky-700 ring-sky-200",
} as const;

export type PaymentStanding = keyof typeof TONE;

/** The badge the bookings list and the booking page share. A stored status wins; otherwise a paid row, then an unpaid plan. */
export function paymentStanding(stored: string | null | undefined, paid = false, unpaid = false): PaymentStanding {
  const status = stored?.trim().toUpperCase();
  if (status) return status === "PAID" || status === "UNPAID" ? status : "OPEN";
  if (paid) return "PAID";
  if (unpaid) return "UNPAID";
  return "OPEN";
}

export function PaymentStatusBadge({ status, title, size = "sm" }: { status: string; title?: string; size?: "sm" | "md" }) {
  const key = paymentStanding(status);
  const cls = size === "md" ? "px-2.5 py-0.5 text-xs" : "px-2 py-0.5 text-[11px]";
  return (
    <span title={title} className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${cls} ${TONE[key]}`}>
      {key}
    </span>
  );
}
