"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { publishBookingStatus } from "../../../_components/booking-status";
import { refreshOnce } from "../../../_components/refresh-once";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { AlertIcon, CheckIcon } from "../../../_components/icons";
import { btn, Card, CardHeader, field, fieldLabel } from "../../../_components/ui";
import { discussBooking, type DiscussState } from "./portal-actions";
import { declineAction, type PaymentActionState } from "./payment-actions";

type Copy = Dictionary["admin"]["review"];

/**
 * Every booking is reviewed by hand (the client, 8 Nov 2026). Approving confirms it through the same route as the status
 * menu (the fleet lock and the clash check, an email to the customer); "Discuss further" writes to the customer and puts
 * the booking in discussion. The customer's open page moves on by itself either way.
 */
/** What the customer has paid online so far, on a booking paid at booking (null: not paid at booking). */
export type PayState = { kind: "unpaid" | "fee" | "full"; paid: string; rest?: string; restOn?: string } | null;

export type FulfilmentView = { ok: true } | { ok: false; reference: string; pending: boolean };

export function ReviewCard({
  requestId,
  status,
  copy: t,
  pay,
  fulfilment,
  canApprove = true,
}: {
  requestId: string;
  status: string;
  copy: Copy;
  pay?: PayState;
  fulfilment?: FulfilmentView | null;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [askApprove, setAskApprove] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discussing, setDiscussing] = useState(false);
  const [state, action, pending] = useActionState<DiscussState, FormData>(discussBooking, {});
  const [declining, setDeclining] = useState(false);
  const [declined, declineFormAction, declinePending] = useActionState<PaymentActionState, FormData>(declineAction, {});

  useEffect(() => {
    if (declined.ok) publishBookingStatus(requestId, "cancelled");
  }, [declined.ok, requestId]);

  useEffect(() => {
    if (state.ok) publishBookingStatus(requestId, "contacted");
  }, [state.ok, requestId]);

  async function approve() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/authorise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed", sendMail: true }),
      });
      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { clash?: string; error?: string };
        const reference = data.clash ?? data.error?.match(/EE-[A-Z0-9]{6}/)?.[0] ?? "";
        setError(interpolate(t.clash, { reference }));
      } else if (!res.ok) {
        setError(t.failed);
      } else {
        setApproved(true);
        publishBookingStatus(requestId, "confirmed");
        refreshOnce(router);
      }
    } catch {
      setError(t.failed);
    } finally {
      setApproving(false);
    }
  }

  return (
    <Card>
      <CardHeader title={t.title} description={t.note} />
      <div className="flex flex-col gap-4 p-5">
        {fulfilment && (
          <p className={`m-0 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset ${fulfilment.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-amber-50 text-amber-950 ring-amber-200"}`}>
            {fulfilment.ok ? t.fulfilled : interpolate(fulfilment.pending ? t.unfulfilledPending : t.unfulfilled, { reference: fulfilment.reference })}
          </p>
        )}
        {pay && (
          <p className={`m-0 rounded-lg px-3 py-2.5 text-sm ring-1 ring-inset ${pay.kind === "unpaid" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200"}`}>
            {pay.kind === "unpaid"
              ? t.payUnpaid
              : pay.kind === "full"
                ? interpolate(t.payFull, { amount: pay.paid })
                : interpolate(t.payFee, { amount: pay.paid, rest: pay.rest ?? "" })}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {canApprove && (
            <button type="button" onClick={() => setAskApprove(true)} disabled={approving || approved} className={`${btn.base} ${btn.md} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60`}>
              <CheckIcon size={14} /> {approving ? t.approving : t.approve}
            </button>
          )}
          {!discussing && (
            <button type="button" onClick={() => setDiscussing(true)} disabled={approved} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
              {t.discuss}
            </button>
          )}
          {!declining && !approved && !declined.ok && (
            <button type="button" onClick={() => setDeclining(true)} className={`${btn.base} ${btn.ghost} ${btn.md} text-red-700`}>
              {pay && pay.kind !== "unpaid" ? t.declineRefund : t.decline}
            </button>
          )}
          <span aria-live="polite" className="text-[13px]">
            {declined.ok && <span className="text-zinc-700">{t.declined}</span>}
            {approved && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckIcon size={14} /> {t.approved}
              </span>
            )}
          </span>
        </div>
        {askApprove && !approved && (
          <div className="flex flex-col gap-3 rounded-lg bg-emerald-50/70 p-4 ring-1 ring-inset ring-emerald-200" role="dialog" aria-modal="true" aria-labelledby="approve-title">
            <p id="approve-title" className="m-0 text-sm font-medium text-emerald-950">{t.approveConfirm}</p>
            <p className="m-0 text-sm text-emerald-900">{t.approveConfirmNote}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => { setAskApprove(false); void approve(); }} disabled={approving} className={`${btn.base} ${btn.md} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60`}>
                {approving ? t.approving : t.approveGo}
              </button>
              <button type="button" onClick={() => setAskApprove(false)} className={`${btn.base} ${btn.ghost} ${btn.md}`}>{t.cancel}</button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            <AlertIcon className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}
        {declining && !declined.ok && (
          <form action={declineFormAction} className="flex flex-col gap-3 rounded-lg bg-red-50/60 p-4 ring-1 ring-inset ring-red-200">
            <input type="hidden" name="requestId" value={requestId} />
            <p className="m-0 text-sm text-red-900">{pay && pay.kind !== "unpaid" ? interpolate(t.declineConfirmRefund, { amount: pay.paid }) : t.declineConfirm}</p>
            <label htmlFor="decline-reason" className={fieldLabel}>{t.declineReason}</label>
            <textarea id="decline-reason" name="reason" rows={3} maxLength={500} placeholder={t.declineReasonPlaceholder} className={`${field} resize-y py-2.5 leading-relaxed`} />
            {declined.error && (
              <p role="alert" className="m-0 text-sm text-red-800">
                {declined.error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={declinePending} className={`${btn.base} ${btn.md} bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:opacity-60`}>
                {declinePending ? t.declining : pay && pay.kind !== "unpaid" ? t.declineRefund : t.decline}
              </button>
              <button type="button" onClick={() => setDeclining(false)} className={`${btn.base} ${btn.ghost} ${btn.md}`}>
                {t.cancel}
              </button>
            </div>
          </form>
        )}
        {discussing && !approved && (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="seenStatus" value={status} />
            <label htmlFor="discuss-body" className={fieldLabel}>
              {t.discussLabel}
            </label>
            <textarea id="discuss-body" name="body" rows={4} maxLength={2000} placeholder={t.discussPlaceholder} className={`${field} resize-y py-2.5 leading-relaxed`} />
            {state.error && (
              <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
                <AlertIcon className="mt-0.5 shrink-0" />
                {state.error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md}`}>
                {pending ? t.discussSending : t.discussSend}
              </button>
              <button type="button" onClick={() => setDiscussing(false)} className={`${btn.base} ${btn.ghost} ${btn.md}`}>
                {t.cancel}
              </button>
              <span aria-live="polite" className="text-[13px]">
                {state.ok && !pending && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <CheckIcon size={14} /> {t.discussSent}
                  </span>
                )}
              </span>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
