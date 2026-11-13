"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/lib/db";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { phoneLengthOk } from "@/lib/phone";
import { getCorporateContact } from "./access";
import { billingFromForm, billingSchema, saveBilling, type BillingField } from "./billing";

export type BillingState =
  | { status: "idle" }
  | { status: "ok"; notice: string }
  | { status: "error"; message: string; fieldErrors: Partial<Record<BillingField | "phone", string>>; values: Record<string, string> }
  | { status: "locked"; message: string };

/** The partner saves their own billing details on the portal. */
export async function savePartnerBilling(_prev: BillingState, formData: FormData): Promise<BillingState> {
  const d = await dictionaryFromForm(formData);
  const t = d.portal.billing;
  const contact = await getCorporateContact();
  if (!contact) return { status: "locked", message: d.corporatePartner.sessionExpired };
  const raw = billingFromForm(formData);
  const phoneCountry = String(formData.get("phoneCountry") ?? "31").replace(/^\+/, "");
  const phone = String(formData.get("phone") ?? "");
  const values = { ...Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v ?? ""])), phoneCountry, phone };
  if (!phoneLengthOk(phoneCountry, phone)) {
    return { status: "error", message: t.fixFields, fieldErrors: { phone: t.errors.phone }, values };
  }
  const parsed = billingSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<BillingField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as BillingField;
      fieldErrors[key] ??= (t.errors as Record<string, string>)[key] ?? t.failed;
    }
    return { status: "error", message: t.fixFields, fieldErrors, values };
  }
  const ok = await saveBilling(contact.id, parsed.data)
    .then(async (saved) => {
      if (!saved) return false;
      await db
        .update(schema.corporateContacts)
        .set({ phone: `+${phoneCountry} ${phone.replace(/\D/g, "")}`, updatedAt: new Date() })
        .where(eq(schema.corporateContacts.id, contact.id));
      return true;
    })
    .catch((err) => {
      console.error("[portal] billing save failed", err);
      return false;
    });
  if (!ok) return { status: "error", message: t.failed, fieldErrors: {}, values: {} };
  refresh();
  return { status: "ok", notice: t.saved };
}
