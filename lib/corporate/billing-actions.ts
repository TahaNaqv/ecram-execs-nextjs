"use server";

import { refresh } from "next/cache";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { getCorporateContact } from "./access";
import { billingFromForm, billingSchema, saveBilling, type BillingField } from "./billing";

export type BillingState =
  | { status: "idle" }
  | { status: "ok"; notice: string }
  | { status: "error"; message: string; fieldErrors: Partial<Record<BillingField, string>>; values: Record<string, string> }
  | { status: "locked"; message: string };

/** The partner saves their own billing details on the portal. */
export async function savePartnerBilling(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const d = await dictionaryFromForm(formData);
  const t = d.portal.billing;
  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: d.corporatePartner.sessionExpired };
  const raw = billingFromForm(formData);
  const parsed = billingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<BillingField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as BillingField;
      fieldErrors[key] ??= (t.errors as Record<string, string>)[key] ?? t.failed;
    }
    return { status: "error", message: t.fixFields, fieldErrors, values: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ?? ""])) };
  }
  const ok = await saveBilling(contact.id, parsed.data).catch((err) => {
    console.error("[portal] billing save failed", err);
    return false;
  });
  if (!ok) return { status: "error", message: t.failed, fieldErrors: {}, values: {} };
  refresh();
  return { status: "ok", notice: t.saved };
}
