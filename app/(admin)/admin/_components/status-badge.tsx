import { APPLICATION_DOT, APPLICATION_LABEL, APPLICATION_STYLE, STATUS_DOT, STATUS_LABEL, STATUS_STYLE } from "@/lib/admin/format";
import type { ApplicationStatus } from "@/lib/partners/criteria";
import type { RequestStatus } from "@/lib/quotes/constants";

export function StatusBadge({ status, size = "sm" }: { status: RequestStatus; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
      } ${STATUS_STYLE[status]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ApplicationBadge({ status, size = "sm" }: { status: ApplicationStatus; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
      } ${APPLICATION_STYLE[status]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${APPLICATION_DOT[status]}`} />
      {APPLICATION_LABEL[status]}
    </span>
  );
}
