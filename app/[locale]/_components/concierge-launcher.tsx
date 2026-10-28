"use client";

import { useEffect, useState } from "react";

type Copy = { label: string; short: string; aria: string; bubble: string; bubbleClose: string };

/** How long after the page opens the "need help?" bubble appears, and the one-time flag that keeps it from coming back this visit */
const BUBBLE_DELAY_MS = 7000;
const SEEN_KEY = "ecram-concierge-bubble";

/**
 * A button that stays on the home page and takes the visitor to the concierge chat, so the chat is not missed halfway down the page.
 * It steps aside while the chat itself is on screen. Pressing it scrolls to the chat and puts the cursor in the message box.
 * A few seconds in, a small "need help?" bubble appears above it once per visit; it goes away when dismissed, when the button is used, or when the chat comes into view.
 */
export function ConciergeLauncher({ copy }: { copy: Copy }) {
  const [shown, setShown] = useState(true);
  const [bubble, setBubble] = useState(false);

  const seen = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage can be blocked: the bubble then simply may show again on the next page load
    }
  };

  const hideBubble = () => {
    setBubble(false);
    seen();
  };

  useEffect(() => {
    const target = document.getElementById("concierge");
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setShown(!entry.isIntersecting);
      if (entry.isIntersecting) {
        setBubble(false);
        seen();
      }
    }, { threshold: 0.3 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
    } catch {
      // carry on: no storage means no memory of an earlier dismissal
    }
    const timer = window.setTimeout(() => setBubble(true), BUBBLE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const open = () => {
    hideBubble();
    // The chat box itself, so on a phone (where the text sits above it) the message field is what comes into view
    const target = document.getElementById("concierge-chat") ?? document.getElementById("concierge");
    if (!target) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    window.setTimeout(() => target.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true }), calm ? 50 : 700);
  };

  const visible = shown && bubble;

  return (
    <>
      <div
        className={`cookie-lift fixed bottom-[84px] right-[92px] z-50 flex max-w-[calc(100vw-108px)] items-start gap-1 rounded-2xl bg-white py-2 pr-1.5 pl-4 text-[13px] text-ink-950 shadow-xl transition-[opacity,transform] duration-300 ${visible ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
        role="status"
        aria-hidden={!visible}
      >
        <button type="button" onClick={open} tabIndex={visible ? 0 : -1} className="cursor-pointer border-0 bg-transparent p-0 py-1 text-left font-[inherit] text-[length:inherit] text-inherit">
          {copy.bubble}
        </button>
        <button
          type="button"
          onClick={hideBubble}
          tabIndex={visible ? 0 : -1}
          aria-label={copy.bubbleClose}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-ink-950 hover:bg-ink-100"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18"></path>
          </svg>
        </button>
      </div>
      <button
        type="button"
        onClick={open}
        aria-label={copy.aria}
        tabIndex={shown ? 0 : -1}
        aria-hidden={!shown}
        className={`cookie-lift fixed bottom-6 right-[92px] z-50 flex min-h-12 cursor-pointer items-center gap-2.5 rounded-full border-0 bg-white px-4 text-[13px] font-semibold text-ink-950 shadow-xl transition-[opacity,transform] duration-300 hover:scale-105 md:px-5 ${shown ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}
      >
        <span className="live size-2 shrink-0 rounded-full bg-[#25D366]" aria-hidden="true" />
        <span className="md:hidden">{copy.short}</span>
        <span className="hidden md:inline">{copy.label}</span>
      </button>
    </>
  );
}
