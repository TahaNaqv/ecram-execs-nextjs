"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { bestMatch } from "@/lib/concierge/match";

type Message = { from: "guest" | "agent"; text: string };
type Faq = readonly [question: string, answer: string];

type Copy = { faqLabel: string; inputLabel: string; inputPlaceholder: string; send: string; noAnswer: string; isTyping: string };

/**
 * The concierge: the conversation, the questions still to ask, and the message bar.
 *
 * A question can be asked two ways. Choosing one from the list sends it into the chat as the visitor's message and the
 * concierge answers with that question's answer; a question typed in the bar is answered from the closest one. Either
 * way the question has been answered, so it leaves the list (what is left is what has not been asked). When nothing
 * fits a typed question, the reply hands the visitor to the team.
 */
export function ConciergeChat({ copy, faqs }: { copy: Copy; faqs: readonly Faq[] }) {
  const [messages, setMessages] = useState<Message[]>([]);
  // Positions in `faqs` already answered in this conversation
  const [answered, setAnswered] = useState<number[]>([]);
  const [waiting, setWaiting] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const timer = useRef<number | undefined>(undefined);
  // Where in the list a chosen question was, so focus can move to whatever took its place
  const refocus = useRef<number | null>(null);

  const remaining = faqs.map((faq, index) => ({ faq, index })).filter(({ index }) => !answered.includes(index));

  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Keep the newest message in view inside the chat window, and the chat in view on the page
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [messages, waiting]);
  // A chosen question has left the list: focus goes to the next one (or the message bar), not back to the top of the page
  useEffect(() => {
    if (refocus.current === null) return;
    const position = refocus.current;
    refocus.current = null;
    (position < remaining.length ? buttons.current[position] : field.current)?.focus({ preventScroll: true });
  }, [answered, remaining.length]);

  function ask(question: string, answer: string, index?: number) {
    setMessages((m) => [...m, { from: "guest", text: question }]);
    if (index !== undefined) setAnswered((a) => (a.includes(index) ? a : [...a, index]));
    setWaiting(true);
    // A short pause so the reply reads as an answer rather than an echo
    timer.current = window.setTimeout(() => {
      setMessages((m) => [...m, { from: "agent", text: answer }]);
      setWaiting(false);
    }, 700);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
    const message = input.value.trim();
    if (!message || waiting) return;
    input.value = "";
    const hit = bestMatch(message, faqs);
    ask(message, hit?.answer ?? copy.noAnswer, hit?.index);
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

      {remaining.length > 0 && (
        <ul aria-label={copy.faqLabel} className={`m-0 p-0 list-none max-h-[480px] overflow-y-auto ${messages.length > 0 ? "border-t border-t-ink-800" : ""}`}>
          {remaining.map(({ faq: [question, answer], index }, position) => (
            <li key={index} className="border-b border-b-ink-800 last:border-b-0">
              <button
                ref={(el) => {
                  buttons.current[position] = el;
                }}
                type="button"
                aria-disabled={waiting}
                onClick={() => {
                  if (waiting) return;
                  refocus.current = position;
                  ask(question, answer, index);
                }}
                className={`py-4 px-4 gap-4 border-0 items-center flex w-full cursor-pointer justify-between bg-transparent text-left text-ink-150 text-[14px] hover:bg-ink-850 aria-disabled:cursor-wait aria-disabled:opacity-60 md:px-[22px]`}
              >
                <span>{question}</span>
                <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M5 12h14M13 6l6 6-6 6"></path>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="border-t border-t-ink-800 flex" onSubmit={onSubmit}>
        <label className="flex-1 flex">
          <span className="overflow-hidden [clip:rect(0px,0px,0px,0px)] h-px absolute w-px">{copy.inputLabel}</span>
          <input
            ref={field}
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
