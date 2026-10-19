"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { respondToQuote } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import type { Locale } from "@/lib/i18n/config";
import { ghostClass, outlineButton, submitClass } from "./corporate-styles";
import { Status } from "./corporate-ui";

export type QuoteResponseCopy = Record<
  "quoteReadyTitle" | "quoteReadyNote" | "labelQuote" | "acceptCta" | "declineCta" | "declineReasonLabel" | "declineConfirmCta" | "declineBack" | "accepting" | "declining" | "loginLink",
  string
>;

/**
 * Accept or decline the quote. What is sent back is the amount the partner was looking at: the server only applies the
 * answer if the booking is still quoted at exactly that amount.
 */
export function QuoteResponse({
  reference,
  amount,
  amountLabel,
  locale,
  loginHref,
  copy: t,
}: {
  reference: string;
  amount: string;
  amountLabel: string;
  locale: Locale;
  loginHref: string;
  copy: QuoteResponseCopy;
}) {
  const [declining, setDeclining] = useState(false);
  const [state, action, pending] = useActionState<PortalState, FormData>(respondToQuote, { status: "idle" });

  return (
    <section aria-labelledby="quote-title" className="flex flex-col gap-4 border border-amber-300 bg-amber-50 p-6">
      <h3 id="quote-title" className="m-0 font-serif text-[24px] font-normal leading-[1.15] text-ink-950">
        {t.quoteReadyTitle}
      </h3>
      <p className="m-0 text-[15px] text-ink-700">{t.quoteReadyNote}</p>
      <p className="m-0 text-[13px] tracking-[0.18em] text-ink-600 uppercase">
        {t.labelQuote} <strong className="ml-2 text-[22px] font-semibold tracking-normal text-ink-950 normal-case">{amountLabel}</strong>
      </p>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="amount" value={amount} />
        <input type="hidden" name="locale" value={locale} />
        {declining && (
          <label className="flex flex-col gap-2 text-[11px] tracking-[0.2em] text-ink-600 uppercase">
            {t.declineReasonLabel}
            <textarea name="reason" rows={3} maxLength={500} className="w-full resize-y border border-solid border-ink-225 bg-white p-3 text-[15px] tracking-normal text-ink-950 normal-case" />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {declining ? (
            <>
              <button type="submit" name="intent" value="decline" disabled={pending} className={`${outlineButton} cursor-pointer`}>
                {pending ? t.declining : t.declineConfirmCta}
              </button>
              <button type="button" onClick={() => setDeclining(false)} className={ghostClass}>
                {t.declineBack}
              </button>
            </>
          ) : (
            <>
              <button type="submit" name="intent" value="accept" disabled={pending} className={`${submitClass} max-w-[260px]`}>
                {pending ? t.accepting : t.acceptCta}
              </button>
              <button type="button" onClick={() => setDeclining(true)} className={ghostClass}>
                {t.declineCta}
              </button>
            </>
          )}
        </div>
        <Status error={state.status === "error" || state.status === "locked"}>
          {state.status === "error" || state.status === "locked" ? state.message : state.status === "ok" ? state.notice : undefined}
        </Status>
        {state.status === "locked" && (
          <Link href={loginHref} className={ghostClass}>
            {t.loginLink}
          </Link>
        )}
      </form>
    </section>
  );
}
