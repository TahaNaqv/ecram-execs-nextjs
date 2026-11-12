"use client";

import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { creditInvoice, retryInvoice, type MoneybirdState } from "./moneybird-actions";

type Copy = Dictionary["admin"]["moneybird"];

export function RetryButton({ requestId, copy: t, force = false }: { requestId: string; copy: Copy; force?: boolean }) {
  const [state, action, pending] = useActionState<MoneybirdState, FormData>(retryInvoice, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      {force && <input type="hidden" name="force" value="1" />}
      <button disabled={pending} className={`${btn.base} ${btn.secondary} ${btn.sm} self-start`}>
        {pending ? t.retrying : force ? t.makeInvoice : t.retry}
      </button>
      {state.error && <p className="m-0 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}

/** The cancelled booking's credit: in full, or keeping a cancellation fee. Nothing is credited until the team chooses. */
export function CreditForm({ requestId, copy: t, paid, total }: { requestId: string; copy: Copy; paid: boolean; total: string }) {
  const [state, action, pending] = useActionState<MoneybirdState, FormData>(creditInvoice, {});
  const [mode, setMode] = useState<"full" | "fee">("full");
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <p className="m-0 text-[13px] font-semibold text-zinc-950">{t.creditTitle}</p>
        <p className="m-0 mt-0.5 text-xs text-zinc-500">{paid ? interpolate(t.creditNotePaid, { total }) : t.creditNote}</p>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-zinc-800">
        <input type="radio" name="mode" value="full" checked={mode === "full"} onChange={() => setMode("full")} />
        {interpolate(t.creditFull, { total })}
      </label>
      <label className="flex items-center gap-2 text-[13px] text-zinc-800">
        <input type="radio" name="mode" value="fee" checked={mode === "fee"} onChange={() => setMode("fee")} />
        {t.creditFee}
      </label>
      {mode === "fee" && (
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>{t.feeLabel}</span>
          <input name="fee" inputMode="decimal" required className={`${field} h-9`} placeholder="0,00" />
        </label>
      )}
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>
        {pending ? t.crediting : t.creditButton}
      </button>
      {state.error && <p className="m-0 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}
