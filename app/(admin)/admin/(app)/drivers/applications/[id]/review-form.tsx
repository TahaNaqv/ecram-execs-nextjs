"use client";

import { useActionState } from "react";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/partners/criteria";
import { AlertIcon, CheckIcon, ChevronDownIcon } from "../../../../_components/icons";
import { btn, field, fieldLabel } from "../../../../_components/ui";
import { updateApplication, type UpdateApplicationState } from "../actions";

type Props = {
  id: string;
  status: ApplicationStatus;
  internalNotes: string | null;
  statusLabels: Record<ApplicationStatus, string>;
  copy: { save: string; saving: string; status: string; internalNotes: string; internalPlaceholder: string; approvalNote: string };
};

export function ReviewForm({ id, status, internalNotes, statusLabels, copy }: Props) {
  const [state, action, pending] = useActionState<UpdateApplicationState, FormData>(updateApplication, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="app-status" className={fieldLabel}>
          {copy.status}
        </label>
        <div className="relative">
          <select id="app-status" name="status" defaultValue={status} className={`${field} h-10 cursor-pointer appearance-none pr-9`}>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        </div>
        <p className="text-xs text-zinc-500">
          {copy.approvalNote}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="app-notes" className={fieldLabel}>
          {copy.internalNotes}
        </label>
        <textarea
          id="app-notes"
          name="internalNotes"
          rows={5}
          maxLength={5000}
          defaultValue={internalNotes ?? ""}
          placeholder={copy.internalPlaceholder}
          className={`${field} resize-y py-2.5 leading-relaxed`}
        />
      </div>

      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg}`}>
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
        {pending ? copy.saving : copy.save}
      </button>
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
