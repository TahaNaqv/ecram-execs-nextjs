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

/** The booking's status, following both a server refresh and a status change made on this page. */
export function useBookingStatus(requestId: string, initial: RequestStatus): RequestStatus {
  const [status, setStatus] = useState<RequestStatus>(() => published.get(requestId) ?? initial);

  useEffect(() => {
    const override = published.get(requestId);
    if (override && override !== initial) setStatus(override);
    else {
      if (override === initial) published.delete(requestId);
      setStatus(initial);
    }
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

const PIPELINE: RequestStatus[] = ["new", "contacted", "confirmed", "completed"];

export function LivePipeline({
  requestId,
  status,
  labels,
  progressLabel,
  cancelledNote,
}: {
  requestId: string;
  status: RequestStatus;
  labels: Record<RequestStatus, string>;
  progressLabel: string;
  cancelledNote: string;
}) {
  const live = useBookingStatus(requestId, status);
  if (live === "cancelled") {
    return <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">{cancelledNote}</div>;
  }
  const at = live === "quoted" ? PIPELINE.indexOf("new") : PIPELINE.indexOf(live);
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label={progressLabel}>
      {PIPELINE.map((step, i) => {
        const done = i < at;
        const current = i === at;
        return (
          <li key={step} aria-current={current ? "step" : undefined} className="min-w-0">
            <span className={`block h-1 rounded-full ${i <= at ? "bg-zinc-950" : "bg-zinc-200"}`} />
            <span
              className={`mt-2 flex items-center gap-1 truncate text-[11px] font-medium sm:text-xs ${
                current ? "text-zinc-950" : done ? "text-zinc-600" : "text-zinc-400"
              }`}
            >
              {done && <CheckIcon size={12} className="hidden shrink-0 sm:block" />}
              {labels[step] ?? step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
