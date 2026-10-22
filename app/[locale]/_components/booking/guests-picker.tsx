"use client";

import { useEffect, useId, useRef, useState } from "react";
import { interpolate } from "@/lib/i18n/interpolate";
import type { BookingCopy } from "./copy";
import { MAX_BAGS, MAX_PASSENGERS } from "./trip";

export const guestsText = (t: BookingCopy, pax: number) =>
  pax === 1 ? t.guestOne : interpolate(t.guestMany, { count: pax >= MAX_PASSENGERS ? `${MAX_PASSENGERS}+` : pax });
export const bagsText = (t: BookingCopy, bags: number) => (bags === 0 ? t.bagNone : bags === 1 ? t.bagOne : interpolate(t.bagMany, { count: bags }));

function Stepper({ value, label, min, max, less, more, onChange, display }: {
  value: number; label: string; min: number; max: number; less: string; more: string; onChange: (n: number) => void; display?: string;
}) {
  const button =
    "grid size-11 cursor-pointer place-items-center rounded-full border border-solid border-ink-250 bg-white text-[20px] leading-none text-ink-950 hover:border-ink-950 disabled:cursor-default disabled:border-ink-150 disabled:text-ink-300";
  return (
    <span className="flex items-center gap-3">
      <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
        −
      </button>
      <output aria-label={label} aria-live="polite" className="w-7 text-center text-[16px] font-semibold tabular-nums">
        {display ?? value}
      </output>
      <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
        +
      </button>
    </span>
  );
}

/**
 * Passengers and suitcases, behind one button in the booking bar. On wide screens it drops down under the button; on
 * phones it rises from the bottom of the screen. Escape, Done or a click outside closes it.
 */
export function GuestsPicker({ id, pax, bags, onChange, copy: t, tone, labelledBy }: {
  id: string;
  pax: number;
  bags: number;
  onChange: (next: { pax: number; bags: number }) => void;
  copy: BookingCopy;
  tone: "dark" | "light";
  labelledBy: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return;
    first.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const dark = tone === "dark";

  return (
    <div
      ref={root}
      className="relative"
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
        onClick={() => setOpen((o) => !o)}
        className={`w-full cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[16px] font-medium ${dark ? "text-white" : "text-ink-950"}`}
      >
        {guestsText(t, pax)} · {bagsText(t, bags)}
      </button>
      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={close} />
          <div
            id={dialogId}
            role="dialog"
            aria-label={t.guestsDialog}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] text-ink-950 shadow-2xl md:absolute md:inset-x-auto md:top-full md:right-[-18px] md:bottom-auto md:mt-4 md:w-[340px] md:rounded-2xl md:pb-5"
          >
            <div ref={first} className="flex items-center justify-between gap-4 border-b border-solid border-ink-150 py-3">
              <span className="flex flex-col">
                <strong className="text-[15px]">{t.passengers}</strong>
                <small className="text-[12px] text-ink-600">{t.passengersHint}</small>
              </span>
              <Stepper
                value={pax}
                label={t.passengers}
                min={1}
                max={MAX_PASSENGERS}
                less={t.fewerPassengers}
                more={t.morePassengers}
                display={pax >= MAX_PASSENGERS ? `${MAX_PASSENGERS}+` : undefined}
                onChange={(n) => onChange({ pax: n, bags })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <span className="flex flex-col">
                <strong className="text-[15px]">{t.suitcases}</strong>
                <small className="text-[12px] text-ink-600">{t.suitcasesHint}</small>
              </span>
              <Stepper value={bags} label={t.suitcases} min={0} max={MAX_BAGS} less={t.fewerSuitcases} more={t.moreSuitcases} onChange={(n) => onChange({ pax, bags: n })} />
            </div>
            <p className="m-0 mt-1 text-[12px] text-ink-600">{pax >= MAX_PASSENGERS ? t.partyLarge : t.partyHint}</p>
            <button
              type="button"
              onClick={close}
              className="mt-4 h-12 w-full cursor-pointer rounded-xl border-0 bg-ink-950 text-[14px] font-semibold text-white hover:bg-ink-800"
            >
              {t.done}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
