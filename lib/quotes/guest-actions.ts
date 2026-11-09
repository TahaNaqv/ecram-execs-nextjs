"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { notifyTeamGuestMessage } from "@/lib/email";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getGuestBooking } from "@/lib/quotes/guest";
import { GUEST_MESSAGEABLE } from "@/lib/quotes/constants";

export type GuestMessageState = { status: "idle" } | { status: "ok"; notice: string } | { status: "error"; message: string };

const q = schema.quoteRequests;
const m = schema.bookingMessages;

/** At most this many messages from the visitor per booking per hour: enough for a conversation, not for a flood. */
const LIMIT = { max: 10, minutes: 60 };

const input = z.object({
  reference: z.string(),
  k: z.string(),
  locale: z.enum(["en", "nl"]).catch("en"),
  body: z.string().trim().min(1).max(2000),
});

/**
 * A message from the visitor about their booking, from the private link (no account). The key is checked again here,
 * the booking must still be open, and the team is told by email. What they wrote is stored as plain text.
 */
export async function sendGuestMessage(_prev: GuestMessageState, formData: FormData): Promise<GuestMessageState> {
  const locale = formData.get("locale") === "nl" ? "nl" : "en";
  const t = (await getDictionary(locale)).guestBooking;
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path[0] === "body" && i.code === "too_big");
    return { status: "error", message: tooLong ? t.messageTooLong : t.messageRequired };
  }
  const booking = await getGuestBooking(parsed.data.reference, parsed.data.k);
  if (!booking) return { status: "error", message: t.messageFailed };

  try {
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(m)
      .where(and(eq(m.requestId, booking.id), eq(m.authorKind, "guest"), gt(m.createdAt, sql`now() - make_interval(mins => ${LIMIT.minutes})`)));
    if (recent >= LIMIT.max) return { status: "error", message: t.messageRateLimited };

    // Only while the booking is still open: the status is checked in the same statement that writes the message
    const open = sql.join(GUEST_MESSAGEABLE.map((s) => sql`${s}`), sql`, `);
    const inserted = await db.execute<{ request_id: string }>(sql`
      insert into booking_messages (request_id, author_kind, kind, body)
      select ${q.id}, 'guest', 'message', ${parsed.data.body}::text
      from ${q}
      where ${q.id} = ${booking.id}::uuid and ${q.status}::text in (${open})
      returning request_id`);
    if (Array.from(inserted).length === 0) return { status: "error", message: t.messagesClosed };

    const [request] = await db.select().from(q).where(eq(q.id, booking.id)).limit(1);
    after(() => notifyTeamGuestMessage({ request, body: parsed.data.body }));
  } catch (err) {
    console.error("[booking] guest message failed", err);
    return { status: "error", message: t.messageFailed };
  }
  refresh();
  return { status: "ok", notice: t.sent };
}
