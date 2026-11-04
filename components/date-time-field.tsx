"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type DateTimeCopy = Record<
  "placeholder" | "open" | "dialog" | "prevMonth" | "nextMonth" | "hour" | "minute" | "period" | "done" | "today" | "clear" | "selected",
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

const to12 = (h: number) => ({ h12: h % 12 || 12, period: h >= 12 ? "PM" : "AM" });
const display = (day: Day, time: Time) => {
  const { h12, period } = to12(time.h);
  return `${pad(day.d)}-${pad(day.m)}-${pad(day.y, 4)} ${h12}:${pad(time.min)} ${period}`;
};
const iso = (day: Day, time: Time) => `${dayKey(day)}T${pad(time.h)}:${pad(time.min)}`;

export function parseDateTime(text: string): { day: Day; time: Time } | null {
  const t = text.trim();
  let y: number, m: number, d: number, h: number, min: number, period: string;
  const a = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ]+(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?$/.exec(t);
  const b = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})[ T,]+(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?$/.exec(t);
  if (a) {
    y = +a[1]; m = +a[2]; d = +a[3]; h = +a[4]; min = +a[5]; period = a[6] ?? "";
  } else if (b) {
    d = +b[1]; m = +b[2]; y = +b[3]; h = +b[4]; min = +b[5]; period = b[6] ?? "";
  } else return null;
  if (period) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (/^p/i.test(period) ? 12 : 0);
  }
  if (y < 1000 || m < 1 || m > 12 || d < 1 || d > daysIn(y, m) || h > 23 || min > 59) return null;
  return { day: { y, m, d }, time: { h, min } };
}

const CalendarIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
const Chevron = ({ dir }: { dir: "up" | "down" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={dir === "up" ? "M6 14l6-6 6 6" : "M6 10l6 6 6-6"} />
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
  boxClassName,
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
  /** Extra classes on the field itself, for a boxed control such as the introduction form. */
  boxClassName?: string;
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
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

  const months = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }), [locale]);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i))).slice(0, 2));
  }, [locale]);
  const longDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }), [locale]);

  const commit = (nextDay: Day | null, nextTime: Time) => {
    setDay(nextDay);
    setTime(nextTime);
    setText(nextDay ? display(nextDay, nextTime) : "");
  };

  const openPicker = () => {
    setNarrow(window.matchMedia("(max-width: 767px)").matches);
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
    if (!open || !narrow) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, narrow]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const target = e.target as Node;
    if (root.current?.contains(target) || dialogRef.current?.contains(target)) return;
    setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  // A phone has no room to hang the calendar off the field: it rises from the bottom of the screen instead.
  useLayoutEffect(() => {
    if (!open) return;
    const sync = () => {
      const phone = window.matchMedia("(max-width: 767px)").matches;
      setNarrow(phone);
      const box = input.current?.getBoundingClientRect();
      if (!phone && box) setAnchor({ top: box.bottom + 8, left: Math.max(8, Math.min(box.left, window.innerWidth - Math.min(448, window.innerWidth - 16))) });
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open]);

  // Opening near the bottom of the screen would hide the time and Done: bring the whole calendar into view
  useEffect(() => {
    if (!open || narrow) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dialogRef.current?.scrollIntoView({ block: "nearest", behavior: calm ? "auto" : "smooth" });
    dialogRef.current?.querySelectorAll<HTMLElement>('[data-time-part][aria-selected="true"]').forEach((el) => {
      const scroller = el.parentElement;
      if (!scroller) return;
      scroller.scrollTop = el.offsetTop - scroller.clientHeight / 2 + el.offsetHeight / 2;
    });
  }, [open, narrow, time.h, time.min]);

  // Keyboard users land on the highlighted day, and arrow keys move it
  useEffect(() => {
    if (!open || !active || !focusGrid.current) return;
    focusGrid.current = false;
    dialogRef.current?.querySelector<HTMLButtonElement>(`[data-day="${dayKey(active)}"]`)?.focus();
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
  const minutes = Array.from({ length: 60 }, (_, i) => i);
  const canGoBack = !today || before({ y: today.y, m: today.m, d: 1 }, { ...view, d: 1 });
  const period = time.h >= 12 ? "PM" : "AM";
  const hour12 = time.h % 12 || 12;
  const setHour12 = (h12: number) => {
    timeChosen.current = true;
    commit(day, { ...time, h: (h12 % 12) + (period === "PM" ? 12 : 0) });
  };
  const setPeriod = (next: "AM" | "PM") => {
    timeChosen.current = true;
    commit(day, { ...time, h: (time.h % 12) + (next === "PM" ? 12 : 0) });
  };
  const applyToday = () => {
    const now = nowInNetherlands();
    timeChosen.current = true;
    commit(now.day, now.time);
    setToday(now.day);
    setView({ y: now.day.y, m: now.day.m });
    setActive(now.day);
  };

  const navBtn = `grid cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[#e8eaed] hover:bg-[#3c4043] disabled:cursor-default disabled:opacity-20 ${narrow ? "size-10" : "size-7"}`;
  const column = `${narrow ? "h-full" : "h-[232px]"} min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;
  const optionCls = (selected: boolean) =>
    `mx-auto block w-[calc(100%-8px)] cursor-pointer rounded-md border-0 px-0 text-center font-medium tabular-nums ${narrow ? "py-2.5 text-[16px]" : "py-1.5 text-[13px]"} ${
      selected ? "bg-[#a8c7fa] text-[#202124]" : "bg-transparent text-[#e8eaed] hover:bg-[#3c4043]"
    }`;

  return (
    <div
      ref={root}
      className={`${fillCell && !open ? "" : "relative"} ${open ? "z-[80]" : ""} flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 ${boxClassName ?? ""}`}
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
        className={`${(className || "").replace(/\bp-0\b/, "")} min-w-0 flex-1 leading-normal ${allowTyping ? "" : "cursor-pointer"} text-[16px] ${size === "md" ? "" : "md:text-[13.5px]"} bg-transparent outline-none`}
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

      {open &&
        createPortal(
          <>
            {narrow && <div className="fixed inset-0 z-[80] bg-[#06122e]/55" onMouseDown={() => closePicker(false)} />}
            <div
              ref={dialogRef}
              id={dialogId}
              role="dialog"
              aria-label={copy.dialog}
              style={narrow ? undefined : { top: anchor?.top ?? 0, left: anchor?.left ?? 8 }}
              className={`${narrow ? "fixed top-1/2 left-1/2 z-[90] max-h-[calc(100svh-2rem)] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto" : "fixed z-[90] w-[min(28rem,calc(100vw-1.5rem))]"} rounded-lg border border-solid border-[#3c4043] bg-[#292a2d] p-3 text-left text-[#e8eaed] normal-case shadow-[0_16px_40px_rgba(0,0,0,0.45)] tracking-normal [color-scheme:light]`}
            >
              <div className={`flex gap-3 ${narrow ? "flex-col" : "items-stretch"}`}>
                    <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 pb-2">
                <span aria-live="polite" className="text-[14px] font-medium text-[#e8eaed]">
                  {months.format(new Date(Date.UTC(view.y, view.m - 1, 1)))}
                </span>
                <span className="flex items-center gap-0.5">
                  <button type="button" aria-label={copy.prevMonth} disabled={!canGoBack} onClick={() => setView((v) => addMonths(v.y, v.m, -1))} className={navBtn}>
                    <Chevron dir="up" />
                  </button>
                  <button type="button" aria-label={copy.nextMonth} onClick={() => setView((v) => addMonths(v.y, v.m, 1))} className={navBtn}>
                    <Chevron dir="down" />
                  </button>
                </span>
              </div>
              <table role="grid" className="w-full border-collapse text-center" onKeyDown={onGridKey}>
                <thead>
                  <tr>
                    {weekdays.map((w, index) => (
                      <th key={index} scope="col" className="pb-1 text-[11px] font-medium text-[#9aa0a6]">
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
                              className={`grid size-8 w-full cursor-pointer place-items-center rounded-md border-0 text-[13px] tabular-nums disabled:cursor-not-allowed disabled:text-[#5f6368] ${
                                chosen ? "bg-[#a8c7fa] font-semibold text-[#202124]" : "bg-transparent text-[#e8eaed] hover:bg-[#3c4043]"
                              } ${sameDay(cell, today) && !chosen ? "ring-1 ring-inset ring-[#8ab4f8]" : ""}`}
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
            </div>
            <div className={`flex shrink-0 gap-1 border-0 border-solid border-[#3c4043] ${narrow ? "h-[132px] w-full border-t pt-2" : "w-[148px] border-l pl-2"}`}>
              <div role="listbox" aria-label={copy.hour} className={column}>
                {Array.from({ length: 12 }, (_, i) => {
                  const h12 = i + 1;
                  const selected = hour12 === h12;
                  return (
                    <button key={h12} type="button" role="option" data-time-part="hour" data-value={h12} aria-selected={selected} onClick={() => setHour12(h12)} className={optionCls(selected)}>
                      {pad(h12)}
                    </button>
                  );
                })}
              </div>
              <div role="listbox" aria-label={copy.minute} className={column}>
                {minutes.map((m) => {
                  const selected = time.min === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      role="option"
                      data-time-part="minute"
                      data-value={m}
                      aria-selected={selected}
                      onClick={() => {
                        timeChosen.current = true;
                        commit(day, { ...time, min: m });
                      }}
                      className={optionCls(selected)}
                    >
                      {pad(m)}
                    </button>
                  );
                })}
              </div>
              <div role="listbox" aria-label={copy.period} className={column}>
                {(["AM", "PM"] as const).map((p) => {
                  const selected = period === p;
                  return (
                    <button key={p} type="button" role="option" data-time-part="period" data-value={p} aria-selected={selected} onClick={() => setPeriod(p)} className={optionCls(selected)}>
                      {p.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between border-0 border-t border-solid border-[#3c4043] pt-2">
            <button
              type="button"
              onClick={() => {
                timeChosen.current = false;
                commit(null, nowInNetherlands().time);
                setActive(today);
              }}
              className="cursor-pointer border-0 bg-transparent px-1 text-[13px] font-medium text-[#8ab4f8] hover:underline"
            >
              {copy.clear}
            </button>
            <button type="button" onClick={applyToday} className="cursor-pointer border-0 bg-transparent px-1 text-[13px] font-medium text-[#8ab4f8] hover:underline">
              {copy.today}
            </button>
          </div>
          <button
            type="button"
            onClick={() => closePicker(true)}
            className="mt-2 h-9 w-full cursor-pointer rounded-md border-0 bg-[#a8c7fa] text-[13px] font-semibold text-[#202124] hover:bg-[#8ab4f8]"
          >
            {copy.done}
          </button>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}