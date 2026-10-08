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
    <form onSubmit={onSubmit} style={{ display: "flex", borderTop: "1px solid #26262a" }}>
      <label style={{ flex: "1", display: "flex" }}>
        <span style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          Message the concierge
        </span>
        <input
          name="message"
          type="text"
          placeholder="Ask about a journey…"
          maxLength={500}
          autoComplete="off"
          style={{ flex: "1", minWidth: 0, minHeight: "56px", border: "none", outline: "none", background: "transparent", color: "#ffffff", padding: "0 22px", fontSize: "14px" }}
        />
      </label>
      <button
        type="submit"
        aria-label="Send message"
        style={{ width: "56px", border: "none", borderLeft: "1px solid #26262a", background: "transparent", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6"></path>
        </svg>
      </button>
    </form>
  );
}
