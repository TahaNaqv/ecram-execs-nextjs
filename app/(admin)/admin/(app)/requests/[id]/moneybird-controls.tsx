"use client";

import { useActionState, useEffect, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { pushToast, useActionNotice } from "../../../_components/action-feedback";
import { creditInvoice, reissueInvoice, retryInvoice, type MoneybirdState } from "./moneybird-actions";

type Copy = Dictionary["admin"]["moneybird"];

export type MockReceiptLabels = {
  openInMoneybird: string;
  viewInvoice: string;
  downloadReceipt: string;
  viewReceipt: string;
  close: string;
  receiptTitle: string;
  reference: string;
  passenger: string;
  journey: string;
  total: string;
};

/** Action buttons for mock Moneybird invoices that open the receipt modal or endpoint */
export function MockInvoiceReceiptActions({
  reference,
  clientName,
  clientEmail,
  clientPhone,
  pickup,
  dropoff,
  vehicle,
  total,
  status,
  receiptEndpoint,
  labels,
}: {
  requestId: string;
  reference: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  vehicle?: string | null;
  total: string;
  status: string;
  receiptEndpoint: string;
  labels: MockReceiptLabels;
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className={`${btn.base} ${btn.secondary} ${btn.sm}`}
          title={labels.viewReceipt}
        >
          {labels.viewInvoice}
        </button>
        <a
          href={receiptEndpoint}
          target="_blank"
          rel="noreferrer"
          className={`${btn.base} ${btn.secondary} ${btn.sm}`}
          title={labels.downloadReceipt}
        >
          {labels.openInMoneybird}
        </a>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h3 id="receipt-modal-title" className="m-0 text-base font-semibold text-zinc-900">
                  {labels.receiptTitle}
                </h3>
                <p className="m-0 text-xs text-zinc-500">
                  {labels.reference}: <span className="font-mono font-medium text-zinc-900">{reference}</span> · {status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none"
                aria-label={labels.close}
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex flex-col gap-4 overflow-y-auto p-6 text-sm">
              <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-4">
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="font-medium text-zinc-500">{labels.passenger}</span>
                    <p className="m-0 mt-0.5 font-semibold text-zinc-900">{clientName}</p>
                    {clientEmail && <p className="m-0 text-zinc-600">{clientEmail}</p>}
                    {clientPhone && <p className="m-0 text-zinc-600">{clientPhone}</p>}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-500">{labels.journey}</span>
                    {pickup && (
                      <p className="m-0 mt-0.5 text-zinc-900">
                        <strong className="text-zinc-500">From:</strong> {pickup}
                      </p>
                    )}
                    {dropoff && (
                      <p className="m-0 text-zinc-900">
                        <strong className="text-zinc-500">To:</strong> {dropoff}
                      </p>
                    )}
                    {vehicle && <p className="m-0 text-zinc-600">{vehicle}</p>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-b border-zinc-100 py-3">
                <span className="text-sm font-medium text-zinc-600">{labels.total}</span>
                <span className="text-lg font-semibold tabular-nums text-zinc-950">{total}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/60 px-6 py-3.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`${btn.base} ${btn.secondary} ${btn.sm}`}
              >
                {labels.close}
              </button>
              <a
                href={receiptEndpoint}
                target="_blank"
                rel="noreferrer"
                className={`${btn.base} ${btn.primary} ${btn.sm}`}
              >
                {labels.downloadReceipt} (PDF)
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ReissueButton({ requestId, copy: t }: { requestId: string; copy: Copy }) {
  const [state, action, pending] = useActionState<MoneybirdState, FormData>(reissueInvoice, {});
  useActionNotice(state, "Invoice request synced!");
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>
        {pending ? t.syncing : t.syncInvoice}
      </button>
      {state.ok && <p className="m-0 text-xs text-emerald-700">{t.synced}</p>}
      {state.error && <p className="m-0 text-xs text-red-700">{state.error}</p>}
    </form>
  );
}

export function RetryButton({ requestId, copy: t, force = false }: { requestId: string; copy: Copy; force?: boolean }) {
  const [state, action, pending] = useActionState<MoneybirdState, FormData>(retryInvoice, {});
  useActionNotice(state, "Invoice request synced!");
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
export function CreditForm({ requestId, copy: t, paid, total, serviceFee }: { requestId: string; copy: Copy; paid: boolean; total: string; serviceFee?: string }) {
  const [state, action, pending] = useActionState<MoneybirdState, FormData>(creditInvoice, {});
  useActionNotice(state, "Invoice updated!");
  // Paid at booking: the service fee is not refunded when the customer cancels, so that is the first choice
  const [mode, setMode] = useState<"full" | "fee" | "serviceFee">(serviceFee ? "serviceFee" : "full");
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <p className="m-0 text-[13px] font-semibold text-zinc-950">{t.creditTitle}</p>
        <p className="m-0 mt-0.5 text-xs text-zinc-500">{paid ? interpolate(t.creditNotePaid, { total }) : t.creditNote}</p>
      </div>
      {serviceFee && (
        <label className="flex items-center gap-2 text-[13px] text-zinc-800">
          <input type="radio" name="mode" value="serviceFee" checked={mode === "serviceFee"} onChange={() => setMode("serviceFee")} />
          {interpolate(t.creditServiceFee, { fee: serviceFee })}
        </label>
      )}
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
