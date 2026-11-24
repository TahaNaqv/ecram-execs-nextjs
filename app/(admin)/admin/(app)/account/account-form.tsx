"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { btn, field, fieldLabel } from "../../_components/ui";
import { saveAccount, type AccountState } from "./actions";

type Copy = {
  name: string;
  email: string;
  current: string;
  currentHint: string;
  next: string;
  nextHint: string;
  showPassword: string;
  hidePassword: string;
  save: string;
  saved: string;
  wrong: string;
  invalid: string;
  taken: string;
  short: string;
  forgot: string;
};

export function AccountForm({ name, email, copy }: { name: string; email: string; copy: Copy }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveAccount, {});
  const error =
    state.error === "wrong" ? copy.wrong : state.error === "taken" ? copy.taken : state.error === "short" ? copy.short : state.error === "failed" ? copy.invalid : null;
  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.name}</span>
        <input name="name" required defaultValue={name} autoComplete="name" className={`${field} h-10`} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.email}</span>
        <input name="email" type="email" required defaultValue={email} autoComplete="email" className={`${field} h-10`} />
      </label>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className={fieldLabel}>{copy.current}</span>
          <Link href="/admin/forgot" className="text-[13px] font-medium text-zinc-950 underline underline-offset-4">
            {copy.forgot}?
          </Link>
        </div>
        <PasswordField name="current" autoComplete="current-password" show={copy.showPassword} hide={copy.hidePassword} />
        <p className="m-0 text-[13px] leading-snug text-zinc-600">{copy.currentHint}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={fieldLabel}>{copy.next}</span>
        <PasswordField name="next" autoComplete="new-password" minLength={12} show={copy.showPassword} hide={copy.hidePassword} />
        <p className="m-0 text-[13px] leading-snug text-zinc-600">{copy.nextHint}</p>
      </div>
      {error ? (
        <p role="alert" className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {copy.saved}
        </p>
      ) : null}
      <button disabled={pending} className={`${btn.base} ${btn.primary} ${btn.md} self-start`}>
        {copy.save}
      </button>
    </form>
  );
}

function PasswordField({
  name,
  autoComplete,
  minLength,
  show,
  hide,
}: {
  name: string;
  autoComplete: string;
  minLength?: number;
  show: string;
  hide: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} className={`${field} h-10 pr-16`} />
      <button
        type="button"
        onClick={() => setVisible((on) => !on)}
        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer border-0 bg-transparent px-1 text-[12px] font-medium text-zinc-700 underline-offset-2 hover:underline"
      >
        {visible ? hide : show}
      </button>
    </div>
  );
}
