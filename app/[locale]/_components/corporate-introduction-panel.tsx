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
    <details className="border border-ink-225 bg-white">
      <summary className="cursor-pointer list-none px-5 py-4 text-[12px] font-semibold tracking-[0.22em] text-ink-950 uppercase">{summary}</summary>
      <div className="border-t border-ink-225 p-5 md:p-8">{children}</div>
    </details>
  );
}
