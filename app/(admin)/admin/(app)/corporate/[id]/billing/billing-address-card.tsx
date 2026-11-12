"use client";

import { useActionState } from "react";
import type { BillingDetails } from "@/lib/corporate/billing";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { btn, Card, CardHeader, field, fieldLabel } from "../../../../_components/ui";
import { saveAdminBilling, type AdminBillingState } from "./billing-address-actions";

type Copy = Dictionary["admin"]["moneybird"];

/** The partner's billing details as their Moneybird invoices carry them. Street, postcode and city are needed to invoice. */
export function BillingAddressCard({ partnerId, initial, copy: t }: { partnerId: string; initial: BillingDetails; copy: Copy }) {
  const [state, action, pending] = useActionState<AdminBillingState, FormData>(saveAdminBilling, {});
  const row = (name: keyof BillingDetails, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>{label}</span>
      <input name={name} defaultValue={String(initial[name] ?? "")} className={`${field} h-9`} {...props} />
    </label>
  );
  return (
    <Card>
      <CardHeader title={t.billingTitle} description={initial.complete ? t.billingNote : t.billingIncomplete} />
      <form action={action} className="grid gap-4 p-5 sm:grid-cols-2">
        <input type="hidden" name="id" value={partnerId} />
        <div className="sm:col-span-2">{row("street", t.billingStreet, { required: true, maxLength: 200 })}</div>
        {row("postcode", t.billingPostcode, { required: true, maxLength: 20 })}
        {row("city", t.billingCity, { required: true, maxLength: 100 })}
        {row("country", t.billingCountry, { maxLength: 2, placeholder: "NL" })}
        {row("vatNumber", t.billingVat, { maxLength: 30 })}
        <div className="sm:col-span-2">{row("invoiceEmail", t.billingEmail, { type: "email", maxLength: 254 })}</div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md}`}>
            {pending ? t.billingSaving : t.billingSave}
          </button>
          {state.ok && <span className="text-xs text-emerald-700">{t.billingSaved}</span>}
          {state.error && <span className="text-xs text-red-700">{state.error}</span>}
        </div>
      </form>
    </Card>
  );
}
