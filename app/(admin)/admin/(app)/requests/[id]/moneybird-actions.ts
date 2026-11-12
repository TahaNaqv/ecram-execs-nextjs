"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { creditBooking, syncBooking } from "@/lib/moneybird/sync";

export type MoneybirdState = { ok?: boolean; error?: string };

/** Tries the booking's invoice again (Moneybird was down, or a partner has since filled in their billing address). */
export async function retryInvoice(_prev: MoneybirdState, formData: FormData): Promise<MoneybirdState> {
  await requireAdmin();
  const t = (await adminDictionary()).admin.moneybird;
  const id = z.uuid().safeParse(formData.get("requestId"));
  if (!id.success) return { error: t.failed };
  // "Make the invoice" on a booking approved before Moneybird was connected: the team asks for it, so it is made
  const result = await syncBooking(id.data, { force: formData.get("force") === "1" });
  refresh();
  if (result.status === "busy") return { error: t.busy };
  if (result.status === "failed") return { error: t.failed };
  return { ok: true };
}

/**
 * Credits the sent invoice of a cancelled booking: in full, or keeping a cancellation fee the team enters (the client,
 * 13 Nov 2026: the team chooses; nothing is credited until they do).
 */
export async function creditInvoice(_prev: MoneybirdState, formData: FormData): Promise<MoneybirdState> {
  const admin = await requireAdmin();
  const t = (await adminDictionary()).admin.moneybird;
  const input = z
    .object({
      requestId: z.uuid(),
      mode: z.enum(["full", "fee"]),
      fee: z.string().trim().max(12).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: t.failed };
  let feeCents = 0;
  if (input.data.mode === "fee") {
    const euros = Number((input.data.fee ?? "").replace(",", "."));
    if (!Number.isFinite(euros) || euros <= 0) return { error: t.feeInvalid };
    feeCents = Math.round(euros * 100);
  }
  const result = await creditBooking(input.data.requestId, feeCents, admin.id);
  refresh();
  if (result.status === "busy") return { error: t.busy };
  if (result.status === "failed") {
    return { error: result.error === "not_cancelled" ? t.notCancelled : result.error === "fee_too_high" ? t.feeTooHigh : t.failed };
  }
  return { ok: true };
}
