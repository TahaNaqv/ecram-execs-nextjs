import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { DEFAULT_LEGAL } from "@/lib/legal/defaults";
import { livePublished } from "@/lib/legal/documents";

export type BookingRules = {
  minNoticeHours: number;
  waitingMinutes: number;
  cancellationHours: number;
};

const DEFAULTS: BookingRules = { minNoticeHours: 2, waitingMinutes: 15, cancellationHours: 24 };

export async function bookingRules(): Promise<BookingRules> {
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, "booking_rules")).limit(1);
  const value = row?.value;
  if (!value || typeof value !== "object") return DEFAULTS;
  const raw = value as Partial<BookingRules>;
  return {
    minNoticeHours: numberOr(raw.minNoticeHours, DEFAULTS.minNoticeHours),
    waitingMinutes: numberOr(raw.waitingMinutes, DEFAULTS.waitingMinutes),
    cancellationHours: numberOr(raw.cancellationHours, DEFAULTS.cancellationHours),
  };
}

function numberOr(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** The Terms & Conditions in force now (the newest published version), whose version each new booking records. */
export async function currentTerms(): Promise<{ version: string; body: string }> {
  const live = await livePublished("terms");
  return live ? { version: live.version, body: live.body } : { version: DEFAULT_LEGAL.terms.version, body: DEFAULT_LEGAL.terms.body };
}
