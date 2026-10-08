"use client";

import type { FormEvent } from "react";

/**
 * Until the AI concierge goes live, a message typed here is carried into the
 * quotation form (as notes) so the visitor's question is never lost.
 */
export function ConciergeInput() {
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
    const message = input.value.trim();
    const notes = document.getElementById("q-notes") as HTMLInputElement | null;
    if (message && notes) {
      notes.value = notes.value ? `${notes.value} — ${message}` : message;
      input.value = "";
    }
    document.getElementById("enquire")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("q-collection")?.focus({ preventScroll: true }), 600);
  }

  return (
    <form className="border-t border-t-ink-800 flex" onSubmit={onSubmit}>
      <label className="flex-1 flex">
        <span className="overflow-hidden [clip:rect(0px,0px,0px,0px)] h-px absolute w-px">
          Message the concierge
        </span>
        <input className="py-0 px-[22px] border-none flex-1 outline-none bg-transparent text-white text-[16px] min-h-[56px] min-w-0 md:text-[14px]"
          name="message"
          type="text"
          placeholder="Ask about a journey…"
          maxLength={500}
          autoComplete="off"
         
        />
      </label>
      <button className="border-0 border-l border-l-ink-800 items-center bg-transparent text-white cursor-pointer flex justify-center w-14"
        type="submit"
        aria-label="Send message"
       
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6"></path>
        </svg>
      </button>
    </form>
  );
}
