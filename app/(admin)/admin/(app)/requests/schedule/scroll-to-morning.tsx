"use client";

import { useEffect, useRef } from "react";

/**
 * The scrolling frame of the day grid. Time runs left to right, so it opens at the first booking (or 06:00 on an empty
 * day) and the page itself does not move.
 */
export function ScrollToMorning({ hourPx, firstMinute, labelWidth, children }: { hourPx: number; firstMinute: number | null; labelWidth: number; children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const at = Math.max(0, (firstMinute ?? 6 * 60) - 60);
    frame.current?.scrollTo({ left: labelWidth + (at / 60) * hourPx });
  }, [hourPx, firstMinute, labelWidth]);
  return (
    <div ref={frame} className="relative max-h-[min(72dvh,900px)] overflow-auto overscroll-contain">
      {children}
    </div>
  );
}
