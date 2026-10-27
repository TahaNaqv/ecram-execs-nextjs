import "server-only";
import { eq, sql } from "drizzle-orm";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { ConciergeMessage } from "@/lib/db/schema";
import { CHAT_BOOKING_STATUSES, RETENTION } from "@/lib/retention";

/** Chats with the website's concierge, for the team to read. They are kept for RETENTION.chatDays days (lib/concierge/store.ts). */
export const CHAT_LIST_LIMIT = 100;

export type ChatRow = {
  id: string;
  locale: "en" | "nl";
  startedMs: number;
  lastMs: number;
  messages: number;
  /** What the visitor opened with */
  preview: string | null;
  /** The visitor was offered the hand-over to WhatsApp */
  handedOver: boolean;
  /** The booking the chat recorded was complete at the last reply */
  ready: boolean;
  /** The booking request sent from this chat */
  request: { id: string; reference: string } | null;
};

type Raw = Omit<ChatRow, "request"> & { request_id: string | null; request_reference: string | null };

export const chatList = cache(async (): Promise<{ nowMs: number; rows: ChatRow[]; total: number; booked: number; days: number }> => {
  await requireAdmin();
  const rows = Array.from(
    await db.execute<Raw>(sql`
      select c.id, c.locale::text as locale, c.message_count as messages,
             (extract(epoch from c.started_at) * 1000)::float8 as "startedMs",
             (extract(epoch from c.last_message_at) * 1000)::float8 as "lastMs",
             (select m.content from concierge_messages m where m.conversation_id = c.id and m.role = 'visitor' order by m.position limit 1) as preview,
             exists (select 1 from concierge_messages m where m.conversation_id = c.id and m.meta->>'handoff' = 'true') as "handedOver",
             coalesce((select m.meta->>'ready' = 'true' from concierge_messages m where m.conversation_id = c.id and m.role = 'concierge' order by m.position desc limit 1), false) as ready,
             q.id as request_id, q.reference as request_reference
      from concierge_conversations c
      left join quote_requests q on q.id = c.request_id
      order by c.last_message_at desc
      limit ${CHAT_LIST_LIMIT}`),
  );
  const [totals] = Array.from(await db.execute<{ total: number; booked: number }>(sql`select count(*)::int as total, count(request_id)::int as booked from concierge_conversations`));
  return {
    nowMs: Date.now(),
    days: RETENTION.chatDays,
    total: totals?.total ?? 0,
    booked: totals?.booked ?? 0,
    rows: rows.map(({ request_id, request_reference, ...chat }) => ({ ...chat, request: request_id && request_reference ? { id: request_id, reference: request_reference } : null })),
  };
});

export const chatDetail = cache(async (id: string) => {
  await requireAdmin();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) return null;
  const [chat] = await db
    .select({
      id: schema.conciergeConversations.id,
      locale: schema.conciergeConversations.locale,
      startedAt: schema.conciergeConversations.startedAt,
      lastMessageAt: schema.conciergeConversations.lastMessageAt,
      messageCount: schema.conciergeConversations.messageCount,
      draft: schema.conciergeConversations.draft,
      requestId: schema.quoteRequests.id,
      reference: schema.quoteRequests.reference,
      requestStatus: schema.quoteRequests.status,
    })
    .from(schema.conciergeConversations)
    .leftJoin(schema.quoteRequests, eq(schema.quoteRequests.id, schema.conciergeConversations.requestId))
    .where(eq(schema.conciergeConversations.id, id))
    .limit(1);
  if (!chat) return null;
  const messages: ConciergeMessage[] = await db.select().from(schema.conciergeMessages).where(eq(schema.conciergeMessages.conversationId, id)).orderBy(schema.conciergeMessages.position);
  // The year applies while the booking is live (RETENTION.chatBookingDays)
  const live = chat.requestStatus !== null && (CHAT_BOOKING_STATUSES as readonly string[]).includes(chat.requestStatus);
  return { chat, messages, days: live ? RETENTION.chatBookingDays : RETENTION.chatDays, live };
});

/** The chat a booking request was sent from, if it was sent from one. */
export const chatForRequest = cache(async (requestId: string) => {
  await requireAdmin();
  const [row] = await db.select({ id: schema.conciergeConversations.id }).from(schema.conciergeConversations).where(eq(schema.conciergeConversations.requestId, requestId)).limit(1);
  return row?.id ?? null;
});
