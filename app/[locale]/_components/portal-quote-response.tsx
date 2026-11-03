"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { respondToQuote } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import type { Locale } from "@/lib/i18n/config";
import { ghostClass } from "./corporate-styles";
import { Status } from "./corporate-ui";

/** Literal colours: inside the dark blue theme panel, buttons and text use crisp contrast. */
const acceptButton =
  "quote-accept box-border inline-flex min-h-[56px] w-full max-w-[260px] cursor-pointer items-center justify-center border border-solid border-[#0b1f4d] bg-[#0b1f4d] px-6 font-sans text-[12px] font-semibold tracking-[0.24em] text-[#ffffff] uppercase hover:border-[#16357a] hover:bg-[#16357a] disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70";
const declineButton =
  "box-border inline-flex min-h-[56px] cursor-pointer items-center justify-center border border-solid border-[#0b1f4d] bg-transparent px-6 font-sans text-[12px] font-semibold tracking-[0.2em] text-[#0b1f4d] uppercase no-underline hover:bg-[#0b1f4d]/5 disabled:cursor-progress disabled:opacity-60";

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
    <section aria-labelledby="quote-title" className="flex flex-col gap-4 border border-[#e6dec9] bg-[#fdfbf7] p-6 text-[#0b1f4d] rounded-2xl shadow-sm">
      <h3 id="quote-title" className="m-0 font-serif text-[24px] font-normal leading-[1.15] text-[#0b1f4d]">
        {t.quoteReadyTitle}
      </h3>
      <p className="m-0 text-[15px] text-[#16357a]">{t.quoteReadyNote}</p>
      <p className="m-0 text-[13px] tracking-[0.18em] text-[#24458f] uppercase">
        {t.labelQuote} <strong className="ml-2 text-[22px] font-semibold tracking-normal text-[#0b1f4d] normal-case">{amountLabel}</strong>
      </p>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="reference" value={reference} />
        <input type="hidden" name="amount" value={amount} />
        <input type="hidden" name="locale" value={locale} />
        {declining && (
          <label className="flex flex-col gap-2 text-[11px] tracking-[0.2em] text-[#24458f] uppercase">
            {t.declineReasonLabel}
            <textarea
              name="reason"
              rows={3}
              maxLength={500}
              placeholder="Optional reason for declining..."
              className="box-border w-full resize-y rounded-xl border border-solid border-[#16357a]/40 bg-[#0b1f4d] p-3 text-[15px] tracking-normal text-white normal-case placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-[#0b1f4d]/40"
            />
          </label>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {declining ? (
            <>
              <button type="submit" name="intent" value="decline" disabled={pending} className={declineButton}>
                {pending ? t.declining : t.declineConfirmCta}
              </button>
              <button type="button" onClick={() => setDeclining(false)} className={declineButton}>
                {t.declineBack}
              </button>
            </>
          ) : (
            <>
              <button type="submit" name="intent" value="accept" disabled={pending} className={acceptButton}>
                {pending ? t.accepting : t.acceptCta}
              </button>
              <button type="button" onClick={() => setDeclining(true)} className={declineButton}>
                {t.declineCta}
              </button>
            </>
          )}
        </div>
        <Status error={state.status === "error" || state.status === "locked"}>
          {state.status === "error" || state.status === "locked" ? state.message : state.status === "ok" ? state.notice : undefined}
        </Status>
        {state.status === "locked" && (
          <Link href={loginHref} className={`${ghostClass} !text-[#0b1f4d] hover:!text-[#0b1f4d]`}>
            {t.loginLink}
          </Link>
        )}
      </form>
    </section>
  );
}