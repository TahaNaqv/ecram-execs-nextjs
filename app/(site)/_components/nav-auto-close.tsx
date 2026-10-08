"use client";

import { useEffect } from "react";

/** Closes the mobile menu (a CSS checkbox toggle) when one of its links is followed. */
export function NavAutoClose() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.(".primary-nav a, .nav-actions a");
      const toggle = document.getElementById("nav-toggle") as HTMLInputElement | null;
      if (link && toggle) toggle.checked = false;
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
