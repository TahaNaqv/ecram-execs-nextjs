"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { sendBookingMessage } from "@/lib/corporate/portal-actions";
import type { PortalState } from "@/lib/corporate/portal-state";
import type { Locale } from "@/lib/i18n/config";
import { ghostClass, submitClass } from "./corporate-styles";
import { Status } from "./corporate-ui";

export type MessageFormCopy = Record<
  "messagesIntro" | "labelMessageKind" | "kindMessage" | "kindChange" | "kindCancel" | "labelMessage" | "phMessage" | "sendMessage" | "sendingMessage" | "loginLink",
  string
>;

type KindValue = "message" | "change" | "cancel";

/**
 * The "what is this about" choice as a styled listbox instead of the browser's own select list.
 * Posts the same `kind` field the select did. Arrow keys, Home/End, Enter/Space and Escape work as they do on a select.
 */
function KindSelect({ label, defaultValue, options }: { label: string; defaultValue: string; options: { value: KindValue; label: string }[] }) {
  const start = Math.max(0, options.findIndex((o) => o.value === defaultValue));
  const [value, setValue] = useState(options[start].value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(start);
  const root = useRef<HTMLDivElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;
  const labelId = `${uid}-label`;
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const outside = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const choose = (i: number) => {
    setValue(options[i].value);
    setActive(i);
    setOpen(false);
  };
  const openList = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      setActive((a) => (e.key === "ArrowDown" ? Math.min(options.length - 1, a + 1) : Math.max(0, a - 1)));
    } else if (e.key === "Home" || e.key === "End") {
      if (!open) return;
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(active);
      else openList();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative flex w-full box-border flex-col gap-2">
      <span id={labelId}>{label}</span>
      <input type="hidden" name="kind" value={value} />
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${uid}-value`}
        aria-activedescendant={open ? `${uid}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className="flex min-h-[48px] w-full box-border cursor-pointer items-center justify-between gap-3 border border-solid border-[#3f5192] bg-[#081b62] py-3 pr-4 pl-3 text-left text-[15px] tracking-normal text-[#f4f4f5] normal-case outline-none [-webkit-text-fill-color:#f4f4f5] focus-visible:border-[#aab2cf]"
      >
        <span id={`${uid}-value`} className="min-w-0 flex-1 truncate">
          {current.label}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-[#aab2cf] transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelId}
          className="absolute top-full right-0 left-0 z-30 m-0 mt-1 box-border flex list-none flex-col gap-0.5 border border-solid border-[#3f5192] bg-[#081b62] p-1 text-[15px] tracking-normal normal-case shadow-lg"
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${uid}-opt-${i}`}
                role="option"
                aria-selected={selected}
                // Keep focus on the button while choosing
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`cursor-pointer px-3 py-2.5 [-webkit-text-fill-color:currentColor] ${
                  selected ? "bg-[#f4f4f5] font-semibold text-[#081b62]" : i === active ? "bg-white/10 text-[#f4f4f5]" : "text-[#f4f4f5]"
                }`}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Write to the team about a booking, or ask for a change or a cancellation. A request never alters the booking itself. */
export function MessageForm({ reference, locale, loginHref, copy: t }: { reference: string; locale: Locale; loginHref: string; copy: MessageFormCopy }) {
  // A new key after each sent message empties the form
  const [sent, setSent] = useState(0);
  const [state, action, pending] = useActionState<PortalState, FormData>(async (prev, formData) => {
    const next = await sendBookingMessage(prev, formData);
    if (next.status === "ok") setSent((n) => n + 1);
    return next;
  }, { status: "idle" });
  const err = state.status === "error" ? state.fieldErrors : {};
  const kind = state.status === "error" ? state.values.kind : "message";

  return (
    <form key={sent} action={action} noValidate className="flex w-full box-border flex-col gap-4">
      <p className="m-0 text-[15px] text-ink-700">{t.messagesIntro}</p>
      <div className="flex w-full box-border flex-col text-[11px] tracking-[0.2em] text-ink-600 uppercase">
        <KindSelect
          label={t.labelMessageKind}
          defaultValue={kind}
          options={[
            { value: "message", label: t.kindMessage },
            { value: "change", label: t.kindChange },
            { value: "cancel", label: t.kindCancel },
          ]}
        />
      </div>
      <label className="flex w-full box-border flex-col gap-2 text-[11px] tracking-[0.2em] text-ink-600 uppercase">
        {t.labelMessage}
        <textarea
          name="body"
          rows={4}
          maxLength={2100}
          placeholder={t.phMessage}
          aria-invalid={!!err.message}
          aria-describedby={err.message ? "m-body-error" : undefined}
          className="w-full box-border resize-y border border-solid border-ink-225 bg-white p-3 text-[15px] tracking-normal text-ink-950 placeholder:text-[#7d93c4] normal-case"
        />
        {err.message && (
          <span id="m-body-error" className="text-[12px] tracking-normal text-error normal-case">
            {err.message}
          </span>
        )}
      </label>
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={`${submitClass} max-w-[240px]`}>
          {pending ? t.sendingMessage : t.sendMessage}
        </button>
        {state.status === "locked" && (
          <Link href={loginHref} className={ghostClass}>
            {t.loginLink}
          </Link>
        )}
      </div>
      <Status error={state.status === "locked" || (state.status === "error" && !err.message)}>
        {state.status === "ok" ? state.notice : state.status === "locked" ? state.message : state.status === "error" && !err.message ? state.message : undefined}
      </Status>
    </form>
  );
}