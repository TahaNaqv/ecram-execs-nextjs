// "use client";

// import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
// import { createPortal } from "react-dom";
// import { LARGEST_CAR_SEATS } from "@/lib/fleet/vehicles";
// import { interpolate } from "@/lib/i18n/interpolate";
// import type { BookingCopy } from "./copy";
// import { MAX_GROUP, MAX_GROUP_BAGS, MAX_SMALL_BAGS } from "./trip";

// export const guestsText = (t: BookingCopy, pax: number) =>
//   pax === 1 ? t.guestOne : interpolate(t.guestMany, { count: pax });
// export const bagsText = (t: BookingCopy, bags: number) => (bags === 0 ? t.bagNone : bags === 1 ? t.bagOne : interpolate(t.bagMany, { count: bags }));

// const counted = (n: number, one: string, many: string) => (n === 1 ? one : interpolate(many, { count: n }));

// /** "1 large bag, 2 small bags" — for sentences, not the tight guest button. */
// export const luggageLine = (t: BookingCopy, bags: number, small: number) =>
//   `${counted(bags, t.largeOne, t.largeMany)}, ${counted(small, t.smallOne, t.smallMany)}`;

// /** "2 guests · 3 bags (1 large, 2 small)". Short enough for the booking bar. */
// export const partyLine = (t: BookingCopy, pax: number, bags: number, small: number) => {
//   const guests = pax === 1 ? t.guestOne : interpolate(t.guestMany, { count: pax });
//   const total = bags + small;
//   const all = total === 1 ? t.bagOne : interpolate(t.bagMany, { count: total });
//   return `${guests} · ${all} ${interpolate(t.bagSplit, { large: bags, small })}`;
// };

// function Stepper({ value, label, min, max, less, more, onChange }: {
//   value: number; label: string; min: number; max: number; less: string; more: string; onChange: (n: number) => void;
// }) {
//   const button =
//     "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-solid border-[#c5d0e6] bg-[#ffffff] text-[16px] leading-none text-[#10224f] hover:border-[#10224f] disabled:cursor-default disabled:border-[#e4e8f2] disabled:text-[#b7c0d4] sm:size-8";
//   return (
//     <span className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
//       <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
//         −
//       </button>
//       <span className="box-border inline-flex h-10 w-9 max-w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-solid border-[#c5d0e6] bg-[#ffffff] [color-scheme:light] sm:h-8 sm:w-10 sm:max-w-10">
//         <input
//           type="number"
//           inputMode="numeric"
//           size={2}
//           min={min}
//           max={max}
//           aria-label={label}
//           value={value}
//           onChange={(e) => {
//             const raw = e.target.value;
//             if (raw === "") return;
//             const n = Number(raw);
//             if (!Number.isInteger(n)) return;
//             onChange(Math.min(max, Math.max(min, n)));
//           }}
//           className="w-full min-w-0 max-w-full appearance-none border-0 bg-transparent p-0 text-center text-xs font-semibold leading-none text-[#10224f] tabular-nums outline-none [-moz-appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
//         />
//       </span>
//       <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
//         +
//       </button>
//     </span>
//   );
// }

// type PanelBox = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

// /** Keep the guests panel on screen: centered on the field, flipped above it when the space below is short. */
// function placePanel(anchor: HTMLElement): PanelBox {
//   const margin = 16;
//   const rect = anchor.getBoundingClientRect();
//   const width = Math.min(340, window.innerWidth - margin * 2);
//   const left = Math.min(Math.max(margin, rect.left + (rect.width - width) / 2), window.innerWidth - margin - width);
//   const gap = 6;
//   const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
//   const spaceAbove = rect.top - margin - gap;
//   const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
//   const maxHeight = Math.max(160, below ? spaceBelow : spaceAbove);
//   return below
//     ? { top: rect.bottom + gap, left, width, maxHeight }
//     : { bottom: window.innerHeight - rect.top + gap, left, width, maxHeight };
// }

