"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LARGEST_CAR_SEATS } from "@/lib/fleet/vehicles";
import { interpolate } from "@/lib/i18n/interpolate";
import type { BookingCopy } from "./copy";
import { MAX_GROUP, MAX_GROUP_BAGS, MAX_SMALL_BAGS } from "./trip";

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

function Stepper({ value, label, min, max, less, more, onChange, admin = false }: {
  value: number; label: string; min: number; max: number; less: string; more: string; onChange: (n: number) => void; admin?: boolean;
}) {
  const button = admin
    ? "stepper-btn grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-solid border-zinc-200 bg-white text-[16px] leading-none text-zinc-950 hover:border-zinc-950 disabled:cursor-default disabled:border-zinc-100 disabled:text-zinc-300"
    : "stepper-btn grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-solid border-[#c5d0e6] bg-[#ffffff] text-[16px] leading-none text-[#10224f] hover:border-[#10224f] disabled:cursor-default disabled:border-[#e4e8f2] disabled:text-[#b7c0d4] sm:size-8";
  return (
    <span className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
      <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
        −
      </button>
      <span className={`box-border inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-solid [color-scheme:light] ${admin ? "h-8 w-10 max-w-10 border-zinc-200 bg-white" : "h-10 w-9 max-w-9 border-[#c5d0e6] bg-[#ffffff] sm:h-8 sm:w-10 sm:max-w-10"}`}>
        <input
          type="number"
          inputMode="numeric"
          size={2}
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
          className={`w-full min-w-0 max-w-full appearance-none border-0 bg-transparent p-0 text-center font-semibold leading-none tabular-nums outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${admin ? "text-[15px] text-zinc-950" : "text-xs text-[#10224f] sm:text-[15px]"}`}
        />
      </span>
      <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
        +
      </button>
    </span>
  );
}

type PanelBox = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

/**
 * Keep the guests panel on screen.
 * Site: centered on the field.
 * Admin: left edge and width follow the field (never narrower than 320px).
 * Both always open directly below the field.
 */
function placePanel(anchor: HTMLElement, admin: boolean): PanelBox {
  const margin = 16;
  const rect = anchor.getBoundingClientRect();
  const gap = admin ? 8 : 6;
  const width = admin
    ? Math.min(Math.max(rect.width, 320), window.innerWidth - margin * 2)
    : Math.min(340, window.innerWidth - margin * 2);
  const left = admin
    ? Math.min(Math.max(margin, rect.left), window.innerWidth - margin - width)
    : Math.min(Math.max(margin, rect.left + (rect.width - width) / 2), window.innerWidth - margin - width);
  const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
  // Always directly below the field: it never flips above, so it does not jump up and down
  return { top: rect.bottom + gap, left, width, maxHeight: Math.max(160, spaceBelow) };
}

/**
 * Passengers, large suitcases and small hand luggage, behind one button in the booking bar.
 * Escape, Done or a click outside closes it.
 */
