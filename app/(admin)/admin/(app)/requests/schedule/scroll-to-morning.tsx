"use client";

import { useEffect, useRef } from "react";

/**
 * The scrolling frame of the day grid. It opens at the first booking of the day (or 06:00 on an empty day), so the team
 * does not start at midnight; the frame keeps its own scroll, the page does not move.
 */
export function ScrollToMorning({ hourPx, firstMinute, children }: { hourPx: number; firstMinute: number | null; children: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const at = Math.max(0, (firstMinute ?? 6 * 60) - 60);
    frame.current?.scrollTo({ top: (at / 60) * hourPx });
  }, [hourPx, firstMinute]);
  return (
    <div ref={frame} className="relative max-h-[min(72dvh,900px)] overflow-auto overscroll-contain">
      {children}
    </div>
  );
}
