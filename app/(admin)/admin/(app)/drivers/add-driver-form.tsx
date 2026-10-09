"use client";

import { useActionState } from "react";
import { AlertIcon, PlusIcon } from "../../_components/icons";
import { btn, field, fieldLabel } from "../../_components/ui";
import { addDriver, type AddDriverState } from "./actions";

export function AddDriverForm() {
  const [state, action, pending] = useActionState<AddDriverState, FormData>(addDriver, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="driver-name" className={fieldLabel}>
          Driver name
        </label>
        <input id="driver-name" name="name" required maxLength={120} autoComplete="off" placeholder="e.g. Jan Bakker" className={`${field} h-10`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="driver-phone" className={fieldLabel}>
          Phone <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input id="driver-phone" name="phone" type="tel" maxLength={40} autoComplete="off" placeholder="+31 6 1234 5678" className={`${field} h-10`} />
      </div>
      {state.error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.lg} mt-1`}>
        <PlusIcon /> {pending ? "Adding…" : "Add driver"}
      </button>
    </form>
  );
}