export function GuestsPicker({ id, pax, bags, small, set, onChange, copy: t, tone, labelledBy, describedBy, appearance = "site" }: {
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
  /** The booking bar uses the site palette. The admin form uses the light zinc panel. */
  appearance?: "site" | "admin";
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<PanelBox | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const dark = tone === "dark";
  const admin = appearance === "admin";
  // Closed when Next hides the page (it keeps pages mounted), so it is not still open on the way back
  useLayoutEffect(() => () => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    // Not enough room under the field for the panel: bring the field up the screen rather than flipping the panel above it
    if (trigger.current && window.innerHeight - trigger.current.getBoundingClientRect().bottom < 340) {
      trigger.current.scrollIntoView({ block: "center" });
    }
    const place = () => {
      if (trigger.current) setBox(placePanel(trigger.current, admin));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, admin]);

  useEffect(() => {
    if (!open) return;
    first.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (e: MouseEvent) => {
      const node = e.target as Node;
      if (root.current?.contains(node) || panel.current?.contains(node)) return;
      setOpen(false);
      if (!set) onChange({ pax, bags, small });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      if (!set) onChange({ pax, bags, small });
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, set, pax, bags, small, onChange]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
    // However it is closed (Done, Escape, a press outside), the visitor has seen the counts and left them: that is the answer
    if (!set) onChange({ pax, bags, small });
  };
  const done = close;
  // Admin panel gets roomier rows; the site panel keeps its compact spacing
  const row = `flex items-center justify-between gap-2 ${admin ? "py-3" : "py-1"}`;

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
        className={
          admin
            ? `flex h-10 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-left text-sm shadow-card outline-none transition hover:border-zinc-300 focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/5 ${
                set ? "font-medium text-zinc-950" : "font-normal text-zinc-400"
              }`
            : `flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-[14px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset ${
                dark ? "after:ring-white/60" : "after:ring-ink-950"
              } ${set ? (dark ? "text-white" : "text-ink-950") : dark ? "font-normal text-ink-400" : "font-normal text-ink-475"}`
        }
      >
        <span className="min-w-0 flex-1 whitespace-normal">{set ? partyLine(t, pax, bags, small) : t.guestsPlaceholder}</span>
        <span className={`shrink-0 ${admin ? "text-zinc-500" : dark ? "text-ink-250" : "text-ink-600"}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open &&
        box &&
        createPortal(
          <div
            ref={panel}
            id={dialogId}
            role="dialog"
            aria-label={t.guestsDialog}
            style={{ top: box.top, bottom: box.bottom, left: box.left, width: box.width, maxHeight: box.maxHeight }}
            className={`guests-landing-modal fixed z-[80] box-border overflow-y-auto overscroll-contain rounded-xl border border-solid font-sans shadow-lg ${
              admin
                ? "border-zinc-200 bg-white px-5 py-4 text-zinc-950 shadow-pop [color-scheme:light]"
                : "border-ink-300 bg-white px-3 py-2 text-ink-950 sm:px-3.5 sm:py-2.5"
            }`}
          >
            <div ref={first} className={row}>
              <span className="flex min-w-0 flex-col">
                <strong className="text-xs font-semibold sm:text-sm">{t.passengers}</strong>
                <small className={`leading-tight ${admin ? "mt-0.5 text-xs text-zinc-500" : "text-[11px] text-ink-600"}`}>{t.passengersHint}</small>
              </span>
              <Stepper
                value={pax}
                label={t.passengers}
                min={1}
                max={MAX_GROUP}
                less={t.fewerPassengers}
                more={t.morePassengers}
                admin={admin}
                onChange={(n) => onChange({ pax: n, bags, small })}
              />
            </div>
            <div className={row}>
              <span className="flex min-w-0 flex-col">
                <strong className="text-xs font-semibold sm:text-sm">{t.suitcases}</strong>
                <small className={`leading-tight ${admin ? "mt-0.5 text-xs text-zinc-500" : "text-[11px] text-ink-600"}`}>{t.suitcasesHint}</small>
              </span>
              <Stepper admin={admin} value={Math.min(bags, MAX_GROUP_BAGS)} label={t.suitcases} min={0} max={MAX_GROUP_BAGS} less={t.fewerSuitcases} more={t.moreSuitcases} onChange={(n) => onChange({ pax, bags: Math.min(MAX_GROUP_BAGS, n), small })} />
            </div>
            <div className={row}>
              <span className="flex min-w-0 flex-col">
                <strong className="text-xs font-semibold sm:text-sm">{t.smallBags}</strong>
                <small className={`leading-tight ${admin ? "mt-0.5 text-xs text-zinc-500" : "text-[11px] text-ink-600"}`}>{t.smallBagsHint}</small>
              </span>
              <Stepper admin={admin} value={Math.min(small, MAX_SMALL_BAGS)} label={t.smallBags} min={0} max={MAX_SMALL_BAGS} less={t.fewerSmallBags} more={t.moreSmallBags} onChange={(n) => onChange({ pax, bags, small: Math.min(MAX_SMALL_BAGS, n) })} />
            </div>
            <p className={`m-0 leading-snug ${admin ? "mt-2 text-xs text-zinc-500" : "mt-1 text-[11px] text-ink-600"}`}>{pax > LARGEST_CAR_SEATS ? t.partyLarge : t.partyHint}</p>
            <button
              type="button"
              onClick={done}
              className={`guests-done-btn w-full cursor-pointer rounded-lg border-0 text-xs font-semibold text-white sm:text-[13px] ${
                admin ? "mt-4 h-11 bg-zinc-950 hover:bg-zinc-800" : "mt-1.5 h-10 bg-ink-950 hover:bg-ink-800 sm:mt-2 sm:h-9"
              }`}
            >
              {t.done}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}