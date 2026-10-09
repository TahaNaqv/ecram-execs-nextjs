"use client";

import { useSyncExternalStore } from "react";
import { SHIFT_MS } from "@/lib/admin/shift";

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
    return <p className="text-4xl font-semibold tabular-nums tracking-tight text-zinc-300">--:--:--</p>;
  }

  const remaining = start + SHIFT_MS - current;
  const over = remaining <= 0;
  const used = Math.min(1, Math.max(0, (current - start) / SHIFT_MS));
  const tone = over ? "text-red-700" : remaining < 3_600_000 ? "text-amber-700" : "text-zinc-950";
  const bar = over ? "bg-red-600" : remaining < 3_600_000 ? "bg-amber-500" : "bg-zinc-900";

  return (
    <div>
      <p className={`text-4xl font-semibold tabular-nums tracking-tight ${tone}`} role="timer" aria-live="off">
        {over ? "+" : ""}
        {hms(Math.abs(remaining))}
      </p>
      <p className={`mt-1 text-xs uppercase tracking-widest ${over ? "font-semibold text-red-700" : "text-zinc-500"}`}>
        {over ? "Over the 10-hour limit" : "Remaining of 10 hours"}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full ${bar}`} style={{ width: `${used * 100}%` }} />
      </div>
    </div>
  );
}
