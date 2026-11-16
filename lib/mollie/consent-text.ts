import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import type { PaymentView } from "./pay";

/** The tick beside the payment at booking: the terms, the service fee that is not refunded, and the card charged later. */
export function consentText(t: Dictionary["guestBooking"], payment: Pick<PaymentView, "rest">): string {
  return payment.rest ? interpolate(t.payConsentRest, { amount: payment.rest.label, date: payment.rest.on }) : t.payConsentFull;
}
