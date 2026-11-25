"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Toast = { id: number; text: string; ok: boolean };

let nextId = 1;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Shows a toast that stays up for a few seconds, including after the row that triggered it is gone. */
export function pushToast(text: string, ok = true) {
  const id = nextId++;
  toasts = [...toasts, { id, text, ok }];
  emit();
  window.setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    emit();
  }, 3200);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ToastHost() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || items.length === 0) return null;
  return createPortal(
    <div className="fixed right-4 bottom-4 z-[90] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((item) => (
        <p key={item.id} role={item.ok ? "status" : "alert"} className={`m-0 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${item.ok ? "bg-emerald-900" : "bg-red-800"}`}>
          {item.text}
        </p>
      ))}
    </div>,
    document.body,
  );
}

export function SavedMark({ text }: { text: string | null }) {
  if (!text) return null;
  return <span role="status" className="text-xs font-medium text-emerald-700">{text}</span>;
}

/** Toasts when a useActionState result flips to success or an error. */
export function useActionNotice(state: { ok?: boolean; error?: string } | undefined, success: string) {
  const previous = useRef(state);
  useEffect(() => {
    if (state === previous.current) return;
    previous.current = state;
    if (state?.ok) pushToast(success);
    else if (state?.error) pushToast(state.error, false);
  }, [state, success]);
}

const COPY = {
  save: { toast: "Saved successfully!", inline: "Saved!" },
  delete: { toast: "Item removed!", inline: "Deleted!" },
  email: { toast: "Email sent!", inline: "Sent!" },
  status: { toast: "Status updated!", inline: "Updated!" },
  reset: { toast: "Authenticator reset!", inline: "Reset!" },
} as const;

type Tone = keyof typeof COPY;

function failed(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const record = result as { ok?: boolean; error?: unknown; sent?: boolean };
  if (record.ok === false || (typeof record.error === "string" && record.error)) {
    return typeof record.error === "string" ? record.error : "That action did not complete.";
  }
  return null;
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && typeof (error as { digest?: unknown }).digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT");
}

/** A form whose server action reports a toast and a short inline badge. */
export function ActionForm({
  action,
  tone = "save",
  success,
  inline,
  onDone,
  className,
  children,
  ...rest
}: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<unknown> | unknown;
  tone?: Tone;
  success?: string;
  inline?: string;
  onDone?: () => void;
  children: ReactNode;
}) {
  const [badge, setBadge] = useState<string | null>(null);
  const copy = COPY[tone];
  return (
    <form
      {...rest}
      className={className}
      action={async (formData) => {
        if (tone === "delete") setBadge(copy.inline);
        try {
          const result = await action(formData);
          const error = failed(result);
          if (error) {
            setBadge(null);
            pushToast(error, false);
            return;
          }
          pushToast(success ?? copy.toast);
          setBadge(inline ?? copy.inline);
          window.setTimeout(() => setBadge(null), 2000);
          onDone?.();
        } catch (error) {
          if (isRedirect(error)) {
            const digest = String((error as { digest: string }).digest);
            if ((tone === "reset" && digest.includes("totp=cleared")) || digest.includes("totp=enabled")) pushToast(success ?? copy.toast);
            throw error;
          }
          setBadge(null);
          pushToast("That action did not complete.", false);
        }
      }}
    >
      {children}
      <SavedMark text={badge} />
    </form>
  );
}