// /**
//  * Passengers, large suitcases and small hand luggage, behind one button in the booking bar.
//  * Escape, Done or a click outside closes it.
//  */
// export function GuestsPicker({ id, pax, bags, small, set, onChange, copy: t, tone, labelledBy, describedBy }: {
//   id: string;
//   pax: number;
//   bags: number;
//   small: number;
//   /** False until the visitor has chosen: the button then asks for it instead of showing a count (QA round 3, bug 7) */
//   set: boolean;
//   onChange: (next: { pax: number; bags: number; small: number }) => void;
//   copy: BookingCopy;
//   tone: "dark" | "light";
//   labelledBy: string;
//   describedBy?: string;
// }) {
//   const [open, setOpen] = useState(false);
//   const [box, setBox] = useState<PanelBox | null>(null);
//   const root = useRef<HTMLDivElement>(null);
//   const trigger = useRef<HTMLButtonElement>(null);
//   const panel = useRef<HTMLDivElement>(null);
//   const first = useRef<HTMLDivElement>(null);
//   const dialogId = useId();
//   // Closed when Next hides the page (it keeps pages mounted), so it is not still open on the way back
//   useLayoutEffect(() => () => setOpen(false), []);

//   useLayoutEffect(() => {
//     if (!open) return;
//     const place = () => {
//       if (trigger.current) setBox(placePanel(trigger.current));
//     };
//     place();
//     window.addEventListener("resize", place);
//     window.addEventListener("scroll", place, true);
//     return () => {
//       window.removeEventListener("resize", place);
//       window.removeEventListener("scroll", place, true);
//     };
//   }, [open]);

//   useEffect(() => {
//     if (!open) return;
//     first.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
//     const outside = (e: MouseEvent) => {
//       const node = e.target as Node;
//       if (root.current?.contains(node) || panel.current?.contains(node)) return;
//       setOpen(false);
//       if (!set) onChange({ pax, bags, small });
//     };
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key !== "Escape") return;
//       e.stopPropagation();
//       setOpen(false);
//       trigger.current?.focus();
//       if (!set) onChange({ pax, bags, small });
//     };
//     document.addEventListener("mousedown", outside);
//     document.addEventListener("keydown", onKey);
//     return () => {
//       document.removeEventListener("mousedown", outside);
//       document.removeEventListener("keydown", onKey);
//     };
//   }, [open, set, pax, bags, small, onChange]);

//   const close = () => {
//     setOpen(false);
//     trigger.current?.focus();
//     // However it is closed (Done, Escape, a press outside), the visitor has seen the counts and left them: that is the answer
//     if (!set) onChange({ pax, bags, small });
//   };
//   const done = close;
//   const dark = tone === "dark";

