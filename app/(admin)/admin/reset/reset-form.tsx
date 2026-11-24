"use client";

import { useActionState } from "react";
import { btn, field, fieldLabel } from "../_components/ui";
import { applyReset, type ResetState } from "../forgot/actions";

export function ResetForm({ token, copy }: { token: string; copy: { next: string; reset: string; resetDone: string; resetBad: string; short: string } }) {
  const [state, action, pending] = useActionState<ResetState, FormData>(applyReset, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.next}</span>
        <input name="password" type="password" required minLength={12} autoComplete="new-password" className={`${field} h-11`} />
      </label>
      <p className="m-0 text-xs text-zinc-500">{copy.short}</p>
      {state.ok && <p className="m-0 text-sm text-emerald-700">{copy.resetDone}</p>}
      {state.error && <p className="m-0 text-sm text-red-700">{copy.resetBad}</p>}
      <button disabled={pending || !token} className={`${btn.base} ${btn.primary} h-11`}>{copy.reset}</button>
    </form>
  );
}
