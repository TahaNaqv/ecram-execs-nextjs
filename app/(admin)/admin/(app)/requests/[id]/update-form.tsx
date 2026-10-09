"use client";

import { useActionState } from "react";
import { STATUS_LABEL } from "@/lib/admin/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";
import { updateRequest, type UpdateState } from "../../../actions";
import { AlertIcon, CheckIcon, ChevronDownIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";

type Props = { id: string; status: RequestStatus; quotedAmount: string | null; internalNotes: string | null };

export function UpdateForm({ id, status, quotedAmount, internalNotes }: Props) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateRequest, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-status" className={fieldLabel}>
          Status
        </label>
        <div className="relative">
          <select id="req-status" name="status" defaultValue={status} className={`${field} h-10 cursor-pointer appearance-none pr-9`}>
            {REQUEST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-amount" className={fieldLabel}>
          Quoted amount (EUR)
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">€</span>
          <input
            id="req-amount"
            name="quotedAmount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="185.00"
            defaultValue={quotedAmount ?? ""}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? "req-error" : undefined}
            className={`${field} h-10 pl-7 tabular-nums`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-notes" className={fieldLabel}>
          Internal notes
        </label>
        <textarea
          id="req-notes"
          name="internalNotes"
          rows={5}
          maxLength={5000}
          defaultValue={internalNotes ?? ""}
          placeholder="Driver assigned, vehicle, flight details… Only visible to the team."
          className={`${field} resize-y py-2.5 leading-relaxed`}
        />
      </div>

      {state.error && (
        <p id="req-error" role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg} flex-1`}>
          {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
          {pending ? "Saving…" : "Save changes"}
        </button>
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
