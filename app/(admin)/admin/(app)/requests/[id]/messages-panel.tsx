"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { AlertIcon, CheckIcon } from "../../../_components/icons";
import { btn, field, fieldLabel } from "../../../_components/ui";
import { refreshOnce } from "../../../_components/refresh-once";
import { markMessagesSeen, replyToCustomer, type ReplyState } from "./portal-actions";

export type ThreadMessage = {
  id: string;
  authorKind: "partner" | "team" | "guest";
  kind: string;
  body: string;
  at: string;
  seen: boolean;
  by: string | null;
};

type Copy = {
  empty: string;
  replyLabel: string;
  replyPlaceholder: string;
  send: string;
  sending: string;
  sent: string;
  fromPartner: string;
  fromGuest: string;
  fromTeam: string;
  tagChange: string;
  tagCancel: string;
  unseen: string;
  unreadBadge: string;
};

const POLL_MS = 4_000;

/**
 * Live conversation on a request: polls for new customer/team messages, shows an optimistic
 * team bubble while a reply is in flight, and marks unread customer messages seen on open.
 */
export function MessagesPanel({
  requestId,
  messages,
  unread,
  copy: t,
}: {
  requestId: string;
  messages: ThreadMessage[];
  unread: number;
  copy: Copy;
}) {
  const router = useRouter();
  const [pendingBody, setPendingBody] = useState<string | null>(null);
  const [seenLocally, setSeenLocally] = useState(false);
  const latestId = messages[0]?.id ?? null;
  const fingerprint = `${latestId ?? ""}:${messages.length}:${unread}`;

  useEffect(() => {
    setPendingBody(null);
    setSeenLocally(false);
  }, [fingerprint]);

  // Mark customer messages read as soon as this thread is on screen. This does not refresh the page:
  // a refresh here restarts the Suspense stream, and the new render still looked unread until it landed.
  useEffect(() => {
    if (unread <= 0) return;
    let cancel = false;
    void markMessagesSeen(requestId).then(() => {
      if (!cancel) setSeenLocally(true);
    });
    return () => {
      cancel = true;
    };
  }, [requestId, unread]);

  // Refresh only when a new message exists. An unread-count change is this tab marking the thread read.
  useEffect(() => {
    let stopped = false;
    const ask = async () => {
      if (document.visibilityState === "hidden" || stopped) return;
      try {
        const res = await fetch(`/api/admin/requests/${requestId}/messages/state`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const now = (await res.json()) as { latestId?: string | null };
        if (typeof now.latestId === "string" && now.latestId !== latestId) refreshOnce(router);
      } catch {
        /* network blip — next tick retries */
      }
    };
    const timer = window.setInterval(ask, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [requestId, latestId, router]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Only the thread scrolls; the composer stays pinned at the card bottom. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-3">
        {messages.length === 0 && !pendingBody ? (
          <p className="m-0 text-sm text-zinc-500">{t.empty}</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {pendingBody && (
              <li className="rounded-lg border border-zinc-900/10 bg-zinc-50 p-3 opacity-80">
                <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <strong className="text-zinc-900">{t.fromTeam}</strong>
                  <span>{t.sending}</span>
                </p>
                <p className="mt-1.5 mb-0 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">{pendingBody}</p>
              </li>
            )}
            {messages.map((m) => {
              const partner = m.authorKind !== "team";
              return (
                <li key={m.id} className={`rounded-lg border p-3 ${partner ? "border-zinc-200 bg-white" : "border-zinc-900/10 bg-zinc-50"}`}>
                  <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                    <strong className="text-zinc-900">
                      {m.authorKind === "guest" ? t.fromGuest : partner ? t.fromPartner : (m.by ?? t.fromTeam)}
                    </strong>
                    {m.kind === "change" && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">{t.tagChange}</span>}
                    {m.kind === "cancel" && <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-800">{t.tagCancel}</span>}
                    {partner && !m.seen && !seenLocally && <span className="rounded bg-zinc-950 px-1.5 py-0.5 font-medium text-white">{t.unseen}</span>}
                    <span>{m.at}</span>
                  </p>
                  <p className="mt-1.5 mb-0 whitespace-pre-wrap wrap-break-word text-sm text-zinc-900">{m.body}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-3">
        <ReplyForm requestId={requestId} copy={t} onOptimistic={setPendingBody} />
      </div>
    </div>
  );
}

/** The team's reply to the customer: a partner, or a website visitor through their booking's page. */
export function ReplyForm({
  requestId,
  copy,
  onOptimistic,
}: {
  requestId: string;
  copy: Pick<Copy, "replyLabel" | "replyPlaceholder" | "send" | "sending" | "sent">;
  onOptimistic?: (body: string | null) => void;
}) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(replyToCustomer, {});
  const form = useRef<HTMLFormElement>(null);
  const sentToken = useRef(0);

  useEffect(() => {
    if (state.error) {
      onOptimistic?.(null);
      return;
    }
    if (!state.ok) return;
    sentToken.current += 1;
    form.current?.reset();
    onOptimistic?.(null);
    // replyToCustomer already calls refresh(). A second refresh from the browser aborts that stream.
  }, [state, onOptimistic]);

  return (
    <form
      ref={form}
      action={(fd) => {
        const body = String(fd.get("body") ?? "").trim();
        if (body) onOptimistic?.(body);
        action(fd);
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="reply-body" className={fieldLabel}>
        {copy.replyLabel}
      </label>
      <textarea
        id="reply-body"
        name="body"
        rows={2}
        maxLength={2000}
        placeholder={copy.replyPlaceholder}
        aria-invalid={state.error ? true : undefined}
        className={`${field} h-16 resize-none py-2 leading-relaxed`}
        disabled={pending}
      />
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
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
