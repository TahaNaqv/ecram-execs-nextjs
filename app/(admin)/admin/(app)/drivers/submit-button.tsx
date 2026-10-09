"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className,
  title,
}: {
  children: React.ReactNode;
  pendingText: string;
  className: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} title={title} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
