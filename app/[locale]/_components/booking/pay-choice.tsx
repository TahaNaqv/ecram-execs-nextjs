"use client";

import { useState, type ReactNode } from "react";

/** The only payment choices: pay the amount due now, or leave it and pay from this page later. */
export function PayChoice({
  nowLabel,
  laterLabel,
  laterNote,
  children,
}: {
  nowLabel: string;
  laterLabel: string;
  laterNote: string;
  children: ReactNode;
}) {
  const [when, setWhen] = useState<"now" | "later">("now");
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label={`${nowLabel} / ${laterLabel}`} className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={when === "now"}
          onClick={() => setWhen("now")}
          className={`pay-choice cursor-pointer rounded-full px-4 py-2 text-[12px] font-semibold tracking-[0.14em] uppercase ${when === "now" ? "pay-choice-on" : ""}`}
        >
          {nowLabel}
        </button>
        <button
          type="button"
          aria-pressed={when === "later"}
          onClick={() => setWhen("later")}
          className={`pay-choice cursor-pointer rounded-full px-4 py-2 text-[12px] font-semibold tracking-[0.14em] uppercase ${when === "later" ? "pay-choice-on" : ""}`}
        >
          {laterLabel}
        </button>
      </div>
      {when === "now" ? children : <p className="m-0 max-w-[520px] text-[15px] leading-snug text-ink-700">{laterNote}</p>}
    </div>
  );
}
