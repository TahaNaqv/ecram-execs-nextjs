import { STATUS_LABEL, STATUS_STYLE } from "@/lib/admin/format";
import type { RequestStatus } from "@/lib/quotes/constants";

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
