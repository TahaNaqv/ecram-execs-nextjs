"use client";

import { useActionState } from "react";
import { savePartnerBilling, type BillingState } from "@/lib/corporate/billing-actions";
import type { BillingDetails } from "@/lib/corporate/billing";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { submitClass } from "./corporate-styles";
import { Status } from "./corporate-ui";

type Copy = Dictionary["portal"]["billing"];
type Field = "street" | "postcode" | "city" | "country" | "vatNumber" | "invoiceEmail";

const labelClass = "flex w-full box-border flex-col gap-2 text-[11px] tracking-[0.2em] text-ink-600 uppercase";
const inputClass =
  "w-full box-border border border-solid border-ink-225 bg-white p-3 text-[15px] tracking-normal text-ink-950 placeholder:text-[#7d93c4] normal-case aria-invalid:border-error";

/** The partner's billing details. Saving them lets the bookings that were waiting on them be invoiced. */
export function BillingForm({ locale, initial, loginEmail, copy: t }: { locale: Locale; initial: BillingDetails; loginEmail: string; copy: Copy }) {
  const [state, action, pending] = useActionState<BillingState, FormData>(savePartnerBilling, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};
  const value = (key: Field) => (state.status === "error" && key in state.values ? state.values[key] : initial[key]);

  const input = (key: Field, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={labelClass}>
      {label}
      <input
        name={key}
        defaultValue={value(key)}
        aria-invalid={!!err[key]}
        aria-describedby={err[key] ? `b-${key}-error` : undefined}
        className={inputClass}
        {...props}
      />
      {err[key] && (
        <span id={`b-${key}-error`} className="text-[12px] tracking-normal text-error normal-case">
          {err[key]}
        </span>
      )}
    </label>
  );

  return (
    <form action={action} noValidate className="flex w-full max-w-[640px] box-border flex-col gap-4">
      {input("street", t.street, { autoComplete: "street-address", required: true, maxLength: 200 })}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {input("postcode", t.postcode, { autoComplete: "postal-code", required: true, maxLength: 20 })}
        {input("city", t.city, { autoComplete: "address-level2", required: true, maxLength: 100 })}
      </div>
      {input("country", t.country, { autoComplete: "country", maxLength: 2, placeholder: "NL" })}
      {input("vatNumber", t.vatNumber, { maxLength: 30, placeholder: "NL123456789B01" })}
      {input("invoiceEmail", t.invoiceEmail, { type: "email", autoComplete: "email", maxLength: 254, placeholder: loginEmail })}
      <p className="m-0 text-[13px] text-ink-600">{interpolate(t.invoiceEmailNote, { email: loginEmail })}</p>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? t.saving : t.save}
      </button>
      <Status error={state.status === "error" || state.status === "locked"}>
        {state.status === "ok" ? state.notice : state.status === "error" || state.status === "locked" ? state.message : undefined}
      </Status>
    </form>
  );
}
