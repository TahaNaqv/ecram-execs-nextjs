"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { setTeamPassword, type SetPasswordState } from "../(app)/account/actions";
import { btn, field } from "./ui";
import { pushToast } from "./action-feedback";

type Copy = {
  setPassword: string;
  passwordSet: string;
  passwordHint: string;
  showPassword: string;
  hidePassword: string;
  short: string;
  denied: string;
  invalid: string;
};

export function SetPasswordForm({ id, copy }: { id: string; copy: Copy }) {
  const [visible, setVisible] = useState(false);
  const [state, submit, pending] = useActionState(setTeamPassword, {} as SetPasswordState);
  const error = state.error === "short" ? copy.short : state.error === "denied" ? copy.denied : state.error === "failed" ? copy.invalid : null;
  useEffect(() => {
    if (state.ok) pushToast("Changes saved!");
    else if (error) pushToast(error, false);
  }, [state.ok, error]);

  return (
    <form action={submit} className="flex w-full min-w-0 flex-col gap-1.5">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="temporaryPassword"
          type={visible ? "text" : "password"}
          required
          minLength={12}
          autoComplete="new-password"
          aria-label={copy.setPassword}
          className={`${field} h-9`}
        />
        <button type="button" onClick={() => setVisible((on) => !on)} className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
          {visible ? copy.hidePassword : copy.showPassword}
        </button>
        <button type="submit" disabled={pending} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
          {copy.setPassword}
        </button>
      </div>
      <p className="m-0 text-[12px] leading-snug text-zinc-500">{copy.passwordHint}</p>
      {state.ok ? <p className="m-0 text-[12px] text-emerald-800">{copy.passwordSet}</p> : null}
      {error ? <p role="alert" className="m-0 text-[12px] text-red-700">{error}</p> : null}
    </form>
  );
}
