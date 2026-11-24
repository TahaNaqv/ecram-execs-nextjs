"use client";

import { useActionState } from "react";
import { btn, field, fieldLabel } from "../_components/ui";
import { requestReset, type ForgotState } from "./actions";

export function ForgotForm({ copy }: { copy: { email: string; send: string; sent: string } }) {
  const [state, action, pending] = useActionState<ForgotState, FormData>(requestReset, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.email}</span>
        <input name="email" type="email" required className={`${field} h-11`} />
      </label>
      {state.sent && <p className="m-0 text-sm text-emerald-700">{copy.sent}</p>}
      <button disabled={pending} className={`${btn.base} ${btn.primary} h-11`}>{copy.send}</button>
    </form>
  );
}
