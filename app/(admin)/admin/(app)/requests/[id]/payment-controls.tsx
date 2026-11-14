"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { checkPayments, refundAction, type PaymentActionState } from "./payment-actions";

type Copy = Dictionary["admin"]["payments"];

export function CheckPaymentsButton({ requestId, copy: t }: { requestId: string; copy: Copy }) {
  const [state, action, pending] = useActionState<PaymentActionState, FormData>(checkPayments, {});
  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <button disabled={pending} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
        {pending ? t.checking : t.check}
      </button>
      {state.error && <span className="text-xs text-red-700">{state.error}</span>}
    </form>
  );
}

/** Gives money back through Mollie. The amount starts at what the credit invoice returns (or all that is left). */
export function RefundForm({ paymentId, suggested, max, copy: t }: { paymentId: string; suggested: string; max: string; copy: Copy }) {
  const [state, action, pending] = useActionState<PaymentActionState, FormData>(refundAction, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>{interpolate(t.refundLabel, { max })}</span>
        <input name="amount" inputMode="decimal" required defaultValue={suggested} className={`${field} h-9`} />
      </label>
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>
        {pending ? t.refunding : t.refundButton}
      </button>
      {state.ok && <p className="m-0 text-xs text-emerald-700">{t.refundStarted}</p>}
      {state.error && <p className="m-0 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
