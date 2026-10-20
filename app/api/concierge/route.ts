import { NextResponse } from "next/server";
import { faqsFrom } from "@/lib/concierge/faqs";
import { bestMatch } from "@/lib/concierge/match";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { withinLimit } from "@/lib/rate-limit";
import { visitor } from "@/lib/request-meta";

/** Anyone can call this endpoint, and each call can cost money, so what it accepts is small and fixed. */
const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;
const LIMIT = { max: 20, windowMs: 10 * 60_000 };

type Turn = { role: "user" | "assistant"; content: string };

/**
 * The conversation so far, cleaned: only the last few turns, each a short piece of text. The model's first turn must be
 * the visitor's (the chat opens with a greeting from the concierge, which is dropped), and the message being answered is
 * sent separately, so a copy of it at the end is dropped too.
 */
function cleanHistory(raw: unknown, message: string): Turn[] {
  if (!Array.isArray(raw)) return [];
  const turns: Turn[] = raw
    .slice(-MAX_HISTORY)
    .filter((m): m is { role: string; content: string } => !!m && typeof m.content === "string")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content.slice(0, MAX_MESSAGE) }));
  if (turns.at(-1)?.role === "user" && turns.at(-1)?.content === message) turns.pop();
  while (turns[0]?.role === "assistant") turns.shift();
  return turns;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message || message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: "Message is required (at most 500 characters)" }, { status: 400 });
    }

    const { ipHash } = await visitor();
    if (!withinLimit(`concierge:${ipHash}`, LIMIT.max, LIMIT.windowMs)) {
      return NextResponse.json(
        { reply: "Our reservations desk is available around the clock. You can connect directly with our team on WhatsApp.", handoff: true },
        { status: 429 },
      );
    }

    // The questions and answers come from our own dictionary, never from the request
    const locale = isLocale(body?.locale) ? body.locale : DEFAULT_LOCALE;
    const faqs = faqsFrom((await getDictionary(locale)).conciergeSection);
    const conversationHistory = cleanHistory(body?.conversationHistory, message);

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

    // Fallback if Claude API key is not configured yet
    if (!apiKey) {
      const match = bestMatch(message, faqs);
      if (match?.answer) {
        return NextResponse.json({
          reply: match.answer,
          handoff: false,
        });
      }

      return NextResponse.json({
        reply:
          "For bespoke journey details, custom quotations, or personal assistance, our reservations team is available 24/7. You can connect directly with our dispatch team on WhatsApp.",
        handoff: true,
      });
    }

    const faqKnowledgeBase = faqs.map(([q, a]) => `Q: ${q}\nA: ${a}`).join("\n\n");

    const systemPrompt = `You are the AI Concierge for Ecram Execs, an ultra-luxury electric executive chauffeur service in the Netherlands.
Our Fleet: 100% electric luxury obsidian black vehicles (Mercedes-Benz VLE 300, Audi, Cadillac Escalade, Range Rover, Hongqi E-HS9).
Our Services:
- Airport transfers (Schiphol AMS, Rotterdam The Hague RTM, Eindhoven EIN, and private aviation / FBOs like Jet Aviation). Includes real-time flight tracking, arrivals meet & greet, luggage handling.
- Business & Corporate travel (hourly, multi-stop, corporate accounts with centralized billing).
- Private occasions & bespoke travel programs across the Netherlands and Europe.
- Professional chauffeurs: impeccably presented, licensed, fully vetted, complete discretion & confidentiality.

Tone & Style:
- Professional, discreet, refined, concise, and courteous (executive hospitality).
- Keep responses concise (2 to 4 sentences maximum), elegant, and direct.

Knowledge Base:
-----------------------------------
${faqKnowledgeBase}
-----------------------------------

CRITICAL RULES (DO NOT BE DELUSIONAL):
1. Only answer basic queries about our services, fleet, booking procedures, airport protocols, and general executive chauffeur operations based on factual knowledge.
2. DO NOT invent specific price quotes (each journey is quoted personally through our booking form or reservations desk).
3. DO NOT promise guaranteed vehicle availability for specific dates/times.
4. DO NOT answer questions completely unrelated to executive chauffeur travel or luxury hospitality.
5. If the user's question is out of scope, requires custom negotiation, involves urgent changes, or cannot be answered accurately from the knowledge base:
   - Politely explain that our reservations team will gladly assist them personally.
   - Mention that they can connect directly with our team on WhatsApp.
   - End your response with the token: [HANDOFF_WHATSAPP]`;

    const model = "claude-haiku-4-5-20251001";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 350,
        system: systemPrompt,
        messages: [...conversationHistory, { role: "user", content: message }],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Claude API error (${response.status}):`, errText);

      // Graceful fallback to bestMatch
      const match = bestMatch(message, faqs);
      if (match?.answer) {
        return NextResponse.json({ reply: match.answer, handoff: false });
      }

      return NextResponse.json({
        reply:
          "I would be pleased to connect you directly with our reservations team. You can continue our conversation with our team directly on WhatsApp.",
        handoff: true,
      });
    }

    const data = await response.json();
    const rawReply: string = data.content?.[0]?.text || "";

    const shouldHandoff =
      rawReply.includes("[HANDOFF_WHATSAPP]") ||
      /whatsapp/i.test(message) ||
      /speak to a human|talk to human|call me|whatsapp/i.test(message);

    const cleanReply = rawReply.replace(/\[HANDOFF_WHATSAPP\]/g, "").trim();

    return NextResponse.json({
      reply: cleanReply || "Welcome to Ecram Execs. How may we assist with your journey today?",
      handoff: shouldHandoff,
    });
  } catch (err) {
    console.error("Concierge API error:", err);
    return NextResponse.json({
      reply:
        "Our reservations desk is available around the clock to assist you. You can connect directly with our team on WhatsApp.",
      handoff: true,
    });
  }
}