"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { sendBookingMessage } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import type { Locale } from "@/lib/i18n/config";
import { ghostClass, submitClass } from "./corporate-styles";
import { Status } from "./corporate-ui";

export type MessageFormCopy = Record<
  "messagesIntro" | "labelMessageKind" | "kindMessage" | "kindChange" | "kindCancel" | "labelMessage" | "phMessage" | "sendMessage" | "sendingMessage" | "loginLink",
  string
>;

/** Write to the team about a booking, or ask for a change or a cancellation. A request never alters the booking itself. */
export function MessageForm({ reference, locale, loginHref, copy: t }: { reference: string; locale: Locale; loginHref: string; copy: MessageFormCopy }) {
  // A new key after each sent message empties the form
  const [sent, setSent] = useState(0);
  const [state, action, pending] = useActionState<PortalState, FormData>(async (prev, formData) => {
    const next = await sendBookingMessage(prev, formData);
    if (next.status === "ok") setSent((n) => n + 1);
    return next;
  }, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};
  const kind = state.status === "error" ? state.values.kind : "message";

  return (
    <form key={sent} action={action} noValidate className="flex w-full box-border flex-col gap-4">
      <p className="m-0 text-[15px] text-ink-700">{t.messagesIntro}</p>
      <label className="flex w-full box-border flex-col gap-2 text-[11px] tracking-[0.2em] text-ink-600 uppercase">
        {t.labelMessageKind}
        <select name="kind" defaultValue={kind} className="w-full box-border border border-solid border-ink-225 bg-white p-3 text-[15px] tracking-normal text-ink-950 normal-case">
          <option value="message">{t.kindMessage}</option>
          <option value="change">{t.kindChange}</option>
          <option value="cancel">{t.kindCancel}</option>
        </select>
      </label>
      <label className="flex w-full box-border flex-col gap-2 text-[11px] tracking-[0.2em] text-ink-600 uppercase">
        {t.labelMessage}
        <textarea
          name="body"
          rows={4}
          maxLength={2100}
          placeholder={t.phMessage}
          aria-invalid={!!err.message}
          aria-describedby={err.message ? "m-body-error" : undefined}
          className="w-full box-border resize-y border border-solid border-ink-225 bg-white p-3 text-[15px] tracking-normal text-ink-950 placeholder:text-[#7d93c4] normal-case"
        />
        {err.message && (
          <span id="m-body-error" className="text-[12px] tracking-normal text-error normal-case">
            {err.message}
          </span>
        )}
      </label>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`${submitClass} max-w-[240px]`}>
          {pending ? t.sendingMessage : t.sendMessage}
        </button>
        {state.status === "locked" && (
          <Link href={loginHref} className={ghostClass}>
            {t.loginLink}
          </Link>
        )}
      </div>
      <Status error={state.status === "locked" || (state.status === "error" && !err.message)}>
        {state.status === "ok" ? state.notice : state.status === "locked" ? state.message : state.status === "error" && !err.message ? state.message : undefined}
      </Status>
    </form>
  );
}