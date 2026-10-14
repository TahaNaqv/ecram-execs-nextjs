"use client";

import { useEffect, useRef } from "react";

/**
 * Put inside a form's confirmation box. When the form is replaced by its "received" message the page gets
 * shorter, which used to leave the visitor looking at whatever section came next and never seeing the
 * confirmation. This brings the box into view and moves focus to it, so it is seen and announced.
 * The parent needs `tabIndex={-1}` to be focusable.
 */
export function ScrollIntoViewOnMount() {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const box = marker.current?.parentElement;
    if (!box) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    box.focus({ preventScroll: true });
  }, []);
  return <span ref={marker} hidden />;
}