//   return (
//     // Not `relative`: the press area of the button and the dialog are positioned against the cell around it
//     <div
//       ref={root}
//       onKeyDown={(e) => {
//         if (e.key === "Escape" && open) {
//           e.stopPropagation();
//           close();
//         }
//       }}
//     >
//       <button
//         ref={trigger}
//         id={id}
//         type="button"
//         aria-haspopup="dialog"
//         aria-expanded={open}
//         aria-controls={dialogId}
//         aria-labelledby={`${labelledBy} ${id}`}
//         aria-describedby={describedBy}
//         onClick={() => setOpen((o) => !o)}
//         // The empty after: element stretches the press area over the whole cell, label and padding included
//         className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-[14px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset ${
//           dark ? "after:ring-white/60" : "after:ring-ink-950"
//         } ${set ? (dark ? "text-white" : "text-ink-950") : dark ? "font-normal text-ink-400" : "font-normal text-ink-475"}`}
//       >
//         <span className="min-w-0 flex-1 whitespace-normal">{set ? partyLine(t, pax, bags, small) : t.guestsPlaceholder}</span>
//         <span className={`shrink-0 ${dark ? "text-ink-250" : "text-ink-600"}`} aria-hidden="true">
//           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`}>
//             <path d="M6 9l6 6 6-6" />
//           </svg>
//         </span>
//       </button>
//       {open &&
//         box &&
//         createPortal(
//           <div
//             ref={panel}
//             id={dialogId}
//             role="dialog"
//             aria-label={t.guestsDialog}
//             style={{ top: box.top, bottom: box.bottom, left: box.left, width: box.width, maxHeight: box.maxHeight }}
//             className="fixed z-[80] box-border overflow-y-auto overscroll-contain rounded-xl border border-solid border-ink-300 bg-white px-3 py-2 text-ink-950 shadow-lg sm:px-3.5 sm:py-2.5"
//           >
//             <div ref={first} className="flex items-center justify-between gap-2 py-1">
//               <span className="flex min-w-0 flex-col">
//                 <strong className="text-xs sm:text-sm">{t.passengers}</strong>
//                 <small className="text-[11px] leading-tight text-ink-600">{t.passengersHint}</small>
//               </span>
//               <Stepper
//                 value={pax}
//                 label={t.passengers}
//                 min={1}
//                 max={MAX_GROUP}
//                 less={t.fewerPassengers}
//                 more={t.morePassengers}
//                 onChange={(n) => onChange({ pax: n, bags, small })}
//               />
//             </div>
//             <div className="flex items-center justify-between gap-2 py-1">
//               <span className="flex min-w-0 flex-col">
//                 <strong className="text-xs sm:text-sm">{t.suitcases}</strong>
//                 <small className="text-[11px] leading-tight text-ink-600">{t.suitcasesHint}</small>
//               </span>
//               <Stepper value={Math.min(bags, MAX_GROUP_BAGS)} label={t.suitcases} min={0} max={MAX_GROUP_BAGS} less={t.fewerSuitcases} more={t.moreSuitcases} onChange={(n) => onChange({ pax, bags: Math.min(MAX_GROUP_BAGS, n), small })} />
//             </div>
//             <div className="flex items-center justify-between gap-2 py-1">
//               <span className="flex min-w-0 flex-col">
//                 <strong className="text-xs sm:text-sm">{t.smallBags}</strong>
//                 <small className="text-[11px] leading-tight text-ink-600">{t.smallBagsHint}</small>
//               </span>
//               <Stepper value={Math.min(small, MAX_SMALL_BAGS)} label={t.smallBags} min={0} max={MAX_SMALL_BAGS} less={t.fewerSmallBags} more={t.moreSmallBags} onChange={(n) => onChange({ pax, bags, small: Math.min(MAX_SMALL_BAGS, n) })} />
//             </div>
//             <p className="m-0 mt-1 text-[11px] leading-snug text-ink-600">{pax > LARGEST_CAR_SEATS ? t.partyLarge : t.partyHint}</p>
//             <button
//               type="button"
//               onClick={done}
//               className="mt-1.5 h-10 w-full cursor-pointer rounded-lg border-0 bg-ink-950 text-xs font-semibold text-white hover:bg-ink-800 sm:mt-2 sm:h-9 sm:text-[13px]"
//             >
//               {t.done}
//             </button>
//           </div>,
//           document.body,
//         )}
//     </div>
//   );
// }

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

function Stepper({ value, label, min, max, less, more, onChange }: {
  value: number; label: string; min: number; max: number; less: string; more: string; onChange: (n: number) => void;
}) {
  const button =
    "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-solid border-[#c5d0e6] bg-[#ffffff] text-[16px] leading-none text-[#10224f] hover:border-[#10224f] disabled:cursor-default disabled:border-[#e4e8f2] disabled:text-[#b7c0d4] sm:size-8";
  return (
    <span className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
      <button type="button" aria-label={less} disabled={value <= min} onClick={() => onChange(value - 1)} className={button}>
        −
      </button>
      <span className="box-border inline-flex h-10 w-9 max-w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-solid border-[#c5d0e6] bg-[#ffffff] [color-scheme:light] sm:h-8 sm:w-10 sm:max-w-10">
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
          className="w-full min-w-0 max-w-full appearance-none border-0 bg-transparent p-0 text-center text-xs font-semibold leading-none text-[#10224f] tabular-nums outline-none [-moz-appearance:textfield] sm:text-[15px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </span>
      <button type="button" aria-label={more} disabled={value >= max} onClick={() => onChange(value + 1)} className={button}>
        +
      </button>
    </span>
  );
}

