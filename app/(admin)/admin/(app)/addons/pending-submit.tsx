"use client";

import { useFormStatus } from "react-dom";

/** Disables itself while the surrounding form's server action is in flight, so one click cannot submit twice. */
export function PendingSubmit({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}
