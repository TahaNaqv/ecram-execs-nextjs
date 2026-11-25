"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { creditBooking, reissueBooking, syncBooking } from "@/lib/moneybird/sync";
import { flushPayments } from "@/lib/mollie/pay";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { feeWithVatCents } from "@/lib/payments/schedule";

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
      mode: z.enum(["full", "fee", "serviceFee"]),
      fee: z.string().trim().max(12).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: t.failed };
  let feeCents = 0;
  if (input.data.mode === "serviceFee") {
    // Keep the service fee paid at booking (non-refundable): exactly the fee's own invoice line is kept
    const [r] = await db.select({ price: schema.quoteRequests.priceEstimate }).from(schema.quoteRequests).where(eq(schema.quoteRequests.id, input.data.requestId)).limit(1);
    feeCents = feeWithVatCents(r?.price ?? null);
  } else if (input.data.mode === "fee") {
    const euros = Number((input.data.fee ?? "").replace(",", "."));
    if (!Number.isFinite(euros) || euros <= 0) return { error: t.feeInvalid };
    feeCents = Math.round(euros * 100);
  }
  // An online payment not yet in the books goes in first, so the credit does not settle an invoice that was paid
  await flushPayments(input.data.requestId).catch(() => null);
  const result = await creditBooking(input.data.requestId, feeCents, admin.id, { keepFeeLine: input.data.mode === "serviceFee" });
  refresh();
  if (result.status === "busy") return { error: t.busy };
  if (result.status === "failed") {
    return { error: result.error === "not_cancelled" ? t.notCancelled : result.error === "fee_too_high" ? t.feeTooHigh : result.error === "payment_not_recorded" ? t.paymentNotRecorded : result.error === "no_fee_line" ? t.noFeeLine : t.failed };
  }
  return { ok: true };
}

/** Credits the sent invoice and emails a new one in English for the booking's current total. */
export async function reissueInvoice(_prev: MoneybirdState, formData: FormData): Promise<MoneybirdState> {
  const admin = await requireAdmin();
  const t = (await adminDictionary()).admin.moneybird;
  const id = z.uuid().safeParse(formData.get("requestId"));
  if (!id.success) return { error: t.failed };
  await flushPayments(id.data).catch(() => null);
  const result = await reissueBooking(id.data, admin.id);
  refresh();
  if (result.status === "busy") return { error: t.busy };
  if (result.status === "failed") return { error: result.error === "payment_not_recorded" ? t.paymentNotRecorded : t.failed };
  return { ok: true };
}
