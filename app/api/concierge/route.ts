import { NextResponse } from "next/server";
import { bestMatch } from "@/lib/concierge/match";

export async function POST(req: Request) {
  try {
    const { message, faqs = [], conversationHistory = [] } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

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

    const faqKnowledgeBase = faqs
      .map(([q, a]: [string, string]) => `Q: ${q}\nA: ${a}`)
      .join("\n\n");

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

    // Format conversation history for Anthropic API
    const formattedHistory = conversationHistory
      .slice(-6)
      .map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

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
        messages: [
          ...formattedHistory,
          { role: "user", content: message },
        ],
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