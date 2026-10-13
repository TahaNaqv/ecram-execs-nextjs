"use client";

import type { ReactNode } from "react";

export const SELECT_VEHICLE_EVENT = "ecram:select-vehicle";

/**
 * Takes the visitor to the booking form with a vehicle chosen. It is a real link to
 * `/{locale}?vehicle=…#enquire`, so it works without JavaScript (the form reads the query on load);
 * with JavaScript it skips the page load and tells the form directly.
 */
export function BookLink({
  href,
  vehicleKey,
  label,
  className,
  children,
}: {
  href: string;
  vehicleKey: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        // Leave modified clicks (new tab, new window) to the browser; they follow the real link
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(SELECT_VEHICLE_EVENT, { detail: vehicleKey }));
        window.history.replaceState(null, "", href);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("enquire")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}
