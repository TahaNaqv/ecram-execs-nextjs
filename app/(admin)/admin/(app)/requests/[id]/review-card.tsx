"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { AlertIcon, CheckIcon } from "../../../_components/icons";
import { btn, Card, CardHeader, field, fieldLabel } from "../../../_components/ui";
import { discussBooking, type DiscussState } from "./portal-actions";

type Copy = Dictionary["admin"]["review"];

/**
 * Every booking is reviewed by hand (the client, 8 Nov 2026). Approving confirms it through the same route as the status
 * menu (the fleet lock and the clash check, an email to the customer); "Discuss further" writes to the customer and puts
 * the booking in discussion. The customer's open page moves on by itself either way.
 */
export function ReviewCard({ requestId, status, copy: t }: { requestId: string; status: string; copy: Copy }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discussing, setDiscussing] = useState(false);
  const [state, action, pending] = useActionState<DiscussState, FormData>(discussBooking, {});

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
        router.refresh();
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
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={approve} disabled={approving || approved} className={`${btn.base} ${btn.md} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60`}>
            <CheckIcon size={14} /> {approving ? t.approving : t.approve}
          </button>
          {!discussing && (
            <button type="button" onClick={() => setDiscussing(true)} disabled={approved} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
              {t.discuss}
            </button>
          )}
          <span aria-live="polite" className="text-[13px]">
            {approved && (
              <span className="inline-flex items-center gap-1.5 text-emerald-700">
                <CheckIcon size={14} /> {t.approved}
              </span>
            )}
          </span>
        </div>
        {error && (
          <p role="alert" className="m-0 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
            <AlertIcon className="mt-0.5 shrink-0" />
            {error}
          </p>
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
