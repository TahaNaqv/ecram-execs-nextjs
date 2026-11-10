"use server";

import { and, count, eq, gt, inArray } from "drizzle-orm";
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
  reference: z.string().trim().min(1),
  k: z.string().trim().min(1),
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
  const parsed = input.safeParse({
    reference: formData.get("reference"),
    k: formData.get("k"),
    locale: formData.get("locale"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.path[0] === "body" && i.code === "too_big");
    return { status: "error", message: tooLong ? t.messageTooLong : t.messageRequired };
  }
  const booking = await getGuestBooking(parsed.data.reference, parsed.data.k);
  if (!booking) return { status: "error", message: t.messageFailed };
  if (!(GUEST_MESSAGEABLE as readonly string[]).includes(booking.status)) {
    return { status: "error", message: t.messagesClosed };
  }

  try {
    const since = new Date(Date.now() - LIMIT.minutes * 60_000);
    const [{ recent }] = await db
      .select({ recent: count() })
      .from(m)
      .where(and(eq(m.requestId, booking.id), eq(m.authorKind, "guest"), gt(m.createdAt, since)));
    if (recent >= LIMIT.max) return { status: "error", message: t.messageRateLimited };

    // Status is checked again in the same write so a booking that closed between page load and click cannot receive one.
    const inserted = await db.transaction(async (tx) => {
      const [open] = await tx
        .select({ id: q.id })
        .from(q)
        .where(and(eq(q.id, booking.id), inArray(q.status, [...GUEST_MESSAGEABLE])))
        .limit(1);
      if (!open) return null;
      const [row] = await tx
        .insert(m)
        .values({ requestId: booking.id, authorKind: "guest", kind: "message", body: parsed.data.body })
        .returning({ requestId: m.requestId });
      return row ?? null;
    });
    if (!inserted) return { status: "error", message: t.messagesClosed };

    const [request] = await db.select().from(q).where(eq(q.id, booking.id)).limit(1);
    if (request) after(() => notifyTeamGuestMessage({ request, body: parsed.data.body }));
  } catch (err) {
    console.error("[booking] guest message failed", err);
    return { status: "error", message: t.messageFailed };
  }
  refresh();
  return { status: "ok", notice: t.sent };
}
