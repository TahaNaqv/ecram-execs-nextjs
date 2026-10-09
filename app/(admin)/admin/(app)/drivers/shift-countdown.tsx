"use client";

import { useSyncExternalStore } from "react";
import { SHIFT_HOURS, SHIFT_MS } from "@/lib/admin/shift";

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, 1000);
  return () => clearInterval(timer);
}
// Whole seconds so the snapshot only changes once per tick
const now = () => Math.floor(Date.now() / 1000) * 1000;

const pad = (n: number) => String(n).padStart(2, "0");
function hms(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** Counts down the shift's remaining time, then counts up how far over it has run. */
export function ShiftCountdown({ startedAt }: { startedAt: string }) {
  // Null on the server: the clock is only rendered in the browser, so it can't mismatch on hydration
  const current = useSyncExternalStore(subscribe, now, () => null);
  const start = new Date(startedAt).getTime();

  if (current === null) {
    return (
      <div>
        <p className="text-[40px] font-semibold leading-none tabular-nums tracking-tight text-zinc-200">--:--:--</p>
        <div className="mt-4 h-2 rounded-full bg-zinc-100" />
      </div>
    );
  }

  const remaining = start + SHIFT_MS - current;
  const over = remaining <= 0;
  const low = !over && remaining < 3_600_000;
  const used = Math.min(1, Math.max(0, (current - start) / SHIFT_MS));
  const tone = over ? "text-red-600" : low ? "text-amber-600" : "text-zinc-950";
  const bar = over ? "bg-red-500" : low ? "bg-amber-500" : "bg-zinc-950";

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p className={`text-[40px] font-semibold leading-none tabular-nums tracking-tight ${tone}`} role="timer" aria-live="off">
          {over ? "+" : ""}
          {hms(Math.abs(remaining))}
        </p>
        <span className="pb-1 text-xs font-medium tabular-nums text-zinc-400">{Math.round(used * 100)}%</span>
      </div>
      <p className={`mt-2 text-xs font-medium ${over ? "text-red-600" : low ? "text-amber-700" : "text-zinc-500"}`}>
        {over ? `Over the ${SHIFT_HOURS}-hour limit` : low ? "Less than an hour remaining" : `Remaining of ${SHIFT_HOURS} hours`}
      </p>
      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${bar}`} style={{ width: `${used * 100}%` }} />
        {/* Hour ticks */}
        {Array.from({ length: SHIFT_HOURS - 1 }, (_, i) => (
          <span key={i} aria-hidden="true" className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${((i + 1) / SHIFT_HOURS) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}
