"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ACTIVE_STATUSES, type RequestStatus } from "@/lib/quotes/constants";
import { publishBookingStatus } from "../../../_components/booking-status";
import { updateRequest, type UpdateState } from "../../../actions";
import { AlertIcon, CheckIcon, ChevronDownIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { useActionNotice } from "../../../_components/action-feedback";

type Props = {
  id: string;
  status: RequestStatus;
  quotedAmount: string | null;
  /** Priced by the rate card (not bespoke): the amount follows the cars and the trip, and is not typed in */
  priced?: boolean;
  internalNotes: string | null;
  statusLabels: Record<RequestStatus, string>;
  copy: { save: string; saving: string; status: string; quotedAmount: string; internalNotes: string; amountPlaceholder: string; internalPlaceholder: string; cancelWarn?: string; cancelGo?: string; cancelBack?: string };
};

export function UpdateForm({ id, status, quotedAmount, priced = false, internalNotes, statusLabels, copy }: Props) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateRequest, {});
  useActionNotice(state, "Status updated!");
  const [warn, setWarn] = useState(false);
  // The menu follows the booking: when it moves on elsewhere (approved, declined) the page refreshes with the new status,
  // and the menu must show that, not the one it was opened on (a save from a stale menu would put the old status back)
  const [chosen, setChosen] = useState<string>(status);
  const [shownFor, setShownFor] = useState(status);
  if (shownFor !== status) {
    setShownFor(status);
    setChosen(status);
  }
  const publishedSave = useRef(state);
  useEffect(() => {
    if (state.error) {
      publishBookingStatus(id, status);
      return;
    }
    if (!state.ok || publishedSave.current === state) return;
    publishedSave.current = state;
    if ((ACTIVE_STATUSES as readonly string[]).includes(chosen)) publishBookingStatus(id, chosen as RequestStatus);
  }, [state, id, chosen, status]);
  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        const next = String(new FormData(event.currentTarget).get("status") ?? "");
        if (next === "cancelled" && status !== "cancelled" && !warn) {
          event.preventDefault();
          setWarn(true);
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      {/* What this form was showing: the save is refused if the booking has moved on since (e.g. the partner answered it) */}
      <input type="hidden" name="seenStatus" value={status} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-status" className={fieldLabel}>
          {copy.status}
        </label>
        <div className="relative">
          <select id="req-status" name="status" value={(ACTIVE_STATUSES as readonly string[]).includes(chosen) ? chosen : "new"} onChange={(event) => { const next = event.target.value; setChosen(next); setWarn(next === "cancelled" && status !== "cancelled" ? warn : false); if ((ACTIVE_STATUSES as readonly string[]).includes(next)) publishBookingStatus(id, next as RequestStatus); }} className={`${field} h-10 cursor-pointer appearance-none pr-9`}>
            {ACTIVE_STATUSES.filter((s) => s !== "cancelled" || s === status).map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>
      {priced ? (
        <p className="m-0 text-[13px] leading-5 text-zinc-500">
          <input type="hidden" name="quotedAmount" value="" />
          The price comes from the rate card above. To change it, change the cars or the trip; it is recalculated automatically.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="req-amount" className={fieldLabel}>
            {copy.quotedAmount}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">€</span>
            <input
              id="req-amount"
              name="quotedAmount"
              inputMode="decimal"
              autoComplete="off"
              placeholder={copy.amountPlaceholder}
              defaultValue={quotedAmount ?? ""}
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "req-error" : undefined}
              className={`${field} h-10 pl-7 tabular-nums`}
            />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-notes" className={fieldLabel}>
          {copy.internalNotes}
        </label>
        <textarea
          id="req-notes"
          name="internalNotes"
          rows={5}
          maxLength={5000}
          defaultValue={internalNotes ?? ""}
          placeholder={copy.internalPlaceholder}
          className={`${field} resize-y py-2.5 leading-relaxed`}
        />
      </div>

      {state.error && (
        <p id="req-error" role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      {warn && (
        <div role="dialog" aria-modal="true" className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-950 ring-1 ring-inset ring-amber-200">
          <p role="alert" className="m-0">{copy.cancelWarn}</p>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button disabled={pending} className={`${btn.base} ${warn ? "bg-red-600 text-white hover:bg-red-700" : btn.primary} ${btn.lg} flex-1`}>
          {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {pending ? copy.saving : warn ? copy.cancelGo : copy.save}
        </button>
        {warn && (
          <button type="button" onClick={() => setWarn(false)} className={`${btn.base} ${btn.ghost} ${btn.lg}`}>
            {copy.cancelBack}
          </button>
        )}
      </div>
      <p aria-live="polite" className="-mt-1 min-h-5 text-center text-[13px]">
        {state.ok && !pending && (
          <span className="inline-flex items-center gap-1.5 text-emerald-700">
            <CheckIcon size={14} /> Saved
          </span>
        )}
      </p>
    </form>
  );
}
