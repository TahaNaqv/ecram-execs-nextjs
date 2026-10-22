"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { interpolate } from "@/lib/i18n/interpolate";

/**
 * A date-and-time field for the booking forms. The browser's own date-time control cannot be given a "Done" button and
 * closes only when the visitor clicks away, so this one is built here: the text box accepts a typed date and time, a
 * calendar button opens a month grid with hour and minute lists, and Done (or Escape, or a click outside) closes it.
 *
 * The visible box is the control's `id`; what the form submits is a hidden field called `name` holding the same
 * `YYYY-MM-DDTHH:mm` text a native date-time control would send, so nothing on the server changes. Dates and times are
 * wall-clock values with no time zone, handled as plain numbers.
 */

export type DateTimeCopy = Record<
  "placeholder" | "open" | "dialog" | "prevMonth" | "nextMonth" | "hour" | "minute" | "done" | "clear" | "selected",
  string
>;

type Day = { y: number; m: number; d: number }; // m is 1-12
type Time = { h: number; min: number };

const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const sameDay = (a: Day | null, b: Day | null) => !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
const dayKey = (day: Day) => `${pad(day.y, 4)}-${pad(day.m)}-${pad(day.d)}`;
const before = (a: Day, b: Day) => dayKey(a) < dayKey(b);
const shift = (day: Day, days: number): Day => {
  const t = new Date(Date.UTC(day.y, day.m - 1, day.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const addMonths = (y: number, m: number, by: number) => {
  const t = new Date(Date.UTC(y, m - 1 + by, 1));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 };
};

/**
 * The date and time in the Netherlands right now. Pick-ups are Dutch wall-clock times (the server compares them with the
 * Amsterdam clock), so "now" and "today" are read there, not from the visitor's own zone.
 */
const nowInNetherlands = (): { day: Day; time: Time } => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: { y: get("year"), m: get("month"), d: get("day") }, time: { h: get("hour"), min: get("minute") } };
};

const display = (day: Day, time: Time) => `${pad(day.d)}-${pad(day.m)}-${pad(day.y, 4)} ${pad(time.h)}:${pad(time.min)}`;
const iso = (day: Day, time: Time) => `${dayKey(day)}T${pad(time.h)}:${pad(time.min)}`;

/** Reads `2031-03-14T08:30` (or with a space) and `14-03-2031 08:30` (also `/` and `.`); anything else, or a date that does not exist, is null. */
export function parseDateTime(text: string): { day: Day; time: Time } | null {
  const t = text.trim();
  let y: number, m: number, d: number, h: number, min: number;
  const a = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ]+(\d{1,2})[:.](\d{2})$/.exec(t);
  const b = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T,]+(\d{1,2})[:.](\d{2})$/.exec(t);
  if (a) [y, m, d, h, min] = [+a[1], +a[2], +a[3], +a[4], +a[5]];
  else if (b) [d, m, y, h, min] = [+b[1], +b[2], +b[3], +b[4], +b[5]];
  else return null;
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > daysIn(y, m) || h > 23 || min > 59) return null;
  return { day: { y, m, d }, time: { h, min } };
}

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
  </svg>
);

