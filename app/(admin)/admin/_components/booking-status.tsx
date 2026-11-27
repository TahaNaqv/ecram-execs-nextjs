"use client";

import { useEffect, useState } from "react";
import { STATUS_DOT, STATUS_STYLE } from "@/lib/admin/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";
import { CheckIcon } from "./icons";

const EVENT = "ee-booking-status";

/** Latest status written in this tab, so a stale server refresh cannot put the old badge back. */
const published = new Map<string, RequestStatus>();

const isStatus = (value: unknown): value is RequestStatus =>
  typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);

export function publishBookingStatus(requestId: string, status: RequestStatus) {
  published.set(requestId, status);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { requestId, status } }));
}

/**
 * The booking's status, following both a server refresh and a status change made on this page.
 * The stored status is the starting point. An older in-tab value must not keep "In discussion"
 * on screen after the booking is "new". A choice made afterwards still updates the badge at once.
 */
export function useBookingStatus(requestId: string, initial: RequestStatus): RequestStatus {
  const [status, setStatus] = useState<RequestStatus>(initial);

  useEffect(() => {
    const override = published.get(requestId);
    // A status just chosen on this page (including In discussion) stays until the server reports it.
    // Once the server matches, the override is dropped so a later reload is not stuck on the old step.
    if (override && override !== initial) {
      setStatus(override);
      return;
    }
    published.delete(requestId);
    setStatus(initial);
  }, [requestId, initial]);

  useEffect(() => {
    const onStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ requestId?: string; status?: unknown }>).detail;
      if (detail?.requestId === requestId && isStatus(detail.status)) setStatus(detail.status);
    };
    window.addEventListener(EVENT, onStatus);
    return () => window.removeEventListener(EVENT, onStatus);
  }, [requestId]);

  return status;
}

export function LiveStatusBadge({
  requestId,
  status,
  labels,
  size = "md",
}: {
  requestId: string;
  status: RequestStatus;
  labels: Record<RequestStatus, string>;
  size?: "sm" | "md";
}) {
  const live = useBookingStatus(requestId, status);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
      } ${STATUS_STYLE[live]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT[live]}`} />
      {labels[live]}
    </span>
  );
}

/** New, In discussion, Confirmed, Payment, Completed. A service fee does not move the bar onto Payment. */
const PIPELINE = ["new", "contacted", "confirmed", "quoted", "completed"] as const;

export type PipelinePayment = "none" | "fee" | "full";

const pipelineIndex = (status: RequestStatus): number => {
  if (status === "completed") return 4;
  if (status === "quoted") return 3;
  if (status === "confirmed") return 2;
  if (status === "contacted") return 1;
  return 0;
};

export function LivePipeline({
  requestId,
  status,
  payment = "none",
  steps,
  progressLabel,
  cancelledNote,
}: {
  requestId: string;
  status: RequestStatus;
  /** full: the trip balance is in, so the Payment step reads as paid. fee: only the service fee; the bar stays on Confirmed. */
  payment?: PipelinePayment;
  steps: { pending: string; discussion: string; confirmed: string; payment: string; paid: string; completed: string };
  progressLabel: string;
  cancelledNote: string;
}) {
  const live = useBookingStatus(requestId, status);
  if (live === "cancelled") {
    return <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">{cancelledNote}</div>;
  }
  const at = pipelineIndex(live);
  const labels = [steps.pending, steps.discussion, steps.confirmed, payment === "full" && at >= 3 ? steps.paid : steps.payment, steps.completed];
  return (
    <ol className="grid grid-cols-5 gap-3" aria-label={progressLabel}>
      {PIPELINE.map((step, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <span className={`block h-1 rounded-full ${i <= at ? "bg-zinc-950" : "bg-zinc-200"}`} />
            <span
              className={`mt-2 flex items-start gap-1 text-[11px] font-medium leading-tight sm:text-xs ${
                current ? "text-zinc-950" : done ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              {done && <CheckIcon size={12} className="mt-0.5 shrink-0" />}
              <span className="min-w-0">{labels[i]}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
