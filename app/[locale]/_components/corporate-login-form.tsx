"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/corporate/account-actions";
import type { CorporateState } from "@/lib/corporate/state";
import type { Locale } from "@/lib/i18n/config";
import { Honeypot, PasswordInput, Status, ghostClass, submitFullClass } from "./corporate-ui";
import { control, Field } from "./form-field";

export type LoginCopy = Record<
  "labelEmail" | "phEmail" | "labelPassword" | "loginCta" | "loggingIn" | "forgotLink" | "noAccount" | "signupLink" | "showPassword" | "hidePassword",
  string
>;

export function LoginForm({
  locale,
  copy: t,
  forgotHref,
  signupHref,
  next,
}: {
  locale: Locale;
  copy: LoginCopy;
  forgotHref: string;
  signupHref: string;
  /** The portal page the visitor was sent from; the server checks it again before using it. */
  next?: string;
}) {
  const [state, action, pending] = useActionState<CorporateState, FormData>(login, { status: "idle" });
  // Only the address comes back after a failed attempt, never the password
  const email = state.status === "error" ? state.values.email : "";

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
      {/* A new key after each answer clears the password box */}
      <form key={state.status === "error" ? state.message + email : "fresh"} action={action} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225">
          <Field idPrefix="c" label={t.labelEmail} name="email">
            <input id="c-email" name="email" type="email" required maxLength={200} autoComplete="username" placeholder={t.phEmail}
              defaultValue={email} className={control} />
          </Field>
          <Field idPrefix="c" label={t.labelPassword} name="password">
            <PasswordInput id="c-password" name="password" autoComplete="current-password" copy={{ show: t.showPassword, hide: t.hidePassword }} />
          </Field>
        </div>
        <input type="hidden" name="locale" value={locale} />
        {next && <input type="hidden" name="next" value={next} />}
        <Honeypot />
        <button type="submit" disabled={pending} className={submitFullClass}>
          {pending ? t.loggingIn : t.loginCta}
        </button>
        <Status compact error={state.status === "error"}>{state.status === "error" ? state.message : undefined}</Status>
      </form>
      <div className="flex flex-col gap-2 text-[14px] text-ink-700">
        <Link href={forgotHref} className={`${ghostClass} self-start no-underline`}>
          {t.forgotLink}
        </Link>
        <p className="m-0">
          {t.noAccount}{" "}
          <Link href={signupHref} className="text-ink-950 underline underline-offset-4">
            {t.signupLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
