import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const TEMPLATE_KEYS = ["booking_received", "booking_confirmed", "payment_notice", "booking_alternative", "booking_cancelled"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_DEFAULTS: Record<TemplateKey, { subject: string; body: string }> = {
  booking_received: {
    subject: "We have your booking {reference}",
    body: "Thank you. Your booking {reference} is with us and is being reviewed. Nothing further is needed until we write again.",
  },
  booking_confirmed: {
    subject: "Your booking {reference} is confirmed",
    body: "Your booking {reference} is confirmed. The amount is {amount}.",
  },
  payment_notice: {
    subject: "Payment for booking {reference}",
    body: "A payment of {amount} for booking {reference} has been recorded. Any remaining balance follows the schedule on your booking.",
  },
  booking_alternative: {
    subject: "About your booking {reference}",
    body: "We cannot take booking {reference} as it was asked. We will follow up with an alternative, or the amount paid is returned.",
  },
  booking_cancelled: {
    subject: "Booking {reference} is cancelled",
    body: "Booking {reference} is cancelled. If a payment is due back, it is handled separately and you will see it on your statement.",
  },
};

export function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export async function listTemplates() {
  const rows = await db.select().from(schema.emailTemplates);
  const saved = new Map(rows.map((row) => [row.key, row]));
  return TEMPLATE_KEYS.map((key) => {
    const row = saved.get(key);
    return {
      key,
      subject: row?.subject ?? TEMPLATE_DEFAULTS[key].subject,
      body: row?.body ?? TEMPLATE_DEFAULTS[key].body,
      custom: Boolean(row),
    };
  });
}

export async function saveTemplate(key: TemplateKey, subject: string, body: string, adminId: string) {
  await db
    .insert(schema.emailTemplates)
    .values({ key, subject, body, updatedBy: adminId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.emailTemplates.key, set: { subject, body, updatedBy: adminId, updatedAt: new Date() } });
}

/** The saved subject and opening paragraph, or null when the built-in email should be used. */
export async function templateOverride(key: TemplateKey): Promise<{ subject: string; body: string } | null> {
  const [row] = await db.select({ subject: schema.emailTemplates.subject, body: schema.emailTemplates.body }).from(schema.emailTemplates).where(eq(schema.emailTemplates.key, key)).limit(1);
  if (!row?.subject.trim() || !row.body.trim()) return null;
  return row;
}
