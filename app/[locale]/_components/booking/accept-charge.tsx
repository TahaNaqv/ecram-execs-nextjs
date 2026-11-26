"use client";

import { useActionState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { acceptChargeAction } from "@/lib/quotes/charge-actions";

/** Close protection added after booking: the guest agrees to the saved card paying it with the balance. */
export function AcceptCharge({
  reference,
  linkKey,
  locale,
  chargeId,
  text,
  button,
  done,
}: {
  reference: string;
  linkKey: string;
  locale: Locale;
  chargeId: string;
  text: string;
  button: string;
  done: string;
}) {
  const [state, action, pending] = useActionState(acceptChargeAction, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[16px] border border-solid border-ink-150 bg-white p-5 text-ink-950">
      <input type="hidden" name="ref" value={reference} />
      <input type="hidden" name="k" value={linkKey} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="chargeId" value={chargeId} />
      <p className="m-0 text-[15px]">{text}</p>
      {state.done ? (
        <p role="status" className="m-0 text-[14px] font-semibold">{done}</p>
      ) : (
        <button disabled={pending} className="self-start rounded-full bg-ink-950 px-6 py-3 text-[12px] font-semibold tracking-[0.2em] text-white uppercase hover:bg-ink-800 disabled:opacity-60">
          {button}
        </button>
      )}
      {state.error ? <p role="alert" className="m-0 text-[14px] text-red-700">{state.error}</p> : null}
    </form>
  );
}
