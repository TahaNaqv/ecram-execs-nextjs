"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { amsterdamToday } from "@/lib/admin/financials-shared";
import type { Locale } from "@/lib/i18n/config";

/** Today's calendar day in Europe/Amsterdam, as a local Date whose year, month and day are that Dutch day. */
function amsterdamDate(): Date {
  const [y, m, d] = amsterdamToday().split("-").map(Number);
  return new Date(y, m - 1, d);
}

const fieldButton =
  "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white text-left text-zinc-900 shadow-sm transition hover:border-zinc-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10";

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="shrink-0 text-zinc-500">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="shrink-0 text-zinc-500">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/** Custom list, so admin menus share the panel's type, border and radius. */
export function AdminSelect({
  id,
  name,
  value,
  onChange,
  options,
  compact,
  placement = "below",
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  compact?: boolean;
  placement?: "below" | "above";
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const label = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative min-w-0">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldButton} ${compact ? "px-2 py-1 text-xs" : "px-3.5 py-2.5 text-sm"}`}
      >
        <span className="truncate">{label}</span>
        <Chevron />
      </button>
      {open && (
        <ul
          role="listbox"
          className={`absolute z-40 max-h-56 w-full min-w-[9rem] overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg ${placement === "above" ? "bottom-full mb-1" : "mt-1"}`}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm ${selected ? "bg-zinc-950 text-white" : "text-zinc-900 hover:bg-zinc-100"}`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type AdminDateCopy = {
  chooseDate: string;
  previousMonth: string;
  nextMonth: string;
};

const dateTag = (locale: Locale) => (locale === "nl" ? "nl-NL" : "en-GB");

/** Monday-first short weekday labels in the active language. 1 Jan 2024 was a Monday. */
function weekdayLabels(locale: Locale) {
  const format = new Intl.DateTimeFormat(dateTag(locale), { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(2024, 0, 1 + index)).replace(".", ""));
}

function parseIso(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function iso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function showDate(value: string, locale: Locale, empty: string) {
  const date = parseIso(value);
  if (!date) return empty;
  return new Intl.DateTimeFormat(dateTag(locale), { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Month calendar that writes YYYY-MM-DD, including into a named form field. */
export function AdminDateField({
  id,
  name,
  value,
  defaultValue = "",
  onChange,
  compact,
  placement = "below",
  locale,
  copy,
  submitOnChange = false,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  compact?: boolean;
  placement?: "below" | "above";
  locale: Locale;
  copy: AdminDateCopy;
  /** Submit the surrounding form as soon as a day is chosen, so the page view follows the date. */
  submitOnChange?: boolean;
}) {
  const router = useRouter();
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;

  useEffect(() => {
    if (!controlled) setInner(defaultValue);
  }, [controlled, defaultValue]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const selected = parseIso(current ?? "");
  const [cursor, setCursor] = useState(() => selected ?? amsterdamDate());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const labelId = useId();
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = anchor.current;
      const pop = panel.current;
      if (!button || !pop) return;
      const rect = button.getBoundingClientRect();
      const width = pop.offsetWidth;
      const height = pop.offsetHeight;
      const gap = 8;
      const margin = 12;
      const roomBelow = window.innerHeight - rect.bottom - gap - margin;
      const roomAbove = rect.top - gap - margin;
      const openAbove = placement === "above" ? roomAbove >= height || roomAbove >= roomBelow : roomBelow < height && roomAbove > roomBelow;
      let top = openAbove ? rect.top - gap - height : rect.bottom + gap;
      let left = rect.left;
      if (top + height > window.innerHeight - margin) top = window.innerHeight - margin - height;
      if (top < margin) top = margin;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
      if (left < margin) left = margin;
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement, cursor]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || panel.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: string) => {
    if (!controlled) setInner(next);
    onChange?.(next);
    setOpen(false);
    if (!submitOnChange || !name) return;
    // Push the date into the URL immediately. A form submit can race React's
    // state update and leave the day schedule on the previous date.
    const form = root.current?.closest("form");
    const action = form?.getAttribute("action") || window.location.pathname;
    const url = new URL(action, window.location.origin);
    url.searchParams.set(name, next);
    router.push(`${url.pathname}?${url.searchParams.toString()}`);
  };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1))];
  const todayIso = iso(amsterdamDate());

  return (
    <div ref={root} className="relative min-w-0">
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        ref={anchor}
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setCursor(parseIso(current ?? "") ?? amsterdamDate());
          setPos(null);
          setOpen((shown) => !shown);
        }}
        className={`${fieldButton} ${compact ? "px-2 py-1 text-xs" : "px-3.5 py-2.5 text-sm"}`}
      >
        <span id={labelId} className="truncate">
          {showDate(current ?? "", locale, copy.chooseDate)}
        </span>
        <CalendarIcon />
      </button>
      {open &&
        createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label={copy.chooseDate}
          style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
          className="fixed z-[80] w-[14.75rem] rounded-xl border border-solid border-zinc-200 bg-white px-2.5 py-2 text-zinc-950 shadow-lg"
        >
          <div className="mb-1 flex items-center justify-between">
            <button type="button" className="grid size-6 cursor-pointer place-items-center rounded-md text-base text-zinc-900 hover:bg-zinc-100" aria-label={copy.previousMonth} onClick={() => setCursor(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <span className="text-xs font-semibold">{new Intl.DateTimeFormat(dateTag(locale), { month: "long", year: "numeric" }).format(cursor)}</span>
            <button type="button" className="grid size-6 cursor-pointer place-items-center rounded-md text-base text-zinc-900 hover:bg-zinc-100" aria-label={copy.nextMonth} onClick={() => setCursor(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-medium text-zinc-400">
            {weekdays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-0.5 grid grid-cols-7">
            {cells.map((date, index) =>
              date ? (
                <button
                  key={iso(date)}
                  type="button"
                  onClick={() => choose(iso(date))}
                  className={`grid size-7 cursor-pointer place-items-center rounded-md text-[12px] tabular-nums ${
                    iso(date) === current
                      ? "bg-zinc-950 font-semibold text-white"
                      : iso(date) === todayIso
                        ? "text-zinc-950 ring-1 ring-inset ring-zinc-950 hover:bg-zinc-100"
                        : "text-zinc-900 hover:bg-zinc-100"
                  }`}
                >
                  {date.getDate()}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
        </div>,
          document.body,
        )}
    </div>
  );
}
