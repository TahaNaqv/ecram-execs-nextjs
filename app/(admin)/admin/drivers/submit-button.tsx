"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? pendingText : children}
    </button>
  );
}
