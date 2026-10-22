"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { login } from "@/lib/corporate/account-actions";
import type { CorporateState } from "@/lib/corporate/state";
import type { Locale } from "@/lib/i18n/config";
import { Honeypot, Status, ghostClass, submitFullClass } from "@/app/[locale]/_components/corporate-ui";
import { control, Field } from "@/app/[locale]/_components/form-field";
import { EyeIcon, EyeOffIcon } from "@/app/(admin)/admin/_components/icons";

export type LoginCopy = Record<
  "labelEmail" | "phEmail" | "labelPassword" | "loginCta" | "loggingIn" | "forgotLink" | "noAccount" | "signupLink" | "showPassword" | "hidePassword",
  string
> & { phPassword?: string };

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
  next?: string;
}) {
  const [state, action, pending] = useActionState<CorporateState, FormData>(login, { status: "idle" });
  const email = state.status === "error" ? state.values.email : "";
  const [reveal, setReveal] = useState(false);

  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnabled(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4">
      <input type="text" name="prevent_autofill" id="prevent_autofill" defaultValue="" style={{ display: 'none' }} tabIndex={-1} />
      <input type="password" name="password_prevent_autofill" id="password_prevent_autofill" defaultValue="" style={{ display: 'none' }} tabIndex={-1} />

      <form key={state.status === "error" ? state.message + email : "fresh"} action={action} noValidate autoComplete="off" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-px border border-ink-225 bg-ink-225">
          <Field idPrefix="c" label={t.labelEmail} name="email">
            <input 
              id="c-email" 
              name="email" 
              type={enabled ? "email" : "text"} 
              required 
              maxLength={200} 
              autoComplete="new-email" 
              placeholder={t.phEmail}
              defaultValue={email} 
              className={control} 
            />
          </Field>
          <Field idPrefix="c" label={t.labelPassword} name="password">
            <div className="relative w-full">
              <input
                id="c-password"
                name="password"
                type={reveal ? "text" : (enabled ? "password" : "text")}
                required
                autoComplete="new-password"
                placeholder={t.phPassword ?? "••••••••"}
                className={`${control} pr-11`}
              />
             <button
  type="button"
  onClick={() => setReveal((v) => !v)}
  aria-pressed={reveal}
  aria-controls="c-password"
  title={reveal ? t.hidePassword : t.showPassword}
  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none p-0 text-ink-500 hover:text-ink-900 cursor-pointer flex items-center justify-center"
>
  {reveal ? <EyeOffIcon /> : <EyeIcon />}
  <span className="sr-only">{reveal ? t.hidePassword : t.showPassword}</span>
</button>
            </div>
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

export default function LoginPage({ params }: { params: { locale: Locale } }) {
  // If this file doubles as your page wrapper, ensure searchParams or default props match your setup
  return null;
}