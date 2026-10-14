"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { bestAnswer } from "@/lib/concierge/match";

type Message = { from: "guest" | "agent"; text: string };

type Copy = { inputLabel: string; inputPlaceholder: string; send: string; noAnswer: string; isTyping: string };

/**
 * The concierge's message bar and conversation. A question typed here is answered in the chat, from the
 * frequently asked questions above it; when none fits, the reply hands the visitor to the team. (It used to
 * copy the question into the quote form's notes and answer nothing.)
 */
export function ConciergeInput({ copy, faqs }: { copy: Copy; faqs: readonly (readonly [string, string])[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [waiting, setWaiting] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Keep the newest message in view inside the chat window (not the page)
  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, waiting]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    const message = input.value.trim();
    if (!message || waiting) return;
    input.value = "";
    setMessages((m) => [...m, { from: "guest", text: message }]);
    setWaiting(true);
    // A short pause so the reply reads as an answer rather than an echo
    timer.current = window.setTimeout(() => {
      setMessages((m) => [...m, { from: "agent", text: bestAnswer(message, faqs) ?? copy.noAnswer }]);
      setWaiting(false);
    }, 700);
  }

  return (
    <>
      {(messages.length > 0 || waiting) && (
        <div ref={log} role="log" aria-live="polite" className="py-4 px-4 gap-3 border-t border-t-ink-800 flex max-h-[280px] flex-col overflow-y-auto text-[14px] md:px-[22px]">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`py-3 px-4 max-w-[85%] ${m.from === "guest" ? "self-end bg-ink-150 text-ink-950" : "border border-ink-750 self-start text-ink-150"}`}
            >
              {m.text}
            </div>
          ))}
          {waiting && (
            <div className="py-3 px-4 border border-ink-750 self-start text-ink-450 flex items-center gap-3 text-[12px]">
              <span className="typing gap-1 inline-flex" aria-label={copy.isTyping}>
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          )}
        </div>
      )}
      <form className="border-t border-t-ink-800 flex" onSubmit={onSubmit}>
        <label className="flex-1 flex">
          <span className="overflow-hidden [clip:rect(0px,0px,0px,0px)] h-px absolute w-px">{copy.inputLabel}</span>
          <input
            className="py-0 px-[22px] border-none flex-1 outline-none bg-transparent text-white text-[16px] min-h-[56px] min-w-0 md:text-[14px]"
            name="message"
            type="text"
            placeholder={copy.inputPlaceholder}
            maxLength={500}
            autoComplete="off"
          />
        </label>
        <button
          className="border-0 border-l border-l-ink-800 items-center bg-transparent text-white cursor-pointer flex justify-center w-14 disabled:opacity-50"
          type="submit"
          aria-label={copy.send}
          disabled={waiting}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6"></path>
          </svg>
        </button>
      </form>
    </>
  );
}
