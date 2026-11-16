"use client";

import { useActionState } from "react";
import { payBooking, payPartnerBooking, type PayState } from "@/lib/mollie/actions";

/**
 * "Pay €X now": opens Mollie's payment page for an approved booking. For a website guest (`guest`, with the private link's
 * reference and key) or a partner in the portal (`partner`, by reference: the action checks the signed-in partner).
 */
export function PayButton({
  who,
  reference,
  linkKey,
  locale,
  label,
  pendingLabel,
  className,
  consent,
}: {
  who: "guest" | "partner";
  reference: string;
  linkKey?: string;
  locale: string;
  label: string;
  pendingLabel: string;
  className: string;
  /** The payment at booking saves the card: the customer ticks this first (the terms, the fee, the later charge) */
  consent?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<PayState, FormData>(who === "guest" ? payBooking : payPartnerBooking, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name={who === "guest" ? "ref" : "reference"} value={reference} />
      {linkKey && <input type="hidden" name="k" value={linkKey} />}
      <input type="hidden" name="locale" value={locale} />
      {consent && (
        <label className="flex max-w-[520px] items-start gap-2.5 text-[14px] leading-snug text-ink-800">
          <input type="checkbox" name="consent" value="1" required className="mt-0.5 size-4 shrink-0 accent-ink-950" />
          <span>{consent}</span>
        </label>
      )}
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      {(state.error || state.notice) && (
        <p aria-live="polite" className={`m-0 text-[13px] ${state.error ? "text-error" : "text-ink-700"}`}>
          {state.error ?? state.notice}
        </p>
      )}
    </form>
  );
}
