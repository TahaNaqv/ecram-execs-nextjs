import type { ReactNode } from "react";

// Inputs use 16px on phones so iOS doesn't zoom in on focus
export const control =
  "w-full min-w-0 border-none bg-transparent p-0 text-[16px] tracking-[0] text-ink-950 normal-case outline-none placeholder:text-ink-420 md:text-[15px]";

/** A labelled cell of the light enquiry forms, with its validation message beneath the control. */
export function Field({
  label,
  name,
  error,
  className = "",
  idPrefix = "q",
  children,
}: {
  label: string;
  name: string;
  /** Distinct per form: two forms share the homepage, and ids must stay unique. */
  idPrefix?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={`${idPrefix}-${name}`}
      className={`flex min-w-0 flex-col gap-[6px] bg-white px-[18px] py-4 text-[10px] tracking-[0.22em] text-ink-600 uppercase ${
        error ? "shadow-[inset_0_-2px_0_var(--color-error)]" : "focus-within:shadow-[inset_0_-2px_0_var(--color-ink-950)]"
      } ${className}`}
    >
      {label}
      {children}
      {error && (
        <span id={`${idPrefix}-${name}-error`} className="text-[11px] tracking-[0] text-error normal-case">
          {error}
        </span>
      )}
    </label>
  );
}
