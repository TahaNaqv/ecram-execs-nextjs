"use client";

import { useActionState } from "react";
import { STATUS_LABEL } from "@/lib/admin/format";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";
import { updateRequest, type UpdateState } from "../../actions";

type Props = { id: string; status: RequestStatus; quotedAmount: string | null; internalNotes: string | null };

const field =
  "rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";
const label = "flex flex-col gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-500";

export function UpdateForm({ id, status, quotedAmount, internalNotes }: Props) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(updateRequest, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <div className={label}>
        <label htmlFor="req-status">Status</label>
        <select id="req-status" name="status" defaultValue={status} className={field}>
          {REQUEST_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className={label}>
        <label htmlFor="req-amount">Quoted amount (EUR)</label>
        <input id="req-amount" name="quotedAmount" inputMode="decimal" placeholder="e.g. 185.00" defaultValue={quotedAmount ?? ""} className={field} />
      </div>
      <div className={label}>
        <label htmlFor="req-notes">Internal notes</label>
        <textarea
          id="req-notes"
          name="internalNotes"
          rows={5}
          defaultValue={internalNotes ?? ""}
          placeholder="Only visible to the team"
          className={`${field} normal-case tracking-normal`}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-zinc-950 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <span aria-live="polite" className={`text-sm ${state.error ? "text-red-700" : "text-emerald-700"}`}>
          {state.error ?? (state.ok && !pending ? "Saved" : "")}
        </span>
      </div>
    </form>
  );
}
