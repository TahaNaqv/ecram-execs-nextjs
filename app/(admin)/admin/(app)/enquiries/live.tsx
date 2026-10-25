"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const two = (n: number) => String(n).padStart(2, "0");

/** 3_725_000 ms as "01:02:05"; a time already gone is shown with a minus. */
export function clock(ms: number) {
  const sign = ms < 0 ? "−" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  return `${sign}${two(Math.floor(total / 3600))}:${two(Math.floor((total % 3600) / 60))}:${two(total % 60)}`;
}

/**
 * The time left to answer an enquiry, counting down every second, with a bar that empties as the target comes closer. The first
 * render uses the server's clock (`serverNow`), so what the browser draws first is what the server sent; from then on it counts
 * from the browser's own clock, which keeps it exact however long the page took to arrive.
 */
export function Countdown({ deadline, serverNow, target, dueSoon, overdueLabel, label }: { deadline: number; serverNow: number; target: number; dueSoon: number; overdueLabel: string; label: string }) {
  const [left, setLeft] = useState(deadline - serverNow);

  useEffect(() => {
    const tick = () => setLeft(deadline - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const late = left < 0;
  const soon = !late && left <= dueSoon;
  const tone = late ? "text-red-600" : soon ? "text-amber-600" : "text-zinc-950";
  const fill = late ? "bg-red-500" : soon ? "bg-amber-500" : "bg-emerald-500";
  const share = late ? 100 : Math.max(0, Math.min(100, (left / target) * 100));

  return (
    <div role="timer" aria-label={label} className="flex min-w-[8.5rem] flex-col gap-1.5" data-late={late ? "true" : "false"}>
      <span className={`flex items-center justify-between gap-2 font-mono text-lg font-semibold tabular-nums leading-none ${tone}`}>
        {clock(left)}
        {late && <span className="rounded bg-red-600 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-white">{overdueLabel}</span>}
      </span>
      <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <span className={`block h-full rounded-full transition-[width] duration-1000 ease-linear ${fill}`} style={{ width: `${share}%` }} />
      </span>
    </div>
  );
}

/** New enquiries arrive while the page is open: ask the server for fresh figures every minute, and as soon as the tab comes back into view. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);
  return null;
}
