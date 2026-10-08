"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-500">
        Email
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="rounded border border-zinc-300 bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-zinc-900 outline-none focus:border-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-widest text-zinc-500">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border border-zinc-300 bg-white px-3 py-2.5 text-sm normal-case tracking-normal text-zinc-900 outline-none focus:border-zinc-900"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="mt-2 rounded bg-zinc-950 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
