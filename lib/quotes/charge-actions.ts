"use server";

import { refresh } from "next/cache";
import { acceptCharge } from "@/lib/admin/charges";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { getGuestBooking } from "@/lib/quotes/guest";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

/**
 * The guest agrees, on their booking page, that the card saved for the balance also pays the close protection added to
 * their booking (lib/admin/charges.ts). The private link's key is checked again here.
 */
export async function acceptChargeAction(_prev: { done?: boolean; error?: string }, formData: FormData): Promise<{ done?: boolean; error?: string }> {
  const t = (await dictionaryFromForm(formData)).guestBooking;
  const { ipHash } = await visitor();
  if (!withinLimit(`charge:ip:${ipHash}`, 10, 10 * 60_000)) return { error: t.payTooMany };
  const booking = await getGuestBooking(formData.get("ref"), formData.get("k"));
  const chargeId = String(formData.get("chargeId") ?? "");
  if (!booking || !/^[0-9a-f-]{36}$/i.test(chargeId)) return { error: t.cpAcceptFailed };
  const ok = await acceptCharge(booking.id, chargeId);
  if (!ok) return { error: t.cpAcceptFailed };
  refresh();
  return { done: true };
}
