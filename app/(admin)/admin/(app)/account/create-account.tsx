"use client";

import { useState } from "react";
import { useActionState } from "react";
import { ACCOUNT_AREAS, type AccountArea, type StaffRole } from "@/lib/admin/access";
import { btn, field, fieldLabel } from "../../_components/ui";
import { createTeamAccount, type CreateAccountState } from "./actions";

type Copy = {
  fullName: string;
  email: string;
  password: string;
  passwordHint: string;
  showPassword: string;
  hidePassword: string;
  role: string;
  permissions: string;
  owner: string;
  manager: string;
  staff: string;
  ownersAll: string;
  createAccount: string;
  createdPlain: string;
  exists: string;
  short: string;
  invalid: string;
  denied: string;
  handoff: string;
};

export function CreateAccountForm({ copy, labels }: { copy: Copy; labels: Record<AccountArea, string> }) {
  const [role, setRole] = useState<StaffRole>("staff");
  const [visible, setVisible] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, submit, pending] = useActionState(async (prev: CreateAccountState, formData: FormData) => {
    const next = await createTeamAccount(prev, formData);
    if (next.ok) {
      setRole("staff");
      setVisible(false);
      setFormKey((key) => key + 1);
    }
    return next;
  }, {});
  const error = state.error === "taken" ? copy.exists : state.error === "short" ? copy.short : state.error === "denied" ? copy.denied : state.error === "failed" ? copy.invalid : null;

  return (
    <form key={formKey} action={submit} className="flex flex-col gap-5 border-t border-zinc-100 px-5 py-5">
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.fullName}</span>
        <input name="name" required autoComplete="name" className={`${field} h-10`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.email}</span>
        <input name="email" type="email" required autoComplete="off" className={`${field} h-10`} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.password}</span>
        <div className="relative">
          <input name="temporaryPassword" type={visible ? "text" : "password"} required minLength={12} autoComplete="new-password" className={`${field} h-10 pr-16`} />
          <button
            type="button"
            onClick={() => setVisible((on) => !on)}
            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-1 text-[12px] font-medium text-zinc-800 underline-offset-2 hover:underline"
          >
            {visible ? copy.hidePassword : copy.showPassword}
          </button>
        </div>
        <p className="m-0 text-[13px] leading-snug text-zinc-600">{copy.passwordHint}</p>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className={fieldLabel}>{copy.role}</legend>
        {(["staff", "manager", "owner"] as const).map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm text-zinc-950">
            <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} className="accent-zinc-950" />
            {copy[value]}
          </label>
        ))}
      </fieldset>
      <fieldset key={role} className="m-0 flex flex-col gap-2.5 border-0 p-0">
        <legend className={fieldLabel}>{copy.permissions}</legend>
        {role === "owner" ? <p className="m-0 text-[13px] leading-snug text-zinc-700">{copy.ownersAll}</p> : null}
        {ACCOUNT_AREAS.map((area) => (
          <label key={area} className={`flex items-center gap-2.5 text-sm text-zinc-950 ${role === "owner" ? "opacity-70" : ""}`}>
            <input
              type="checkbox"
              name={`perm-${area}`}
              defaultChecked={role === "owner" || area === "enquiries" || area === "bookings"}
              disabled={role === "owner"}
              className="size-4 accent-zinc-950"
            />
            {labels[area]}
          </label>
        ))}
      </fieldset>
      {error ? <p role="alert" className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {state.ok ? <p role="status" className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{copy.createdPlain}</p> : null}
      <p className="m-0 text-[13px] leading-snug text-zinc-600">{copy.handoff}</p>
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>
        {copy.createAccount}
      </button>
    </form>
  );
}
