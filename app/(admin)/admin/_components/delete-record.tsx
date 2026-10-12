"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertIcon, TrashIcon } from "./icons";
import { btn } from "./ui";

function ConfirmButton({ confirm, deleting }: { confirm: string; deleting: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${btn.base} ${btn.danger} ${btn.md}`}>
      {pending ? deleting : confirm}
    </button>
  );
}

/** Danger-zone card that permanently deletes a record after a confirmation step. */
export type DeleteRecordCopy = { title: string; note: string; confirm: string; deleting: string };

export function DeleteRecord({
  copy,
  id,
  reference,
  noun,
  action,
}: {
  copy: DeleteRecordCopy;
  id: string;
  reference: string;
  /** Already localized by the caller — it appears inside the confirmation sentence. */
  noun: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="rounded-xl border border-red-200/70 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-zinc-950">{copy.title}</h2>
      {!confirming ? (
        <>
          <p className="mt-1 text-xs text-zinc-500">{copy.note}</p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className={`${btn.base} ${btn.md} mt-4 w-full border border-red-200 bg-white text-red-700 hover:bg-red-50`}
          >
            <TrashIcon /> Delete this {noun}…
          </button>
        </>
      ) : (
        <form action={action} className="mt-3 flex animate-fade-in flex-col gap-3">
          <input type="hidden" name="id" value={id} />
          <p className="flex gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-900 ring-1 ring-inset ring-red-200">
            <AlertIcon className="mt-0.5 shrink-0 text-red-600" />
            <span>
              Permanently delete {reference} and all of its history? This cannot be undone.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <ConfirmButton confirm={copy.confirm} deleting={copy.deleting} />
            <button type="button" onClick={() => setConfirming(false)} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
