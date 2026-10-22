import { APPLICATION_DOT, APPLICATION_STYLE, STATUS_DOT, STATUS_STYLE } from "@/lib/admin/format";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import type { ApplicationStatus } from "@/lib/partners/criteria";
import type { RequestStatus } from "@/lib/quotes/constants";
import { isUrgent } from "@/lib/quotes/urgency";

/**
 * Resolves the label itself rather than taking it as a prop: every caller is a Server
 * Component, and `adminDictionary()` is deduplicated per request, so this costs nothing.
 */
export async function StatusBadge({ status, size = "sm" }: { status: RequestStatus; size?: "sm" | "md" }) {
  const { admin: t } = await adminDictionary();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
      } ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {t.statuses[status]}
    </span>
  );
}

export async function ApplicationBadge({ status, size = "sm" }: { status: ApplicationStatus; size?: "sm" | "md" }) {
  const { admin: t } = await adminDictionary();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
      } ${APPLICATION_STYLE[status]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${APPLICATION_DOT[status]}`} />
      {t.applicationStatuses[status]}
    </span>
  );
}

/**
 * "Urgent": the booking is still open and the pick-up is within 24 hours (or began in the last few). Nothing renders for
 * any other booking. Reads the clock, so it belongs in a dynamic part of the page, like the relative times beside it.
 */
export async function UrgentBadge({ request, size = "sm" }: { request: { status: RequestStatus; pickupAt: string | null; returnAt?: string | null }; size?: "sm" | "md" }) {
  if (!isUrgent(request)) return null;
  const { admin: t } = await adminDictionary();
  return (
    <span
      title={t.requests.urgentNote}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-red-600 font-semibold tracking-wide text-white uppercase ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      }`}
    >
      {t.requests.urgent}
    </span>
  );
}
