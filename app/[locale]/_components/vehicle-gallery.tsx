"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { interpolate } from "@/lib/i18n/interpolate";

export type GalleryCopy = {
  label: string;
  prev: string;
  next: string;
  enlarge: string;
  close: string;
  /** "Photo {current} of {total}" */
  counter: string;
  lightbox: string;
};

const arrowButton =
  "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-black/55 text-[#fff] shadow-md backdrop-blur-sm transition-transform duration-300 hover:scale-110 hover:bg-black/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";

const Chevron = ({ direction }: { direction: "left" | "right" }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
  </svg>
);

export function VehicleGallery({ name, images, alt, copy }: { name: string; images: string[]; alt: string; copy: GalleryCopy }) {
  const [index, setIndex] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const many = images.length > 1;

  // Which photo the strip is actually showing, worked out from how far it has scrolled
  const syncFromScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const gliding = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(gliding.current), []);

  const go = (to: number) => {
    const next = (to + images.length) % images.length;
    setIndex(next);
    const el = track.current;
    if (el) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.clearTimeout(gliding.current);
      gliding.current = window.setTimeout(() => {
        gliding.current = undefined;
        syncFromScroll();
      }, reduce ? 50 : 900);
      el.scrollTo({ left: next * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    }
  };

  const onScroll = () => {
    if (gliding.current === undefined) syncFromScroll();
  };

  const onDialogKey = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (!many) return;
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  };

  const status = interpolate(copy.counter, { current: index + 1, total: images.length });

  return (
    // Takes its corners from the box it sits in, and is its own stacking layer: the photos scroll sideways inside it, and without
    // that the browser can paint them over the rounded corners of the frame (QA round 3, bug 5)
    <div className="relative isolate overflow-hidden bg-ink-900 w-full h-full rounded-[inherit] shadow-sm" role="group" aria-roledescription="carousel" aria-label={interpolate(copy.label, { name })}>
      <div
        ref={track}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-center" aria-hidden={i !== index}>
            <Image
              className="block h-full w-full object-cover object-center"
              src={src}
              alt={many ? `${alt} (${i + 1}/${images.length})` : alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
        aria-label={copy.enlarge}
        title={copy.enlarge}
        className="absolute top-3 right-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/55 text-[#fff] backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 shadow-md"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
        </svg>
      </button>

      {many && (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label={copy.prev} className={`${arrowButton} left-3`}>
            <Chevron direction="left" />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label={copy.next} className={`${arrowButton} right-3`}>
            <Chevron direction="right" />
          </button>
          <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[10px] tracking-[0.2em] text-[#fff] backdrop-blur-md shadow-sm" aria-hidden="true">
            {index + 1} / {images.length}
          </span>
        </>
      )}
      <span className="sr-only" aria-live="polite">
        {status}
      </span>

      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onKeyDown={onDialogKey}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        aria-label={interpolate(copy.lightbox, { name })}
        className="m-auto max-h-[92vh] w-[min(1400px,96vw)] border-none bg-transparent p-0 text-[#fff] backdrop:bg-black/85"
      >
        {open && (
          <div className="relative aspect-video w-full bg-black">
            <Image className="object-contain" src={images[index]} alt={alt} fill sizes="96vw" />
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              aria-label={copy.close}
              title={copy.close}
              className="absolute top-4 right-4 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/20 bg-black/55 text-[#fff] backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 shadow-md"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {many && (
              <>
                <button type="button" onClick={() => go(index - 1)} aria-label={copy.prev} className={`${arrowButton} left-4`}>
                  <Chevron direction="left" />
                </button>
                <button type="button" onClick={() => go(index + 1)} aria-label={copy.next} className={`${arrowButton} right-4`}>
                  <Chevron direction="right" />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </div>
  );
}