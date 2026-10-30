"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type DateTimeCopy = Record<
  "placeholder" | "open" | "dialog" | "prevMonth" | "nextMonth" | "hour" | "minute" | "done" | "clear" | "selected",
  string
>;

type Day = { y: number; m: number; d: number };
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

/** The date and time in the Netherlands right now: pick-ups are Dutch wall-clock times, so "today" and "now" are read there, not in the visitor's own zone. */
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
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  allowTyping = false,
  fillCell = false,
  onValueChange,
}: {
  id: string;
  name?: string;
  locale: string;
  copy: DateTimeCopy;
  defaultValue?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  tone?: "light" | "dark";
  size?: "sm" | "md";
  /** Visitors choose in the picker (QA round 3, bug 10); the team's own booking form lets staff key in a date they are told by phone. */
  allowTyping?: boolean;
  /** Stretch the press area over the whole booking-bar cell, label and padding included. */
  fillCell?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const initial = useMemo(() => parseDateTime(defaultValue ?? ""), [defaultValue]);
  const [day, setDay] = useState<Day | null>(initial?.day ?? null);
  // Until a time is chosen the hour and minute lists show the time it is now in the Netherlands, read when the picker opens (the
  // page is prerendered, so "now" is not known while rendering; this placeholder is never shown or submitted without a day)
  const [time, setTime] = useState<Time>(initial?.time ?? { h: 0, min: 0 });
  const timeChosen = useRef(!!initial);
  const [text, setText] = useState(initial ? display(initial.day, initial.time) : "");
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState<Day | null>(null);
  const [view, setView] = useState<{ y: number; m: number }>({ y: initial?.day.y ?? 2000, m: initial?.day.m ?? 1 });
  const [active, setActive] = useState<Day | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const focusGrid = useRef(false);
  const dialogId = useId();
  // Closed when Next hides the page (it keeps pages mounted), so it is not still open on the way back
  useLayoutEffect(() => () => setOpen(false), []);

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

  const months = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }), [locale]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))));
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

  const lead = (new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const minutes = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), time.min])].sort((a, b) => a - b);
  const canGoBack = !today || before({ y: today.y, m: today.m, d: 1 }, { ...view, d: 1 });

  const selectStyle = "h-9 rounded-lg border border-solid border-ink-200 bg-ink-50 px-3 text-xs font-semibold text-ink-950 outline-none focus:border-ink-950 focus:bg-white";
  const navBtn = "grid size-7 cursor-pointer place-items-center rounded-lg border border-solid border-ink-150 bg-white text-ink-700 hover:bg-ink-100 disabled:opacity-20";

  return (
    <div
      ref={root}
      className={`${fillCell && !open ? "" : "relative"} ${open ? "z-[80]" : ""} flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5`}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !open) return;
        e.stopPropagation();
        closePicker(true);
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      {fillCell && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => (open ? closePicker(false) : openPicker())}
          className="absolute inset-0 z-[1] cursor-pointer border-0 bg-transparent p-0"
        />
      )}
      {/* For visitors a date and time are chosen in the picker, not typed: the box only shows the choice, and opens the picker */}
      <input
        ref={input}
        id={id}
        type="text"
        readOnly={!allowTyping}
        role={allowTyping ? undefined : "combobox"}
        inputMode={allowTyping ? "text" : "none"}
        autoComplete="off"
        value={text}
        placeholder={copy.placeholder}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-haspopup={allowTyping ? undefined : "dialog"}
        aria-expanded={allowTyping ? undefined : open}
        aria-controls={!allowTyping && open ? dialogId : undefined}
        className={`${(className || "").replace(/\bp-0\b/, "")} min-w-0 flex-1 ${allowTyping ? "" : "cursor-pointer"} text-[16px] ${size === "md" ? "" : "md:text-[13.5px]"} bg-transparent outline-none`}
        onClick={allowTyping ? undefined : () => (open ? closePicker(false) : openPicker())}
        onKeyDown={(e) => {
          if (allowTyping || open || (e.key !== "Enter" && e.key !== " " && e.key !== "ArrowDown")) return;
          e.preventDefault();
          openPicker();
        }}
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
        onBlur={() => allowTyping && day && setText(display(day, time))}
      />
      <button
        type="button"
        aria-label={copy.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? closePicker(false) : openPicker())}
        className={`relative z-[2] grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent transition-colors ${
          tone === "dark" ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
        }`}
      >
        <CalendarIcon />
      </button>

      {open && (
        <div
          id={dialogId}
          role="dialog"
          aria-label={copy.dialog}
          className="absolute top-full left-0 z-[60] mt-2 w-[18rem] rounded-2xl border border-solid border-ink-200 bg-white p-4 text-left text-ink-950 normal-case shadow-[0_16px_32px_rgba(0,0,0,0.1)] tracking-normal"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-solid border-ink-100">
            <button type="button" aria-label={copy.prevMonth} disabled={!canGoBack} onClick={() => setView((v) => addMonths(v.y, v.m, -1))} className={navBtn}>
              <Chevron dir="left" />
            </button>
            <span aria-live="polite" className="text-[13px] font-semibold tracking-wide capitalize text-ink-950">
              {months.format(new Date(Date.UTC(view.y, view.m - 1, 1)))}
            </span>
            <button type="button" aria-label={copy.nextMonth} onClick={() => setView((v) => addMonths(v.y, v.m, 1))} className={navBtn}>
              <Chevron dir="right" />
            </button>
          </div>

          {/* Grid */}
          <table role="grid" className="w-full border-collapse text-center mt-3" onKeyDown={onGridKey}>
            <thead>
              <tr>
                {weekdays.map((w, index) => (
                  <th key={index} scope="col" className="pb-2 text-[10px] font-bold text-ink-400 uppercase">
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
                      <td key={j} className="p-1">
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
                          className={`grid size-7 w-full cursor-pointer place-items-center rounded-lg border-0 text-xs font-medium tabular-nums transition-all disabled:cursor-not-allowed disabled:text-ink-200 ${
                            chosen 
                              ? "bg-ink-950 font-bold text-white shadow-sm" 
                              : "bg-transparent text-ink-800 hover:bg-ink-100"
                          } ${sameDay(cell, today) && !chosen ? "ring-1 ring-inset ring-ink-400" : ""}`}
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

          {/* Time Picker Compact Row with proper padding */}
          <div className="mt-3.5 flex items-center justify-between border-t border-solid border-ink-100 pt-3.5 px-0.5">
            <div className="flex items-center gap-2">
              <select aria-label={copy.hour} value={time.h} onChange={(e) => { timeChosen.current = true; commit(day, { ...time, h: Number(e.target.value) }); }} className={selectStyle}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {pad(h)} {copy.hour}
                  </option>
                ))}
              </select>
              <span className="text-xs font-bold text-ink-400 px-0.5">:</span>
              <select aria-label={copy.minute} value={time.min} onChange={(e) => { timeChosen.current = true; commit(day, { ...time, min: Number(e.target.value) }); }} className={selectStyle}>
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {pad(m)} {copy.minute}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                timeChosen.current = false;
                commit(null, nowInNetherlands().time);
                setActive(today);
              }}
              className="cursor-pointer border-0 bg-transparent text-[11px] font-medium text-ink-500 underline hover:text-ink-950 px-1"
            >
              {copy.clear}
            </button>
          </div>

          {/* Done Button */}
          <button
            type="button"
            onClick={() => closePicker(true)}
            className="mt-3.5 h-9 w-full cursor-pointer rounded-xl border-0 bg-ink-950 text-xs font-semibold tracking-wider text-white uppercase transition-all hover:bg-ink-800 shadow-sm"
          >
            {copy.done}
          </button>
        </div>
      )}
    </div>
  );
}