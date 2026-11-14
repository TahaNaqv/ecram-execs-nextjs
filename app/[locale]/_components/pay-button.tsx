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
}: {
  who: "guest" | "partner";
  reference: string;
  linkKey?: string;
  locale: string;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const [state, action, pending] = useActionState<PayState, FormData>(who === "guest" ? payBooking : payPartnerBooking, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name={who === "guest" ? "ref" : "reference"} value={reference} />
      {linkKey && <input type="hidden" name="k" value={linkKey} />}
      <input type="hidden" name="locale" value={locale} />
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
