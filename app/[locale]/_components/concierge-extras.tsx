"use client";

import { useRef, useState } from "react";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { CHOCOLATE_OPTIONS, EXTRA_KEYS, EXTRAS, MAX_PER_EXTRA, type ExtraKey, type ExtraNames, type ExtraPick } from "@/lib/pricing/extras";
import { formatCents } from "@/lib/pricing/rates";

/** The booking form's own words for the add-on step, used on the chat's scroller. */
export type ExtrasCopy = {
  label: string;
  /** "{price} excl. {rate}% BTW / VAT" */
  price: string;
  add: string;
  added: string;
  fewer: string;
  more: string;
  selection: string;
  continue: string;
  skip: string;
  prev: string;
  next: string;
  /** "{car}, {number} of {total}" — reused for each add-on slide */
  slide: string;
};

/** The same zoom as the booking cards, inside this strip's wider photo frame. */
const PHOTO_SCALE: Partial<Record<ExtraKey, string>> = {
  chocolates: "origin-center scale-[1.26]",
  newspapers: "origin-center scale-[1.48]",
};

const Chevron = ({ direction }: { direction: "left" | "right" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

/**
 * The add-ons as the same swipeable strip as the cars: one product in view, its photo and price, and a count. The visitor
 * can take several, then confirm once. An empty selection is "no add-ons".
 */
export function ExtrasCarousel({ names, copy, locale, disabled, onConfirm }: {
  names: ExtraNames;
  copy: ExtrasCopy;
  locale: Locale;
  disabled?: boolean;
  onConfirm: (picks: ExtraPick[]) => void;
}) {
  const slides = EXTRA_KEYS.length;
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState<ExtraPick[]>([]);
  const [chocolate, setChocolate] = useState<string>(CHOCOLATE_OPTIONS[0]);
  const euro = (cents: number) => formatCents(cents, locale);

  const onScroll = () => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (!el || !first) return;
    const step = first.offsetWidth + 12;
    setIndex(Math.max(0, Math.min(slides - 1, Math.round(el.scrollLeft / step))));
  };

  const go = (to: number) => {
    const next = Math.max(0, Math.min(slides - 1, to));
    const el = track.current;
    const target = el?.children[next] as HTMLElement | undefined;
    if (!el || !target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target.offsetLeft - el.offsetLeft - (el.clientWidth - target.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
    setIndex(next);
  };

  const countOf = (key: ExtraKey) => picks.find((pick) => pick.key === key)?.count ?? 0;
  const setCount = (key: ExtraKey, count: number, option?: string) => {
    const rest = picks.filter((pick) => pick.key !== key);
    setPicks(count > 0 ? [...rest, { key, count, ...(option ? { option } : {}) }] : rest);
  };

  const arrow = "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-ink-600 bg-ink-850 text-ink-200 transition-colors hover:border-ink-400 hover:text-white disabled:cursor-default disabled:opacity-30";
  const chosen = picks.length > 0;

  return (
    <section aria-roledescription="carousel" aria-label={copy.label} className="mt-3 w-full min-w-0">
      <ul
        ref={track}
        onScroll={onScroll}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          go(index + (e.key === "ArrowRight" ? 1 : -1));
        }}
        className="m-0 flex w-full list-none snap-x snap-mandatory gap-3 overflow-x-auto p-0 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {EXTRA_KEYS.map((key, i) => {
          const spec = EXTRAS[key];
          const count = countOf(key);
          const option = spec.options ? (picks.find((pick) => pick.key === key)?.option ?? chocolate) : undefined;
          const name = names[key];
          return (
            <li
              key={key}
              role="group"
              aria-roledescription="slide"
              aria-label={interpolate(copy.slide, { car: name, number: i + 1, total: slides })}
              className={`w-[82%] shrink-0 snap-center overflow-hidden rounded-2xl border bg-ink-850 ${count > 0 ? "border-white" : "border-ink-700"}`}
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#ffffff]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small product photo from /public, as on the booking form */}
                <img src={spec.image} alt="" loading="lazy" draggable={false} className={`absolute inset-0 h-full w-full object-contain ${PHOTO_SCALE[key] ?? ""}`} />
              </div>
              <div className="flex flex-col gap-2.5 p-3.5">
                <span className="text-[14px] font-semibold leading-snug text-white">{name}</span>
                <span className="text-[13px] font-medium text-white tabular-nums">
                  {interpolate(copy.price, { price: euro(spec.unit), rate: Math.round(spec.vatRate * 100) })}
                </span>
                {spec.options && (
                  <fieldset className="m-0 grid grid-cols-2 gap-1.5 border-0 p-0">
                    <legend className="sr-only">{copy.selection}</legend>
                    {spec.options.map((choice) => (
                      <label
                        key={choice}
                        className={`flex min-h-9 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-[11px] leading-tight font-semibold ${
                          option === choice ? "border border-white text-white" : "border border-ink-600 text-ink-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`concierge-${key}`}
                          value={choice}
                          checked={option === choice}
                          onChange={() => {
                            setChocolate(choice);
                            if (count > 0) setCount(key, count, choice);
                          }}
                          className="sr-only"
                        />
                        {choice === "dairy_free" ? names.chocolatesDairyFree : names.chocolatesClassic}
                      </label>
                    ))}
                  </fieldset>
                )}
                {count === 0 ? (
                  <button
                    type="button"
                    onClick={() => setCount(key, 1, option)}
                    className="cursor-pointer rounded-xl border-0 bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-950 transition-opacity hover:opacity-90"
                  >
                    {copy.add}
                  </button>
                ) : (
                  <div className="flex h-10 items-center justify-between rounded-xl border border-white px-1 text-white">
                    <button
                      type="button"
                      onClick={() => setCount(key, count - 1, option)}
                      aria-label={interpolate(copy.fewer, { item: name })}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[18px] text-white hover:bg-white/10"
                    >
                      −
                    </button>
                    <span className="text-[13px] font-semibold tabular-nums">{count > 1 ? `${count} × ${copy.added}` : `✓ ${copy.added}`}</span>
                    <button
                      type="button"
                      onClick={() => count < MAX_PER_EXTRA && setCount(key, count + 1, option)}
                      aria-disabled={count >= MAX_PER_EXTRA || undefined}
                      aria-label={interpolate(copy.more, { item: name })}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[18px] text-white hover:bg-white/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={copy.prev} className={arrow}>
          <Chevron direction="left" />
        </button>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {EXTRA_KEYS.map((key, i) => (
            <span key={key} className={`size-1.5 rounded-full ${i === index ? "bg-white" : "bg-ink-600"}`} />
          ))}
        </div>
        <button type="button" onClick={() => go(index + 1)} disabled={index === slides - 1} aria-label={copy.next} className={arrow}>
          <Chevron direction="right" />
        </button>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onConfirm(picks)}
        className="mt-3 w-full cursor-pointer rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
      >
        {chosen ? copy.continue : copy.skip}
      </button>
    </section>
  );
}
