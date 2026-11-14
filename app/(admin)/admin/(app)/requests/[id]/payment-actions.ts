"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { mollieConfig } from "@/lib/mollie/config";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { refreshPayment, refundPayment } from "@/lib/mollie/pay";

export type PaymentActionState = { ok?: boolean; error?: string };

/** Asks Mollie about each of the booking's payments again (and their refunds). */
export async function checkPayments(_prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  await requireAdmin();
  const t = (await adminDictionary()).admin.payments;
  const id = z.uuid().safeParse(formData.get("requestId"));
  if (!id.success) return { error: t.failed };
  const mode = mollieConfig()?.mode;
  if (!mode) return { error: t.failed };
  // Only payments of the key's own mode: Mollie does not know the others
  const rows = await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(and(eq(schema.payments.requestId, id.data), eq(schema.payments.mode, mode)));
  let failed = false;
  for (const row of rows) {
    await refreshPayment(row.id).catch(() => {
      failed = true;
    });
  }
  refresh();
  return failed ? { error: t.failed } : { ok: true };
}

/** The team gives money back through Mollie, for a cancelled booking (an amount in euros, at most what is left to refund). */
export async function refundAction(_prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  const admin = await requireAdmin();
  const t = (await adminDictionary()).admin.payments;
  const input = z.object({ paymentId: z.uuid(), amount: z.string().trim().max(12) }).safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: t.failed };
  const euros = Number(input.data.amount.replace(",", "."));
  if (!Number.isFinite(euros) || euros <= 0) return { error: t.refundInvalid };
  const result = await refundPayment(input.data.paymentId, Math.round(euros * 100), admin.id);
  refresh();
  if (result.status === "done") return { ok: true };
  const messages: Record<string, string> = {
    too_much: t.refundTooMuch,
    not_cancelled: t.refundNotCancelled,
    busy: t.busy,
    mollie: t.refundMollie,
  };
  return { error: result.error === "mollie" && result.detail ? `${t.refundMollie} (${result.detail})` : (messages[result.error] ?? t.failed) };
}
