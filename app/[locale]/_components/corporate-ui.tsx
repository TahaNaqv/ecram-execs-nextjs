"use client";

import { useState, type ReactNode } from "react";
import { PASSWORD_MAX } from "@/lib/corporate/validation";
import { control } from "./form-field";

/** Small pieces the Corporate Partner forms share. */
export const submitClass =
  "min-h-[56px] w-full max-w-[420px] cursor-pointer border-none bg-ink-950 px-10 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70";
export const ghostClass =
  "cursor-pointer border-none bg-transparent p-0 font-sans text-[12px] tracking-[0.18em] text-ink-700 uppercase underline underline-offset-4 hover:text-ink-950 disabled:cursor-progress disabled:opacity-60";

export const Honeypot = () => (
  <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
    <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
  </div>
);

export function Status({ children, error }: { children?: ReactNode; error?: boolean }) {
  return (
    <p aria-live="polite" className={`m-0 min-h-[1.5em] text-[13px] ${error ? "text-error" : "text-ink-600"}`}>
      {children}
    </p>
  );
}

/** A password box with a show/hide button. The browser's password manager is told which kind of password it is. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  invalid,
  describedBy,
  copy,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
  copy: { show: string; hide: string };
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <input id={id} name={name} type={shown ? "text" : "password"} required maxLength={PASSWORD_MAX} autoComplete={autoComplete}
        autoCapitalize="none" spellCheck={false} aria-invalid={invalid} aria-describedby={describedBy} className={control} />
      <button type="button" onClick={() => setShown((v) => !v)} aria-controls={id} className={`${ghostClass} shrink-0`}>
        {shown ? copy.hide : copy.show}
      </button>
    </div>
  );
}
