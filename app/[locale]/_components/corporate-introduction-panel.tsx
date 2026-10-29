"use client";

import { useState, type ReactNode } from "react";

/**
 * Holds the introduction form. A partner who has already sent introductions finds the form folded away under
 * "send another"; a first-time partner sees it open. Which of the two is decided once, when the page first loads:
 * sending the first introduction makes the list appear, and the form (still showing its thank-you) must not be
 * remounted into the folded version, or the confirmation would disappear.
 */
export function IntroductionPanel({ collapsible, summary, children }: { collapsible: boolean; summary: string; children: ReactNode }) {
  const [folded] = useState(collapsible);
  if (!folded) return <div>{children}</div>;
  return (
    <details>
      <summary className="mb-4 cursor-pointer list-none rounded-2xl border border-[#d5e4ff] bg-[#ffffff] px-5 py-4 text-[12px] font-semibold tracking-[0.22em] text-[#10224f] uppercase shadow-[0_8px_24px_rgba(47,98,255,0.1)]">{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