type PanelBox = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

/** Keep the guests panel on screen: centered on the field, flipped above it when the space below is short. */
function placePanel(anchor: HTMLElement): PanelBox {
  const margin = 16;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(340, window.innerWidth - margin * 2);
  const left = Math.min(Math.max(margin, rect.left + (rect.width - width) / 2), window.innerWidth - margin - width);
  const gap = 6;
  const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
  const spaceAbove = rect.top - margin - gap;
  const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, below ? spaceBelow : spaceAbove);
  return below
    ? { top: rect.bottom + gap, left, width, maxHeight }
    : { bottom: window.innerHeight - rect.top + gap, left, width, maxHeight };
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
  const [box, setBox] = useState<PanelBox | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  // Closed when Next hides the page (it keeps pages mounted), so it is not still open on the way back
  useLayoutEffect(() => () => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (trigger.current) setBox(placePanel(trigger.current));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

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
        className={`flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left text-[14px] leading-snug font-medium outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset ${
          dark ? "after:ring-white/60" : "after:ring-ink-950"
        } ${set ? (dark ? "text-white" : "text-ink-950") : dark ? "font-normal text-ink-400" : "font-normal text-ink-475"}`}
      >
        <span className="min-w-0 flex-1 whitespace-normal">{set ? partyLine(t, pax, bags, small) : t.guestsPlaceholder}</span>
        <span className={`shrink-0 ${dark ? "text-ink-250" : "text-ink-600"}`} aria-hidden="true">
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
            className="fixed z-[80] box-border font-sans overflow-y-auto overscroll-contain rounded-xl border border-solid border-ink-300 bg-white px-3 py-2 text-ink-950 shadow-lg sm:px-3.5 sm:py-2.5"
          >
            <div ref={first} className="flex items-center justify-between gap-2 py-1">
              <span className="flex min-w-0 flex-col">
                <strong className="text-xs sm:text-sm font-semibold">{t.passengers}</strong>
                <small className="text-[11px] leading-tight text-ink-600">{t.passengersHint}</small>
              </span>
              <Stepper
                value={pax}
                label={t.passengers}
                min={1}
                max={MAX_GROUP}
                less={t.fewerPassengers}
                more={t.morePassengers}
                onChange={(n) => onChange({ pax: n, bags, small })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="flex min-w-0 flex-col">
                <strong className="text-xs sm:text-sm font-semibold">{t.suitcases}</strong>
                <small className="text-[11px] leading-tight text-ink-600">{t.suitcasesHint}</small>
              </span>
              <Stepper value={Math.min(bags, MAX_GROUP_BAGS)} label={t.suitcases} min={0} max={MAX_GROUP_BAGS} less={t.fewerSuitcases} more={t.moreSuitcases} onChange={(n) => onChange({ pax, bags: Math.min(MAX_GROUP_BAGS, n), small })} />
            </div>
            <div className="flex items-center justify-between gap-2 py-1">
              <span className="flex min-w-0 flex-col">
                <strong className="text-xs sm:text-sm font-semibold">{t.smallBags}</strong>
                <small className="text-[11px] leading-tight text-ink-600">{t.smallBagsHint}</small>
              </span>
              <Stepper value={Math.min(small, MAX_SMALL_BAGS)} label={t.smallBags} min={0} max={MAX_SMALL_BAGS} less={t.fewerSmallBags} more={t.moreSmallBags} onChange={(n) => onChange({ pax, bags, small: Math.min(MAX_SMALL_BAGS, n) })} />
            </div>
            <p className="m-0 mt-1 text-[11px] leading-snug text-ink-600">{pax > LARGEST_CAR_SEATS ? t.partyLarge : t.partyHint}</p>
            <button
              type="button"
              onClick={done}
              className="mt-1.5 h-10 w-full cursor-pointer rounded-lg border-0 bg-ink-950 text-xs font-semibold text-white hover:bg-ink-800 sm:mt-2 sm:h-9 sm:text-[13px]"
            >
              {t.done}
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}