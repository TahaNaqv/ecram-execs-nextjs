"use client";

import { useEffect, useRef, useState } from "react";

type Copy = { prev: string; next: string };

/** The sticky header covers the top of the page, so a page is what fits beneath it: its last line is the next page's first. */
const headerOffset = () => document.querySelector("header")?.getBoundingClientRect().height ?? 0;
const pageHeight = () => Math.max(200, window.innerHeight - headerOffset());
const farthest = () => Math.max(0, Math.floor(document.documentElement.scrollHeight - window.innerHeight));

/** The WhatsApp button (components/whatsapp-float.tsx) sits in the same corner, so the arrows stay above it whenever it is shown. */
const hasWhatsApp = Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);

const DURATION_MS = 520;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Floating up/down arrows that turn the page: each press scrolls exactly one page (the height of the screen beneath the
 * header), smoothly. Pressing again before it has finished adds another page to where it was going, not to where it has got
 * to, so a quick run of presses lands exactly that many pages on. The scrolling is done here, frame by frame, rather than by
 * the browser's own smooth scrolling, which runs at a different pace in every browser and drifts when interrupted; touching
 * the page (wheel, finger, keys) stops it at once. Both buttons stay out of the way until the visitor has scrolled.
 */
export function SectionNav({ copy }: { copy: Copy }) {
  const [visible, setVisible] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  // The scroll in progress: its frame and where it is heading
  const running = useRef<{ frame: number; to: number } | null>(null);
  const nav = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.4);
      setAtTop(window.scrollY < 8);
      setAtBottom(window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8);
    };
    const stop = () => {
      if (running.current) cancelAnimationFrame(running.current.frame);
      running.current = null;
    };
    // The visitor taking over ends the animation, so it never fights their hand: the wheel, a finger or the mouse on the page,
    // the keys. Pressing one of the arrows themselves is not taking over (the touch or key comes just before its click, and would
    // lose where the page was heading), so those are let through.
    const takeOver = (e: Event) => {
      if (e.target instanceof Node && nav.current?.contains(e.target)) return;
      stop();
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("wheel", takeOver, { passive: true });
    window.addEventListener("touchstart", takeOver, { passive: true });
    window.addEventListener("pointerdown", takeOver, { passive: true });
    window.addEventListener("keydown", takeOver);
    return () => {
      stop();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("wheel", takeOver);
      window.removeEventListener("touchstart", takeOver);
      window.removeEventListener("pointerdown", takeOver);
      window.removeEventListener("keydown", takeOver);
    };
  }, []);

  const scrollTo = (target: number) => {
    const from = window.scrollY;
    const to = Math.round(Math.min(Math.max(0, target), farthest()));
    if (running.current) cancelAnimationFrame(running.current.frame);
    // "instant" because the page's own CSS glides every scroll (html { scroll-behavior: smooth }), which would smooth each frame again
    const jump = (top: number) => window.scrollTo({ top, behavior: "instant" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(to - from) < 2) {
      running.current = null;
      jump(to);
      return;
    }
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / DURATION_MS);
      jump(t < 1 ? from + (to - from) * easeOut(t) : to);
      running.current = t < 1 ? { frame: requestAnimationFrame(step), to } : null;
    };
    running.current = { frame: requestAnimationFrame(step), to };
  };

  const go = (direction: -1 | 1) => scrollTo((running.current?.to ?? window.scrollY) + direction * pageHeight());

  const button =
    "flex h-9 w-9 cursor-pointer md:h-12 md:w-12 items-center justify-center border border-ink-700 bg-ink-950/80 text-ink-50 backdrop-blur-sm transition-colors hover:bg-ink-50 hover:text-ink-950 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-ink-950/80 disabled:hover:text-ink-50";

  return (
    <div
      ref={nav}
      className={`section-nav cookie-lift fixed right-2 z-50 flex flex-col gap-px transition-[bottom] duration-300 md:right-8 ${atBottom || hasWhatsApp ? "bottom-24 md:bottom-28" : "bottom-4 md:bottom-8"} ${visible ? "is-visible" : ""}`}
      aria-hidden={!visible}
    >
      <button type="button" className={button} onClick={() => go(-1)} disabled={atTop} aria-label={copy.prev} tabIndex={visible ? 0 : -1}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7"></path>
        </svg>
      </button>
      <button type="button" className={button} onClick={() => go(1)} disabled={atBottom} aria-label={copy.next} tabIndex={visible ? 0 : -1}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 5v14M19 12l-7 7-7-7"></path>
        </svg>
      </button>
    </div>
  );
}
