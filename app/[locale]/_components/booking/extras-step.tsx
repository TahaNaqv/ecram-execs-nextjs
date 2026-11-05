"use client";

import { useId, useState } from "react";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n/config";
import { formatCents } from "@/lib/pricing/rates";
import { CHOCOLATE_OPTIONS, cleanExtras, EXTRA_KEYS, EXTRAS, MAX_PER_EXTRA, type ExtraKey, type ExtraPick } from "@/lib/pricing/extras";
import type { AddOnsCopy, BookingCopy } from "./copy";
import { Check } from "./parts";

const ArrowLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);

const NOTES: Record<ExtraKey, keyof AddOnsCopy> = {
  champagne: "champagneNote",
  chocolates: "chocolatesNote",
  flowers: "flowersNote",
  newspapers: "newspapersNote",
};
const OPTION_LABELS: Record<string, keyof AddOnsCopy> = { classic: "chocolatesClassic", dairy_free: "chocolatesDairyFree" };

/** The step after the car: champagne, chocolates, flowers and newspapers, waiting in the car. All optional. */
export function ExtrasStep({ headingRef, extras, locale, copy: t, names, onChange, onBack, onNext }: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  extras: ExtraPick[];
  locale: Locale;
  copy: BookingCopy;
  names: AddOnsCopy;
  onChange: (extras: ExtraPick[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const uid = useId();
  const euro = (cents: number) => formatCents(cents, locale);
  // Adding swaps the Add button for the stepper, and taking the last one away swaps it back: the focus follows, so a
  // keyboard or screen-reader user stays on the card
  const focusSoon = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());
  const picked = (key: ExtraKey) => extras.find((e) => e.key === key);
  // The chocolate selection shown before the box is added; once added, the box's own selection
  const [chocolate, setChocolate] = useState<string>(picked("chocolates")?.option ?? CHOCOLATE_OPTIONS[0]);

  const set = (key: ExtraKey, count: number, option?: string) => {
    const rest = extras.filter((e) => e.key !== key);
    onChange(cleanExtras(count > 0 ? [...rest, { key, count, ...(option ? { option } : {}) }] : rest));
  };
  const subtotal = extras.reduce((sum, e) => sum + EXTRAS[e.key].unit * e.count, 0);

  const card = (key: ExtraKey) => {
    const spec = EXTRAS[key];
    const pick = picked(key);
    const count = pick?.count ?? 0;
    const name = names[key];
    const option = spec.options ? (pick?.option ?? chocolate) : undefined;
    return (
      <li key={key} className="flex">
        <div
          className={`flex w-full flex-col rounded-2xl bg-white text-ink-950 ${
            count > 0 ? "border-2 border-solid border-ink-950 p-[7px] shadow-[0_12px_30px_rgba(var(--ec-black-rgb),0.12)]" : "border border-solid border-ink-225 p-2"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small product photo from /public; next/image would need sizes per breakpoint for no gain here */}
          <img src={spec.image} alt="" className="aspect-[4/3] w-full rounded-[11px] bg-[#ffffff] object-contain" />
          <div className="flex flex-1 flex-col gap-1.5 px-1.5 pt-3 pb-1.5">
            <h3 className="m-0 text-[15px] leading-snug font-semibold">{name}</h3>
            <p className="m-0 text-[13px] leading-snug text-ink-600">{names[NOTES[key]]}</p>
            <p className="m-0 mt-auto pt-1 text-[14px] font-medium text-ink-700 tabular-nums">
              {interpolate(t.extrasPrice, { price: euro(spec.unit), rate: Math.round(spec.vatRate * 100) })}
            </p>
          </div>
          {spec.options && (
            <fieldset className="m-0 mx-1.5 mt-1 grid min-w-0 grid-cols-2 gap-1.5 border-0 p-0">
              <legend className="sr-only">{t.extrasSelection}</legend>
              {spec.options.map((o) => (
                <label
                  key={o}
                  className={`flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-[12px] leading-tight font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink-950 ${
                    option === o ? "border-2 border-solid border-ink-950 bg-ink-100 text-ink-950" : "border border-solid border-ink-225 bg-white text-ink-700 hover:border-ink-950"
                  }`}
                >
                  <input
                    type="radio"
                    name={`${uid}-${key}`}
                    value={o}
                    checked={option === o}
                    onChange={() => {
                      setChocolate(o);
                      if (count > 0) set(key, count, o);
                    }}
                    className="sr-only"
                  />
                  {names[OPTION_LABELS[o]]}
                </label>
              ))}
            </fieldset>
          )}
          {count === 0 ? (
            <button
              type="button"
              id={`${uid}-${key}-add`}
              onClick={() => {
                set(key, 1, option);
                focusSoon(`${uid}-${key}-more`);
              }}
              aria-label={`${t.extrasAdd}: ${name}`}
              className="m-1.5 flex h-11 cursor-pointer items-center justify-center rounded-xl border border-solid border-ink-225 bg-white text-[14px] font-semibold text-ink-950 hover:border-ink-950"
            >
              {t.extrasAdd}
            </button>
          ) : (
            <div className="m-1.5 flex h-11 items-center justify-between rounded-xl bg-ink-950 px-1 text-white">
              <button
                type="button"
                onClick={() => {
                  set(key, count - 1, option);
                  if (count === 1) focusSoon(`${uid}-${key}-add`);
                }}
                aria-label={interpolate(t.extrasFewer, { item: name })}
                className="grid size-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[20px] leading-none text-white hover:bg-white/15"
              >
                −
              </button>
              <span aria-live="polite" className="flex items-center gap-1.5 text-[14px] font-semibold tabular-nums">
                <Check />
                <span className="sr-only">{interpolate(t.extrasCount, { count, item: name })}</span>
                <span aria-hidden="true">{count > 1 ? `${count} × ${t.extrasAdded}` : t.extrasAdded}</span>
              </span>
              <button
                type="button"
                id={`${uid}-${key}-more`}
                onClick={() => count < MAX_PER_EXTRA && set(key, count + 1, option)}
                aria-disabled={count >= MAX_PER_EXTRA || undefined}
                aria-label={interpolate(t.extrasMore, { item: name })}
                className="grid size-9 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-[20px] leading-none text-white hover:bg-white/15 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <section aria-labelledby="booking-extras" className="scroll-mt-6">
      <h2 id="booking-extras" ref={headingRef} tabIndex={-1} className="m-0 font-serif text-[clamp(32px,4vw,44px)] leading-[1.05] font-normal outline-none">
        {t.extrasTitle}
      </h2>
      <p className="m-0 mt-2 max-w-[640px] text-[14px] text-ink-600">{t.extrasIntro}</p>
      <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">{EXTRA_KEYS.map(card)}</ul>

      <div className="sticky bottom-0 z-10 mt-8 -mx-5 border-t border-solid border-ink-150 bg-white/95 px-5 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom,0px))] backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p aria-live="polite" className="m-0 text-[14px] font-medium text-ink-700 tabular-nums">
            {subtotal > 0 ? interpolate(t.extrasSubtotal, { price: euro(subtotal) }) : ""}
          </p>
          <div className="ml-auto flex w-full gap-2.5 md:w-auto">
            <button type="button" onClick={onBack} className="flex h-[52px] cursor-pointer items-center gap-1.5 rounded-xl border border-solid border-ink-225 bg-white px-5 text-[14px] font-semibold text-ink-950 hover:border-ink-950">
              <ArrowLeft />
              {t.back}
            </button>
            <button type="button" onClick={onNext} className="h-[52px] flex-1 cursor-pointer rounded-xl border-0 bg-ink-950 px-6 text-[14px] font-semibold text-white hover:bg-ink-800 md:flex-none">
              {extras.length > 0 ? t.extrasContinue : t.extrasSkip}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
