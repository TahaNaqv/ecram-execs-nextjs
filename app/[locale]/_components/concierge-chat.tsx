"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type Message = {
  from: "guest" | "agent";
  text: string;
  handoff?: boolean;
};


type Copy = {
  welcome?: string;
  whatsappCta?: string;
  whatsappHandoff?: string;
  chipAirport?: string;
  chipFleet?: string;
  chipCorporate?: string;
  faqLabel: string;
  inputLabel: string;
  inputPlaceholder: string;
  send: string;
  noAnswer: string;
  isTyping: string;
};

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "31627133700";

function WhatsAppIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export function ConciergeChat({ copy, locale }: { copy: Copy; locale: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      from: "agent",
      text: copy.welcome || "Good day. I am the Ecram Execs Concierge. How may I assist with your journey or travel arrangements today?",
    },
  ]);
  const [waiting, setWaiting] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Suggestions for quick interaction
  const starterChips = [
    { label: copy.chipAirport || "Airport Transfers", query: "Can you explain your airport transfer services and meet & greet?" },
    { label: copy.chipFleet || "Executive Fleet", query: "Which luxury vehicles are in your electric fleet?" },
    { label: copy.chipCorporate || "Corporate Accounts", query: "How do corporate partner accounts work?" },
  ];

  // Auto-scroll when messages or typing state changes
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, waiting]);

  function getWhatsAppUrl(allMessages: Message[]) {
    const formatted = allMessages
      .map((m) => `${m.from === "guest" ? "Guest" : "Ecram Concierge"}: ${m.text}`)
      .join("\n\n");
    const intro = "Hello Ecram Execs Reservations,\nI would like to continue my journey inquiry:\n\n";
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(intro + formatted + "\n\n(Transferred from website concierge)")}`;
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || waiting) return;

    const guestMessage: Message = { from: "guest", text: trimmed };
    const nextMessages = [...messages, guestMessage];
    setMessages(nextMessages);
    setWaiting(true);

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: nextMessages.map((m) => ({
            role: m.from === "guest" ? "user" : "assistant",
            content: m.text,
          })),
          locale,
        }),
      });

      if (!res.ok) {
        throw new Error("Concierge request failed");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          from: "agent",
          text: data.reply || copy.noAnswer,
          handoff: data.handoff ?? false,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          from: "agent",
          text: copy.noAnswer,
          handoff: true,
        },
      ]);
    } finally {
      setWaiting(false);
      field.current?.focus();
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
    const value = input.value;
    input.value = "";
    sendMessage(value);
  }

  return (
    <div className="flex flex-col flex-1 min-h-[460px] max-h-[560px]">
      {/* Active Conversation Messages Area */}
      <div
        ref={log}
        role="log"
        aria-live="polite"
        className="flex-1 py-5 px-4 gap-4 flex flex-col overflow-y-auto text-[14px] md:px-6"
      >
        {messages.map((m, i) => {
          const isGuest = m.from === "guest";
          return (
            <div
              key={i}
              className={`flex flex-col max-w-[88%] ${isGuest ? "self-end items-end" : "self-start items-start"}`}
            >
              <div
                className={`py-3 px-4.5 rounded-2xl leading-relaxed text-[14px] ${
                  isGuest
                    ? "bg-white text-ink-950 rounded-tr-xs font-medium shadow-sm"
                    : "border border-ink-750 bg-ink-850/80 text-ink-150 rounded-tl-xs"
                }`}
              >
                {m.text}
              </div>

              {/* WhatsApp transfer button when query requires personal touch */}
              {m.handoff && (
                <div className="mt-2.5">
                  <a
                    href={getWhatsAppUrl(messages.slice(0, i + 1))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-600/30 transition-colors shadow-2xs"
                  >
                    <WhatsAppIcon className="size-3.5 text-emerald-400" />
                    <span>{copy.whatsappCta || "Continue on WhatsApp"}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              )}
            </div>
          );
        })}

        {/* Starter suggestion chips when only the welcome message is present */}
        {messages.length === 1 && !waiting && (
          <div className="pt-2 flex flex-wrap gap-2">
            {starterChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => sendMessage(chip.query)}
                className="px-3.5 py-1.5 rounded-full border border-ink-700 bg-ink-850 text-ink-300 hover:text-white hover:border-ink-500 hover:bg-ink-800 text-xs font-medium transition-colors cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Typing indicator */}
        {waiting && (
          <div className="py-3 px-4 border border-ink-750 bg-ink-850/60 rounded-2xl rounded-tl-xs self-start text-ink-450 flex items-center gap-2.5 text-[12px]">
            <span className="typing gap-1 inline-flex" aria-label={copy.isTyping}>
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form className="border-t border-t-ink-800 flex bg-ink-950/60" onSubmit={onSubmit}>
        <label className="flex-1 flex">
          <span className="overflow-hidden [clip:rect(0px,0px,0px,0px)] h-px absolute w-px">{copy.inputLabel}</span>
          <input
            ref={field}
            className="py-0 px-5 border-none flex-1 outline-none bg-transparent text-white text-[15px] min-h-[54px] min-w-0 placeholder:text-ink-500 md:text-[14px]"
            name="message"
            type="text"
            placeholder={copy.inputPlaceholder}
            maxLength={500}
            autoComplete="off"
          />
        </label>
        <button
          className="border-0 border-l border-l-ink-800 items-center bg-transparent text-white cursor-pointer flex justify-center w-14 hover:bg-ink-800/50 transition-colors disabled:opacity-40"
          type="submit"
          aria-label={copy.send}
          disabled={waiting}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
