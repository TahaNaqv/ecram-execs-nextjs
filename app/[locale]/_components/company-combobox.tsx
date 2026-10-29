"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { CompanyHit } from "@/lib/companies/provider";
import { interpolate } from "@/lib/i18n/interpolate";
import { cardControl } from "./form-cards";
import { control } from "./form-field";

export type CompanySearchCopy = {
  /** "{count} companies found" */
  resultsCount: string;
  noResults: string;
  manualHint: string;
  searching: string;
};

type Props = {
  id: string;
  name: string;
  copy: CompanySearchCopy;
  placeholder?: string;
  defaultValue?: string;
  /** Controlled text. When set, the field follows this value instead of its own state. */
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  /** Called with the chosen company, or null when the visitor edits the text after choosing one. */
  onSelect?: (company: CompanyHit | null) => void;
  /** `cell` sits in the bordered cells of the light enquiry forms; `card` is the rounded field of the portal's card forms. */
  variant?: "cell" | "card";
};

const DEBOUNCE_MS = 250;

/**
 * A text field that suggests registered Dutch companies as the visitor types (ARIA 1.2 combobox with a
 * list popup). It is a text field first: whatever is typed is what gets submitted, so a company the
 * register doesn't know — or a registry that is down — never blocks anyone. Choosing a suggestion fills the
 * name and reports the KvK number to the form.
 */
export function CompanyCombobox({ id, name, copy, placeholder, defaultValue = "", value: valueProp, onValueChange, required, maxLength = 200, invalid, describedBy, onSelect, variant = "cell" }: Props) {
  const listId = useId();
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = valueProp ?? uncontrolled;
  const setValue = (next: string) => {
    if (valueProp === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };
  const [items, setItems] = useState<CompanyHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  // The text that was last picked from the list, so picking doesn't immediately search again
  const picked = useRef<string | null>(null);

  const search = (query: string) => {
    window.clearTimeout(timer.current);
    controller.current?.abort();
    if (query.trim().length < 2 || query === picked.current) {
      setItems([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        const res = await fetch(`/api/companies?q=${encodeURIComponent(query.trim())}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { items: CompanyHit[] };
        setItems(body.items);
        setActive(-1);
        setStatus("done");
        setOpen(true);
      } catch (err) {
        // Aborted (the visitor typed on) or the registry is unavailable: stay a plain text field
        if ((err as Error).name !== "AbortError") {
          setItems([]);
          setStatus("idle");
        }
      }
    }, DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  const pick = (hit: CompanyHit) => {
    picked.current = hit.name;
    setValue(hit.name);
    setOpen(false);
    setItems([]);
    setStatus("idle");
    onSelect?.(hit);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && open) {
      setOpen(false);
      e.preventDefault();
      return;
    }
    if (!open || items.length === 0) {
      if (e.key === "ArrowDown" && items.length > 0) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setActive((i) => (i + 1) % items.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
      e.preventDefault();
    } else if (e.key === "Home") {
      setActive(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setActive(items.length - 1);
      e.preventDefault();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  };

  const showList = open && status === "done";
  const announcement =
    status === "loading" ? copy.searching : status === "done" ? (items.length > 0 ? interpolate(copy.resultsCount, { count: items.length }) : copy.noResults) : "";

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        className={variant === "card" ? cardControl : control}
        onKeyDown={onKeyDown}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (picked.current !== null && next !== picked.current) {
            picked.current = null;
            onSelect?.(null);
          }
          search(next);
        }}
      />
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute top-full z-20 m-0 max-h-[320px] list-none overflow-y-auto p-0 shadow-lg ${
            variant === "card"
              ? "right-0 left-0 mt-1 rounded-xl border border-[#d5e4ff] bg-[#ffffff] text-[#10224f] shadow-[0_12px_32px_rgba(47,98,255,0.16)]"
              : "right-[-18px] left-[-18px] mt-3 border border-ink-225 bg-white"
          }`}
        >
          {items.map((hit, i) => (
            <li
              key={hit.kvk}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the input's blur would close the list before a click lands
              onMouseDown={(e) => {
                e.preventDefault();
                pick(hit);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-[44px] cursor-pointer flex-col justify-center py-2 text-[14px] normal-case tracking-normal ${
                variant === "card" ? "px-3" : "px-[18px]"
              } ${
                variant === "card"
                  ? i === active
                    ? "bg-[#eef3ff] text-[#10224f]"
                    : "text-[#10224f]"
                  : i === active
                    ? "bg-ink-100 text-ink-950"
                    : "text-ink-800"
              }`}
            >
              <span className="font-medium">{hit.name}</span>
              <span className={`text-[12px] ${variant === "card" ? "text-[#4d6494]" : "text-ink-600"}`}>
                KvK {hit.kvk}
                {hit.city ? ` · ${hit.city}` : ""}
              </span>
            </li>
          ))}
          <li role="presentation" className={`border-t py-2 text-[12px] normal-case tracking-normal ${variant === "card" ? "border-[#d5e4ff] px-3 text-[#4d6494]" : "border-ink-225 px-[18px] text-ink-600"}`}>
            {items.length === 0 ? copy.noResults : copy.manualHint}
          </li>
        </ul>
      )}
    </div>
  );
}