export function DateTimeField({
  id,
  name,
  locale,
  copy,
  defaultValue,
  invalid,
  describedBy,
  className,
  tone = "light",
  size = "sm",
  onValueChange,
}: {
  id: string;
  /** The hidden field the value is submitted as; leave out when the form keeps the value itself (onValueChange). */
  name?: string;
  locale: string;
  copy: DateTimeCopy;
  /** `YYYY-MM-DDTHH:mm`, e.g. the value a failed submission came back with. */
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
  /** The look of the text box, so the field matches the form around it. */
  className?: string;
  /** "dark" when the field sits on a dark background (the booking bar in the hero) */
  tone?: "light" | "dark";
  /** "md" matches 16px fields beside it (the booking bar); either way phones get 16px, so iOS does not zoom in on focus */
  size?: "sm" | "md";
  /** Told the `YYYY-MM-DDTHH:mm` value (or "" for none) whenever it changes, for forms that keep it in state. */
  onValueChange?: (value: string) => void;
}) {
  const initial = useMemo(() => parseDateTime(defaultValue ?? ""), [defaultValue]);
  const [day, setDay] = useState<Day | null>(initial?.day ?? null);
  // Until a time is chosen the hour and minute lists show the current time, read when the picker opens (the page is
  // prerendered, so "now" is not known while rendering; this placeholder is never shown or submitted without a day)
  const [time, setTime] = useState<Time>(initial?.time ?? { h: 0, min: 0 });
  const timeChosen = useRef(!!initial);
  const [text, setText] = useState(initial ? display(initial.day, initial.time) : "");
  const [open, setOpen] = useState(false);
  // Today is read when the calendar opens, not while rendering (the page is prerendered, and "now" is not known then)
  const [today, setToday] = useState<Day | null>(null);
  const [view, setView] = useState<{ y: number; m: number }>({ y: initial?.day.y ?? 2000, m: initial?.day.m ?? 1 });
  const [active, setActive] = useState<Day | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const focusGrid = useRef(false);

  const value = day ? iso(day, time) : "";
  const reported = useRef(value);
  const report = useRef(onValueChange);
  useEffect(() => {
    report.current = onValueChange;
  });
  useEffect(() => {
    if (value === reported.current) return;
    reported.current = value;
    report.current?.(value);
  }, [value]);

  const months = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 1 Jan 2024 is a Monday
  }, [locale]);
  const longDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), [locale]);

  const commit = (nextDay: Day | null, nextTime: Time) => {
    setDay(nextDay);
    setTime(nextTime);
    setText(nextDay ? display(nextDay, nextTime) : "");
  };

  const openPicker = () => {
    const { day: now, time: clock } = nowInNetherlands();
    setToday(now);
    // No time chosen yet and no day either: the lists show the time it is now. With a day chosen the time already shown in
    // the box stays, or the value submitted would drift away from what the visitor can see.
    if (!timeChosen.current && !day) setTime(clock);
    // The chosen day, or today when none is chosen (or the chosen one is already past): the calendar opens on it
    const start = day && !before(day, now) ? day : now;
    setView({ y: start.y, m: start.m });
    setActive(start);
    focusGrid.current = true;
    setOpen(true);
  };
  const closePicker = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) input.current?.focus();
  };

  // A click anywhere else closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // Opening near the bottom of the screen would hide the time and Done: bring the whole calendar into view
  useEffect(() => {
    if (!open) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.current?.querySelector('[role="dialog"]')?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
  }, [open]);

  // Keyboard users land on the highlighted day, and arrow keys move it
  useEffect(() => {
    if (!open || !active || !focusGrid.current) return;
    focusGrid.current = false;
    root.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(active)}"]`)?.focus();
  }, [open, active, view]);

  const moveTo = (target: Day) => {
    if (today && before(target, today)) return;
    setActive(target);
    setView({ y: target.y, m: target.m });
    focusGrid.current = true;
  };
  const onGridKey = (e: KeyboardEvent) => {
    if (!active) return;
    const steps: Record<string, Day | undefined> = {
      ArrowLeft: shift(active, -1),
      ArrowRight: shift(active, 1),
      ArrowUp: shift(active, -7),
      ArrowDown: shift(active, 7),
      Home: shift(active, -((new Date(Date.UTC(active.y, active.m - 1, active.d)).getUTCDay() + 6) % 7)),
      End: shift(active, 6 - ((new Date(Date.UTC(active.y, active.m - 1, active.d)).getUTCDay() + 6) % 7)),
    };
    let target = steps[e.key];
    if (e.key === "PageUp" || e.key === "PageDown") {
      const next = addMonths(active.y, active.m, e.key === "PageUp" ? -1 : 1);
      target = { ...next, d: Math.min(active.d, daysIn(next.y, next.m)) };
    }
    if (target) {
      e.preventDefault();
      moveTo(target);
    }
  };

  // The calendar: weeks of days, Monday first, with the blanks around the month
  const lead = (new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), time.min])].sort((a, b) => a - b);
  const canGoBack = !today || before({ y: today.y, m: today.m, d: 1 }, { ...view, d: 1 });

  const select = "h-9 rounded-md border border-solid border-zinc-200 bg-white px-2 text-sm text-zinc-950 outline-none focus:border-zinc-950";
  const navButton = "grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30";

  return (
    <div
      ref={root}
      className="relative flex items-center justify-between w-full min-w-0 gap-1.5"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        e.stopPropagation();
        closePicker(true);
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <input
        ref={input}
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        value={text}
        placeholder={copy.placeholder}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={`${(className || "").replace(/\bp-0\b/, "")} flex-1 min-w-0 text-[16px] ${size === "md" ? "" : "md:text-[13.5px]"} outline-none bg-transparent`}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const parsed = parseDateTime(raw);
          setDay(parsed?.day ?? null);
          if (parsed) {
            setTime(parsed.time);
            timeChosen.current = true;
          }
        }}
        onBlur={() => day && setText(display(day, time))}
      />
      <button
        type="button"
        aria-label={copy.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closePicker(false) : openPicker())}
        className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent transition-colors ${
          tone === "dark" ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
        }`}
      >
        <CalendarIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={copy.dialog}
          className="absolute top-full left-0 z-50 mt-1 w-[min(19rem,calc(100vw-2rem))] rounded-lg border border-solid border-zinc-200 bg-white p-3 text-left text-zinc-950 normal-case shadow-xl tracking-normal"
        >
          <div className="flex items-center justify-between pb-2">
            <button type="button" aria-label={copy.prevMonth} disabled={!canGoBack} onClick={() => setView((v) => addMonths(v.y, v.m, -1))} className={navButton}>
              <Chevron dir="left" />
            </button>
            <span aria-live="polite" className="text-sm font-semibold capitalize">
              {months.format(new Date(Date.UTC(view.y, view.m - 1, 1)))}
            </span>
            <button type="button" aria-label={copy.nextMonth} onClick={() => setView((v) => addMonths(v.y, v.m, 1))} className={navButton}>
              <Chevron dir="right" />
            </button>
          </div>

          <table role="grid" className="w-full border-collapse text-center" onKeyDown={onGridKey}>
            <thead>
              <tr>
                {weekdays.map((w) => (
                  <th key={w} scope="col" className="pb-1 text-[11px] font-medium text-zinc-500 capitalize">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, i) => (
                <tr key={i}>
                  {week.map((n, j) => {
                    if (n === null) return <td key={j} />;
                    const cell: Day = { y: view.y, m: view.m, d: n };
                    const past = !!today && before(cell, today);
                    const chosen = sameDay(cell, day);
                    return (
                      <td key={j} className="p-0.5">
                        <button
                          type="button"
                          data-day={dayKey(cell)}
                          disabled={past}
                          aria-pressed={chosen}
                          aria-label={longDate.format(new Date(Date.UTC(cell.y, cell.m - 1, cell.d)))}
                          tabIndex={sameDay(cell, active) ? 0 : -1}
                          onClick={() => {
                            setActive(cell);
                            commit(cell, time);
                          }}
                          className={`grid size-9 w-full cursor-pointer place-items-center rounded-md border-0 text-sm tabular-nums disabled:cursor-not-allowed disabled:text-zinc-300 ${
                            chosen ? "bg-zinc-950 font-semibold text-white" : "bg-transparent text-zinc-900 hover:bg-zinc-100"
                          } ${sameDay(cell, today) && !chosen ? "ring-1 ring-inset ring-zinc-400" : ""}`}
                        >
                          {n}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex items-center gap-2 border-t border-solid border-zinc-100 pt-3">
            <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-500">
              {copy.hour}
              <select value={time.h} onChange={(e) => { timeChosen.current = true; commit(day, { ...time, h: Number(e.target.value) }); }} className={select}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden="true" className="mt-5 text-zinc-500">
              :
            </span>
            <label className="flex flex-col gap-1 text-[11px] font-medium text-zinc-500">
              {copy.minute}
              <select value={time.min} onChange={(e) => { timeChosen.current = true; commit(day, { ...time, min: Number(e.target.value) }); }} className={select}>
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                // Back to showing the current time, as when it was first opened
                timeChosen.current = false;
                commit(null, nowInNetherlands().time);
                setActive(today);
              }}
              className="mt-5 ml-auto cursor-pointer border-0 bg-transparent px-2 py-1 text-[13px] font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
            >
              {copy.clear}
            </button>
          </div>

          <p aria-live="polite" className="m-0 mt-3 min-h-5 text-[13px] text-zinc-600">
            {day ? interpolate(copy.selected, { date: longDate.format(new Date(Date.UTC(day.y, day.m - 1, day.d))), time: `${pad(time.h)}:${pad(time.min)}` }) : ""}
          </p>
          <button
            type="button"
            onClick={() => closePicker(true)}
            className="mt-2 h-10 w-full cursor-pointer rounded-md border-0 bg-zinc-950 text-[13px] font-semibold tracking-[0.12em] text-white uppercase hover:bg-zinc-800"
          >
            {copy.done}
          </button>
        </div>
      )}
    </div>
  );
}