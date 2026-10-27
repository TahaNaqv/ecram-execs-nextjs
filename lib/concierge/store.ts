import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { ConciergeMessageMeta } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n/config";
import { CHAT_BOOKING_STATUSES, RETENTION } from "@/lib/retention";
import { plain } from "./plain";

/**
 * Keeping the chats. Every exchange between a visitor and the concierge is saved for RETENTION.chatDays days, or
 * RETENTION.chatBookingDays when the chat belongs to a live booking (privacy policy: s2p4 and s5p1), under the anonymous session id the visitor's browser tab made for the chat. Saving never
 * slows a reply or breaks one: it runs after the reply has gone out, and a failure is only logged.
 */

/** The anonymous id a chat's browser tab makes: 128 random bits as 32 hex characters. */
export const SESSION_ID = /^[a-f0-9]{32}$/;

/** A chat is not kept past this many messages (abuse, not conversation: the rate limit alone allows more over time). */
const MAX_MESSAGES = 400;
const MAX_REPLY = 4000;
/**
 * The most chats one address can start in a day, and the most chats kept in all. Beyond these the chat still works: it is just
 * not saved. They stop the table being filled by someone who invents session ids, which the rate limit alone cannot.
 */
const MAX_NEW_PER_ADDRESS_PER_DAY = 100;
const MAX_CHATS = 20_000;
/** Expired chats removed (a few at a time) whenever a new chat starts, so the period holds between the runs of the weekly clean-up job. */
const PURGE_BATCH = 20;

export type Turn = {
  /** The chat's anonymous session id (32 hex characters, checked by the caller) */
  session: string;
  locale: Locale;
  ipHash: string;
  /** What the visitor wrote, and what the concierge answered */
  visitor: string;
  reply: string;
  meta: ConciergeMessageMeta;
  /** The booking draft after this turn; empty when the assistant has recorded nothing */
  draft: Record<string, unknown>;
};

export async function recordTurn(turn: Turn): Promise<void> {
  try {
    const c = schema.conciergeConversations;
    const draft = Object.keys(turn.draft).length > 0 ? turn.draft : null;

    const started = await db.transaction(async (tx) => {
      // A chat that is not saved yet is only started within the limits above
      const [known] = await tx.select({ id: c.id }).from(c).where(eq(c.sessionId, turn.session)).limit(1);
      if (!known) {
        const [counts] = await tx.execute<{ mine: number; all: number }>(sql`
          select (select count(*)::int from concierge_conversations where ip_hash = ${turn.ipHash} and started_at > now() - interval '1 day') as mine,
                 (select count(*)::int from concierge_conversations) as "all"`);
        if (!counts || counts.mine >= MAX_NEW_PER_ADDRESS_PER_DAY || counts.all >= MAX_CHATS) {
          console.warn("[concierge] a new chat was not saved: the limit on saved chats was reached");
          return null;
        }
      }

      // One row per chat; two requests at once for the same chat queue up on it, so each gets its own positions.
      // (`xmax = 0` is true only for a row this statement inserted, which is how a new chat is told from a new turn.)
      const [chat] = await tx
        .insert(c)
        .values({ sessionId: turn.session, locale: turn.locale, ipHash: turn.ipHash, messageCount: 2, draft })
        .onConflictDoUpdate({
          target: c.sessionId,
          set: { lastMessageAt: sql`now()`, messageCount: sql`least(${c.messageCount} + 2, ${MAX_MESSAGES + 2})`, draft, locale: turn.locale },
        })
        .returning({ id: c.id, messageCount: c.messageCount, started: sql<boolean>`(xmax = 0)` });

      if (chat.messageCount <= MAX_MESSAGES) {
        const first = chat.messageCount - 2;
        await tx.insert(schema.conciergeMessages).values([
          { conversationId: chat.id, position: first, role: "visitor", content: plain(turn.visitor).slice(0, 500) },
          { conversationId: chat.id, position: first + 1, role: "concierge", content: plain(turn.reply).slice(0, MAX_REPLY), meta: turn.meta },
        ]);
      }
      return chat.started;
    });

    // Outside the visitor's own save, and skipping what another run is already deleting, so the two cannot wait on each other
    if (started) {
      await db.execute(sql`
        delete from concierge_conversations
        where id in (
          select c.id from concierge_conversations c
          where c.last_message_at < now() - make_interval(days => ${RETENTION.chatBookingDays})
             or (
               c.last_message_at < now() - make_interval(days => ${RETENTION.chatDays})
               and not exists (select 1 from quote_requests r where r.id = c.request_id and r.status in (${sql.join(CHAT_BOOKING_STATUSES.map((status) => sql`${status}`), sql`, `)}))
             )
          order by c.last_message_at limit ${PURGE_BATCH}
          for update of c skip locked
        )`);
    }
  } catch (error) {
    console.error("[concierge] could not save the chat", error);
  }
}

/**
 * Joins a chat to the booking request the visitor sent from it. Only a chat that has none yet, so a made-up id cannot take
 * over another's. The request now holds what the visitor gave, so the chat's copy of the draft (name, email, phone) goes.
 */
export async function linkChatToRequest(session: string, requestId: string): Promise<void> {
  try {
    const c = schema.conciergeConversations;
    await db.execute(sql`update ${c} set request_id = ${requestId}, draft = null where session_id = ${session} and request_id is null`);
  } catch (error) {
    console.error("[concierge] could not link the chat to its request", error);
  }
}
