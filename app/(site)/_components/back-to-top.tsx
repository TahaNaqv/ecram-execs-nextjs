"use client";

import { useEffect, useState } from "react";

/** Floating button that appears once the visitor has scrolled past the first screen and returns them to the top. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`back-to-top fixed right-4 bottom-4 z-50 flex h-12 w-12 cursor-pointer items-center justify-center border border-ink-700 bg-ink-950/80 text-ink-50 backdrop-blur-sm md:right-8 md:bottom-8 ${visible ? "is-visible" : ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7"></path>
      </svg>
    </button>
  );
}
