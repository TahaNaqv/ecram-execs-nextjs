"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { LARGEST_CAR_SEATS } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { BookingCopy } from "./copy";
import { MAX_BAGS, MAX_PASSENGERS, MAX_SMALL_BAGS } from "./trip";

export const guestsText = (t: BookingCopy, pax: number) =>
  pax === 1 ? t.guestOne : interpolate(t.guestMany, { count: pax });
export const bagsText = (t: BookingCopy, bags: number) => (bags === 0 ? t.bagNone : bags === 1 ? t.bagOne : interpolate(t.bagMany, { count: bags }));

const counted = (n: number, one: string, many: string) => (n === 1 ? one : interpolate(many, { count: n }));

/** "1 large bag, 2 small bags" — for sentences, not the tight guest button. */
export const luggageLine = (t: BookingCopy, bags: number, small: number) =>
  `${counted(bags, t.largeOne, t.largeMany)}, ${counted(small, t.smallOne, t.smallMany)}`;

/** "2 guests · 3 bags (1 large, 2 small)". Short enough for the booking bar. */
export const partyLine = (t: BookingCopy, pax: number, bags: number, small: number) => {
  const guests = pax === 1 ? t.guestOne : interpolate(t.guestMany, { count: pax });
  const total = bags + small;
  const all = total === 1 ? t.bagOne : interpolate(t.bagMany, { count: total });
  return `${guests} · ${all} ${interpolate(t.bagSplit, { large: bags, small })}`;
};

function Stepper({ value, label, min, max, less, more, onChange }: {
  value: number; label: string; min: number; max: number; less: string; more: string; onChange: (n: number) => void;
}) {
  const button =
    "grid size-8 cursor-pointer place-items-center rounded-full border border-solid border-[#c5d0e6] bg-[#ffffff] text-[16px] leading-none text-[#10224f] hover:border-[#10224f] disabled:cursor-default disabled:border-[#e4e8f2] disabled:text-[#b7c0d4]";
  return (
    <span className="flex items-center gap-2.5">
      <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
        −
      </button>
      <span className="box-border inline-flex h-8 w-10 shrink-0 items-center justify-center rounded-lg border border-solid border-[#c5d0e6] bg-[#ffffff] [color-scheme:light]">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          aria-label={label}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return;
            const n = Number(raw);
            if (!Number.isInteger(n)) return;
            onChange(Math.min(max, Math.max(min, n)));
          }}
          className="w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-center text-[15px] font-semibold leading-none text-[#10224f] tabular-nums outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </span>
      <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
        +
      </button>
    </span>
  );
}

/**
 * Passengers, large suitcases and small hand luggage, behind one button in the booking bar.
 * Escape, Done or a click outside closes it.
 */
export function GuestsPicker({ id, pax, bags, small, set, onChange, copy: t, tone, labelledBy, describedBy }: {
  id: string;
  pax: number;
  bags: number;
  small: number;
  /** False until the visitor has chosen: the button then asks for it instead of showing a count (QA round 3, bug 7) */
  set: boolean;
  onChange: (next: { pax: number; bags: number; small: number }) => void;
  copy: BookingCopy;
  tone: "dark" | "light";
  labelledBy: string;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  // Closed when Next hides the page (it keeps pages mounted), so it is not still open on the way back
  useLayoutEffect(() => () => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    first.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (e: MouseEvent) => {
      if (root.current?.contains(e.target as Node)) return;
      setOpen(false);
      if (!set) onChange({ pax, bags, small });
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open, set, pax, bags, small, onChange]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
    // However it is closed (Done, Escape, a press outside), the visitor has seen the counts and left them: that is the answer
    if (!set) onChange({ pax, bags, small });
  };
  const done = close;
  const dark = tone === "dark";

  return (
    // Not `relative`: the press area of the button and the dialog are positioned against the cell around it
    <div
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-labelledby={`${labelledBy} ${id}`}
        aria-describedby={describedBy}
        onClick={() => setOpen((o) => !o)}
        // The empty after: element stretches the press area over the whole cell, label and padding included
        className={`flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-[16px] font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset ${
          dark ? "after:ring-white/60" : "after:ring-ink-950"
        } ${set ? (dark ? "text-white" : "text-ink-950") : dark ? "font-normal text-ink-400" : "font-normal text-ink-475"}`}
      >
        <span className="whitespace-normal">{set ? partyLine(t, pax, bags, small) : t.guestsPlaceholder}</span>
        <span className={`shrink-0 ${dark ? "text-ink-250" : "text-ink-600"}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <>
          <div
            id={dialogId}
            role="dialog"
            aria-label={t.guestsDialog}
            className="absolute top-full right-0 left-0 z-[70] mt-1.5 max-h-[min(70dvh,26rem)] overflow-y-auto rounded-2xl border border-solid border-ink-300 bg-white p-3 text-ink-950 shadow-2xl md:left-auto md:w-[300px]"
          >
            <div ref={first} className="flex items-center justify-between gap-2 py-1">
              <span className="flex min-w-0 flex-col">
                <strong className="text-[13px]">{t.passengers}</strong>
                <small className="text-[11px] text-ink-600">{t.passengersHint}</small>
              </span>
              <Stepper
                value={pax}
                label={t.passengers}
                min={1}
                max={MAX_PASSENGERS}
                less={t.fewerPassengers}
                more={t.morePassengers}
                onChange={(n) => onChange({ pax: n, bags, small })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="flex min-w-0 flex-col">
                <strong className="text-[13px]">{t.suitcases}</strong>
                <small className="text-[11px] text-ink-600">{t.suitcasesHint}</small>
              </span>
              <Stepper value={Math.min(bags, MAX_BAGS)} label={t.suitcases} min={0} max={MAX_BAGS} less={t.fewerSuitcases} more={t.moreSuitcases} onChange={(n) => onChange({ pax, bags: Math.min(MAX_BAGS, n), small })} />
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="flex min-w-0 flex-col">
                <strong className="text-[13px]">{t.smallBags}</strong>
                <small className="text-[11px] text-ink-600">{t.smallBagsHint}</small>
              </span>
              <Stepper value={Math.min(small, MAX_SMALL_BAGS)} label={t.smallBags} min={0} max={MAX_SMALL_BAGS} less={t.fewerSmallBags} more={t.moreSmallBags} onChange={(n) => onChange({ pax, bags, small: Math.min(MAX_SMALL_BAGS, n) })} />
            </div>
            <p className="m-0 mt-1 text-[11px] text-ink-600">{pax > LARGEST_CAR_SEATS ? t.partyLarge : t.partyHint}</p>
            <button
              type="button"
              onClick={done}
              className="mt-2 h-9 w-full cursor-pointer rounded-lg border-0 bg-ink-950 text-[13px] font-semibold text-white hover:bg-ink-800"
            >
              {t.done}
            </button>
          </div>
        </>
      )}
    </div>
  );
}