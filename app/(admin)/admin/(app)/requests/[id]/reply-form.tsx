"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { AlertIcon, CheckIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { markMessagesSeen, replyToCustomer, type ReplyState } from "./portal-actions";

/** The team's reply to the customer: a partner, or a website visitor through their booking's page. */
export function ReplyForm({ requestId, copy }: { requestId: string; copy: { label: string; placeholder: string; send: string; sending: string; sent: string } }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyToCustomer, {});
  const form = useRef<HTMLFormElement>(null);
  // A sent reply empties the box and pulls the new message into the thread
  useEffect(() => {
    if (!state.ok) return;
    form.current?.reset();
    router.refresh();
  }, [state.ok, router]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="reply-body" className={fieldLabel}>
        {copy.label}
      </label>
      <textarea id="reply-body" name="body" rows={4} maxLength={2000} placeholder={copy.placeholder} aria-invalid={state.error ? true : undefined} className={`${field} resize-y py-2.5 leading-relaxed`} />
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md}`}>
          {pending ? copy.sending : copy.send}
        </button>
        <span aria-live="polite" className="text-[13px]">
          {state.ok && !pending && (
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <CheckIcon size={14} /> {copy.sent}
            </span>
          )}
        </span>
      </div>
    </form>
  );
}

/** Opening a request marks its partner messages as read. Rendered only while some are unread. */
export function MarkSeen({ requestId }: { requestId: string }) {
  useEffect(() => {
    void markMessagesSeen(requestId);
  }, [requestId]);
  return null;
}
