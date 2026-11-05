"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PlaceHit, PlaceKind } from "@/lib/places/types";
import { curatedKind } from "@/lib/places/curated";
import type { Place } from "./trip";

export type AddressCopy = { suggestions: string; poweredByGoogle: string };

// Google is asked once the visitor pauses, not on every letter; all the searches for one address share a billing session (below)
const DEBOUNCE_MS = 400;

const ICONS: Record<PlaceKind, string> = {
  airport: "M2 16l20-6-2-3-7 2-6-6-2 1 4 7-5 2-2-2-1 1z",
  aviation: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
  station: "M7 3h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 10h14M8 21l2-5M16 21l-2-5",
  hotel: "M3 21V8l9-5 9 5v13M9 21v-6h6v6",
  place: "M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
};
export function PlaceIcon({ kind, size = 18 }: { kind: PlaceKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[kind]} />
    </svg>
  );
}

/** A picked suggestion as the text the chauffeur reads: the name, then the street and town Google gives. */
const placeText = (hit: PlaceHit) => (hit.source === "google" && hit.detail ? `${hit.name}, ${hit.detail}` : hit.name);
const fullAddress = (hit: PlaceHit) => (hit.detail ? `${hit.name}, ${hit.detail}` : hit.name);

/**
 * An address with suggestions as the visitor types (ARIA 1.2 combobox with a list popup), from /api/places: our own
 * airports and stations, then Google's. Whatever is typed is what counts, so a place nobody suggests, or Google being
 * unavailable, never blocks anyone. Picking a suggestion also tells the flow what kind of place it is (an airport
 * makes the trip an airport transfer and asks for the flight).
 */
export function AddressField({
  id,
  value,
  onChange,
  onPicked,
  placeholder,
  locale,
  copy,
  invalid,
  describedBy,
  tone,
  alignEnd = false,
  className = "",
}: {
  id: string;
  value: Place;
  onChange: (place: Place) => void;
  /** After a suggestion is chosen, so the flow can move on to the next field */
  onPicked?: () => void;
  placeholder: string;
  locale: string;
  copy: AddressCopy;
  invalid?: boolean;
  describedBy?: string;
  tone: "dark" | "light";
  /** In the right-hand column of the two-column (tablet) bar the list opens leftwards, so it stays on the screen */
  alignEnd?: boolean;
  className?: string;
}) {
  const listId = useId();
  const [items, setItems] = useState<PlaceHit[]>([]);
  const [google, setGoogle] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<number | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  // One Google billing session per address: from the first keystroke until a suggestion is picked
  const session = useRef<string | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  const search = (query: string) => {
    window.clearTimeout(timer.current);
    controller.current?.abort();
    if (query.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      controller.current = ctrl;
      try {
        session.current ??= crypto.randomUUID();
        const qs = new URLSearchParams({ q: query.trim(), session: session.current, lang: locale });
        const res = await fetch(`/api/places?${qs}`, { signal: ctrl.signal });
        const body = (await res.json()) as { items?: PlaceHit[]; google?: boolean };
        setItems(body.items ?? []);
        setGoogle(Boolean(body.google));
        setActive(-1);
        setOpen((body.items ?? []).length > 0);
      } catch (err) {
        // Aborted (the visitor typed on) or the service is down: stay a plain text field
        if ((err as Error).name !== "AbortError") {
          setItems([]);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);
  };

  const pick = (hit: PlaceHit) => {
    // A search still on its way must not reopen the list (or start a new session) after the pick
    window.clearTimeout(timer.current);
    controller.current?.abort();
    onChange({ text: placeText(hit), id: hit.id, kind: hit.kind });
    setOpen(false);
    setItems([]);
    // Closing the session is what makes Google bill it once; it can fail without the visitor noticing
    if (hit.source === "google" && hit.id && session.current) {
      void fetch("/api/places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: hit.id, session: session.current }),
      }).catch(() => {});
    }
    session.current = null;
    onPicked?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape" && open) {
      setOpen(false);
      e.preventDefault();
      return;
    }
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      setActive((i) => (i + 1) % items.length);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
      e.preventDefault();
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(items[active]);
    }
  };

  const dark = tone === "dark";
  return (
    <div className="relative w-full min-w-0">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoComplete="off"
        maxLength={200}
        placeholder={placeholder}
        value={value.text}
        className={`w-full min-w-0 border-0 bg-transparent p-0 text-[16px] font-medium outline-none ${
          dark ? "text-white placeholder:font-normal placeholder:text-ink-400" : "text-ink-950 placeholder:font-normal placeholder:text-ink-475"
        } ${className}`}
        onKeyDown={onKeyDown}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          const text = e.target.value;
          // Typed by hand: no place id, and the kind only if we know the name ("Schiphol")
          onChange({ text, id: null, kind: curatedKind(text) });
          search(text);
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={copy.suggestions}
          className={`absolute top-[calc(100%+var(--field-pad,0px)+6px)] left-[calc(var(--field-pad,0px)*-1)] z-40 m-0 box-border max-h-[min(18rem,50vh)] w-[calc(100%+var(--field-pad,0px)*2)] max-w-[calc(100vw-1.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain list-none rounded-xl border border-solid p-1.5 shadow-2xl sm:max-h-[min(24rem,60vh)] sm:rounded-2xl sm:p-2 ${
            dark ? "border-white/15 bg-ink-900 text-white" : "border-ink-225 bg-white text-ink-950"
          }`}
        >
          {items.map((hit, i) => (
            <li
              key={`${hit.source}-${hit.id ?? hit.name}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              title={fullAddress(hit)}
              // mousedown, not click: the input's blur would close the list before a click lands
              onMouseDown={(e) => {
                e.preventDefault();
                pick(hit);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 sm:min-h-[64px] sm:gap-3.5 sm:rounded-[12px] sm:px-3.5 sm:py-3 ${
                i === active ? (dark ? "bg-white/10" : "bg-ink-100") : ""
              }`}
            >
              <span className={`grid size-8 shrink-0 place-items-center rounded-lg sm:size-11 sm:rounded-[12px] ${dark ? "bg-white/10" : "bg-ink-100"}`}>
                <PlaceIcon kind={hit.kind} size={16} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[14px] leading-snug font-semibold sm:text-[16px]">{hit.name}</span>
                {hit.detail && <span className={`truncate text-[12px] leading-snug sm:text-[13px] ${dark ? "text-ink-400" : "text-ink-600"}`}>{hit.detail}</span>}
              </span>
            </li>
          ))}
          {active >= 0 && items[active] && (
            <li role="presentation" className={`mx-1 mt-1 hidden border-0 border-t border-solid px-3 pt-2.5 pb-1.5 text-[14px] leading-snug sm:block ${dark ? "border-white/15 text-white" : "border-ink-150 text-ink-950"}`}>
              {fullAddress(items[active])}
            </li>
          )}
          {google && (
            <li role="presentation" className={`px-3 pt-2 pb-1 text-right text-[11px] ${dark ? "text-ink-400" : "text-ink-600"}`}>
              {copy.poweredByGoogle}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
