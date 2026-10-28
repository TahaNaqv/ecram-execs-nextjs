"use client";

import { useEffect, useState } from "react";

type Copy = { prev: string; next: string };

/** The page's top-level blocks, in reading order: every <main> section, then the footer. */
const blocks = () => Array.from(document.querySelectorAll<HTMLElement>("main > section, body footer"));

/** The sticky header covers the top of whatever it sits above, so sections are scrolled to just beneath it. */
const headerOffset = () => document.querySelector("header")?.getBoundingClientRect().height ?? 0;

/** The WhatsApp button (components/whatsapp-float.tsx) sits in the same corner, so the arrows stay above it whenever it is shown. */
const hasWhatsApp = Boolean(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER);

/**
 * Floating up/down arrows that move between sections rather than to the very top or bottom.
 * Up from partway through a section returns to that section's start; up from its start goes to
 * the previous one. Both buttons stay out of the way until the visitor has scrolled.
 */
export function SectionNav({ copy }: { copy: Copy }) {
  const [visible, setVisible] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.4);
      setAtTop(window.scrollY < 8);
      setAtBottom(window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const scrollTo = (top: number) => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
  };

  const go = (direction: -1 | 1) => {
    const offset = headerOffset();
    const tops = blocks().map((el) => el.getBoundingClientRect().top + window.scrollY - offset);
    const here = window.scrollY;
    // A few pixels of slack so a section we have just landed on counts as "at its start".
    const slack = 24;
    const target =
      direction === 1 ? tops.find((t) => t > here + slack) : [...tops].reverse().find((t) => t < here - slack);
    if (target !== undefined) scrollTo(target);
    else scrollTo(direction === 1 ? document.documentElement.scrollHeight : 0);
  };

  const button =
    "flex h-12 w-12 cursor-pointer items-center justify-center border border-ink-700 bg-ink-950/80 text-ink-50 backdrop-blur-sm transition-colors hover:bg-ink-50 hover:text-ink-950 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-ink-950/80 disabled:hover:text-ink-50";

  return (
    <div
      className={`section-nav cookie-lift fixed right-4 z-50 flex flex-col gap-px transition-[bottom] duration-300 md:right-8 ${atBottom || hasWhatsApp ? "bottom-24 md:bottom-28" : "bottom-4 md:bottom-8"} ${visible ? "is-visible" : ""}`}
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
