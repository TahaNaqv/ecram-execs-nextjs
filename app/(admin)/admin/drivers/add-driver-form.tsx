"use client";

import { useActionState } from "react";
import { addDriver, type AddDriverState } from "./actions";

const field =
  "min-w-0 rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900";

export function AddDriverForm() {
  const [state, action, pending] = useActionState<AddDriverState, FormData>(addDriver, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="name" required maxLength={120} placeholder="Driver name" aria-label="Driver name" className={`${field} sm:flex-1`} />
        <input name="phone" type="tel" maxLength={40} placeholder="Phone (optional)" aria-label="Phone" className={`${field} sm:w-48`} />
        <button disabled={pending} className="rounded bg-zinc-950 px-4 py-2 text-sm text-white hover:bg-zinc-800 disabled:opacity-60">
          {pending ? "Adding…" : "Add driver"}
        </button>
      </div>
      {state.error && (
        <p aria-live="polite" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
