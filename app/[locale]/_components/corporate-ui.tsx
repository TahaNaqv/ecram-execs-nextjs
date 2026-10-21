"use client";

import { useState, type ReactNode } from "react";
import { PASSWORD_MAX } from "@/lib/corporate/validation";
import { control } from "./form-field";

import { ghostClass, submitClass, submitFullClass } from "./corporate-styles";

/** Small pieces the Corporate Partner forms share. */
export { ghostClass, submitClass, submitFullClass };

export const Honeypot = () => (
  <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
    <input type="text" name="company_website" tabIndex={-1} autoComplete="off" defaultValue="" />
  </div>
);

/**
 * The line under a form that says what went wrong. It keeps its height so the form does not jump when a message
 * arrives; `compact` instead takes no room while empty, for forms with something right below (the login's links).
 */
export function Status({ children, error, compact }: { children?: ReactNode; error?: boolean; compact?: boolean }) {
  const empty = compact && !children;
  return (
    <p aria-live="polite" className={empty ? "sr-only" : `m-0 min-h-[1.5em] text-[13px] ${error ? "text-error" : "text-ink-600"}`}>
      {children}
    </p>
  );
}

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

/**
 * A password box with a show/hide button. The browser's password manager is told which kind of password it is.
 * The browser's own reveal icon (Edge draws one, and it disappears after a single use) is hidden in site.css, so this
 * button, which stays put and toggles both ways, is the only one.
 */
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
      <button type="button" onClick={() => setShown((v) => !v)} aria-controls={id} className={`${ghostClass} inline-flex shrink-0 items-center gap-1.5 no-underline`}>
        <EyeIcon off={shown} />
        <span className="underline underline-offset-4">{shown ? copy.hide : copy.show}</span>
      </button>
    </div>
  );
}
