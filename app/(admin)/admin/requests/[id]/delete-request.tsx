"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRequest } from "../../actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded bg-red-700 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-red-800 disabled:opacity-60">
      {pending ? "Deleting…" : "Yes, delete permanently"}
    </button>
  );
}

export function DeleteRequest({ id, reference }: { id: string; reference: string }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-xs text-zinc-500 underline hover:text-red-700">
        Delete this request…
      </button>
    );
  }
  return (
    <form action={deleteRequest} className="flex flex-col gap-3 rounded border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-red-900">
        Permanently delete {reference} and all of its history? Use this for client data-deletion requests. This cannot be undone.
      </p>
      <div className="flex flex-wrap gap-2">
        <ConfirmButton />
        <button type="button" onClick={() => setConfirming(false)} className="rounded border border-zinc-300 bg-white px-3 py-2 text-xs hover:bg-zinc-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
