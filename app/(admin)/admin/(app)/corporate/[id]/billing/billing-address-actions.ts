"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { billingFromForm, billingSchema, saveBilling } from "@/lib/corporate/billing";
import { adminDictionary } from "@/lib/i18n/get-dictionary";

export type AdminBillingState = { ok?: boolean; error?: string };

/** The team fills in or corrects a partner's billing details (the partner can do the same on the portal). */
export async function saveAdminBilling(_prev: AdminBillingState, formData: FormData): Promise<AdminBillingState> {
  await requireAdmin();
  const t = (await adminDictionary()).admin.moneybird;
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: t.billingFailed };
  const parsed = billingSchema.safeParse(billingFromForm(formData));
  if (!parsed.success) return { error: t.billingInvalid };
  const ok = await saveBilling(id.data, parsed.data).catch((err) => {
    console.error("[admin] billing save failed", err);
    return false;
  });
  if (!ok) return { error: t.billingFailed };
  revalidatePath(`/admin/corporate/${id.data}/billing`);
  return { ok: true };
}
