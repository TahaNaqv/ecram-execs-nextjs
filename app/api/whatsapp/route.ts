import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * WhatsApp Business webhook. Meta calls GET to verify the callback, then POST for each inbound message.
 * WHATSAPP_VERIFY_TOKEN is the token entered in the Meta app. WHATSAPP_APP_SECRET checks the POST signature.
 * Inbound messages are stored as chats with channel "whatsapp" and follow-up required.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token || params.get("hub.verify_token") !== token) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
}

type Inbound = {
  entry?: { changes?: { value?: { messages?: { from?: string; text?: { body?: string } }[]; contacts?: { profile?: { name?: string } }[] } }[] }[];
};

export async function POST(request: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const digest = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(digest);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = JSON.parse(raw) as Inbound;
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const text = message?.text?.body?.trim();
  if (!message?.from || !text) return NextResponse.json({ ok: true });
  const name = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name ?? null;
  const sessionId = `wa:${message.from}`;
  const [existing] = await db
    .select({ id: schema.conciergeConversations.id, count: schema.conciergeConversations.messageCount })
    .from(schema.conciergeConversations)
    .where(eq(schema.conciergeConversations.sessionId, sessionId))
    .limit(1);
  if (!existing) {
    const [created] = await db
      .insert(schema.conciergeConversations)
      .values({ sessionId, channel: "whatsapp", visitorName: name, followUp: true, messageCount: 1 })
      .returning({ id: schema.conciergeConversations.id });
    if (created) await db.insert(schema.conciergeMessages).values({ conversationId: created.id, position: 0, role: "visitor", content: text });
  } else {
    await db.insert(schema.conciergeMessages).values({ conversationId: existing.id, position: existing.count, role: "visitor", content: text });
    await db
      .update(schema.conciergeConversations)
      .set({ lastMessageAt: new Date(), messageCount: existing.count + 1, followUp: true, visitorName: name, channel: "whatsapp" })
      .where(eq(schema.conciergeConversations.sessionId, sessionId));
  }
  return NextResponse.json({ ok: true });
}
