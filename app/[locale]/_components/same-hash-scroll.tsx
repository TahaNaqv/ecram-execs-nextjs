"use client";

import { useEffect } from "react";

/**
 * Clicking a link to the section the address already points at (…#enquire, a second time) does nothing in the App
 * Router: the URL is unchanged, so the router treats it as no navigation and nothing scrolls. A visitor who scrolled
 * away and clicked the same card again got no response until they refreshed. This listens before the router does and
 * scrolls to the section itself, once, for exactly that case; every other link is left alone.
 */
export function SameHashScroll() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      const here = window.location;
      if (url.origin !== here.origin || url.pathname !== here.pathname || url.search !== here.search) return;
      if (url.hash.length < 2 || url.hash !== here.hash) return;
      let id = url.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {}
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    };
    // Capture phase: this has to run before React hands the click to the router's link
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
