"use client";

import { useRef, useState } from "react";
import { FLEET, normalizeVehicleKey, type FleetVehicle } from "@/lib/fleet/vehicles";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { VehicleDetails, type FleetDictionary } from "./booking/vehicle-details";

/** The words the carousel needs: the chat's own, and the booking form's for the car step (the section hands them over). */
export type CarsCopy = {
  label: string;
  choose: string;
  chosen: string;
  prev: string;
  next: string;
  /** "{car}, {number} of {total}" */
  slide: string;
  noPreference: string;
  /** "Up to {seats}" */
  seatsUpTo: string;
  /** "Photos and details of the {car}" */
  details: string;
  close: string;
};

const Chevron = ({ direction }: { direction: "left" | "right" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

/**
 * The cars as a swipeable strip of pictures inside the chat: one car in view with the next peeking in, arrows and dots, and for
 * each car its seats, a button to choose it and one for its photos and answers (the dialog the booking flow uses). The last
 * slide is "no preference". Choosing is the visitor's own act; the chat turns it into their message and into the booking draft.
 */
export function CarCarousel({ keys, selected, onChoose, copy, fleetDict, locale }: {
  /** The cars on offer (the server leaves out the ones the team has switched off) */
  keys: string[];
  /** The car chosen so far: a fleet key, or "advise" for no preference */
  selected: string | undefined;
  onChoose: (choice: string, name: string | null) => void;
  copy: CarsCopy;
  fleetDict: FleetDictionary;
  locale: Locale;
}) {
  const cars = keys.map((k) => FLEET.find((f) => f.key === normalizeVehicleKey(k))).filter((v): v is FleetVehicle => Boolean(v));
  const slides = cars.length + 1;
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<FleetVehicle | null>(null);

  // Which slide is in view, worked out from how far the strip has scrolled
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

  const arrow = "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-ink-600 bg-ink-850 text-ink-200 transition-colors hover:border-ink-400 hover:text-white disabled:cursor-default disabled:opacity-30";

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
        {cars.map((car, i) => {
          const isChosen = selected === car.key;
          const seats = car.specs?.passengers ?? null;
          return (
            <li
              key={car.key}
              role="group"
              aria-roledescription="slide"
              aria-label={interpolate(copy.slide, { car: car.name, number: i + 1, total: slides })}
              className={`w-[82%] shrink-0 snap-center overflow-hidden rounded-2xl border bg-ink-850 ${isChosen ? "border-white" : "border-ink-700"}`}
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a small cover photo from /public, as in the booking flow's car step */}
                <img src={car.images[0]} alt="" loading="lazy" draggable={false} className="aspect-[16/10] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setDetails(car)}
                  aria-label={interpolate(copy.details, { car: car.name })}
                  className="absolute top-2.5 right-2.5 grid size-9 cursor-pointer place-items-center rounded-full border-0 bg-white/90 text-ink-950 shadow-sm hover:bg-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v6M12 7.5v.5" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col gap-2.5 p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-semibold text-white">{car.name}</span>
                  {seats !== null && <span className="text-[12px] whitespace-nowrap text-ink-400">{interpolate(copy.seatsUpTo, { seats })}</span>}
                </div>
                <button
                  type="button"
                  aria-pressed={isChosen}
                  onClick={() => onChoose(car.key, car.name)}
                  className={`cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-opacity ${isChosen ? "border border-white bg-transparent text-white" : "border-0 bg-white text-ink-950 hover:opacity-90"}`}
                >
                  {isChosen ? `✓ ${copy.chosen}` : copy.choose}
                </button>
              </div>
            </li>
          );
        })}
        <li
          role="group"
          aria-roledescription="slide"
          aria-label={interpolate(copy.slide, { car: copy.noPreference, number: slides, total: slides })}
          className={`flex w-[82%] shrink-0 snap-center flex-col justify-end rounded-2xl border border-dashed bg-transparent p-3.5 ${selected === "advise" ? "border-white" : "border-ink-600"}`}
        >
          <button
            type="button"
            aria-pressed={selected === "advise"}
            onClick={() => onChoose("advise", null)}
            className={`cursor-pointer rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-opacity ${selected === "advise" ? "border border-white bg-transparent text-white" : "border-0 bg-white text-ink-950 hover:opacity-90"}`}
          >
            {selected === "advise" ? `✓ ${copy.noPreference}` : copy.noPreference}
          </button>
        </li>
      </ul>

      <div className="mt-1 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label={copy.prev} className={arrow}>
          <Chevron direction="left" />
        </button>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {Array.from({ length: slides }, (_, i) => (
            <span key={i} className={`size-1.5 rounded-full ${i === index ? "bg-white" : "bg-ink-600"}`} />
          ))}
        </div>
        <button type="button" onClick={() => go(index + 1)} disabled={index === slides - 1} aria-label={copy.next} className={arrow}>
          <Chevron direction="right" />
        </button>
      </div>

      <VehicleDetails vehicle={details} onClose={() => setDetails(null)} fleetDict={fleetDict} locale={locale} closeLabel={copy.close} />
    </section>
  );
}
