"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "../actions";
import { AlertIcon, EyeIcon, EyeOffIcon } from "../_components/icons";
import { btn, field, fieldLabel } from "../_components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [reveal, setReveal] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className={fieldLabel}>
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          defaultValue={state.email}
          placeholder="you@ecramexecs.com"
          aria-invalid={state.error ? true : undefined}
          className={`${field} h-11`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className={fieldLabel}>
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={reveal ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={state.error ? true : undefined}
            className={`${field} h-11 pr-11`}
          />
          {/* Named "Show"/"Hide" so it never matches a "Password" label query */}
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-pressed={reveal}
            aria-controls="login-password"
            title={reveal ? "Hide" : "Show"}
            className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            {reveal ? <EyeOffIcon /> : <EyeIcon />}
            <span className="sr-only">{reveal ? "Hide" : "Show"}</span>
          </button>
        </div>
      </div>
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
          <AlertIcon className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${btn.base} ${btn.primary} mt-1 h-11`}>
        {pending && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
