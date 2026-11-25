import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

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

export async function currentTerms(): Promise<{ version: string; body: string }> {
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, "terms_en")).limit(1);
  const value = row?.value;
  if (!value || typeof value !== "object") return { version: "1", body: "" };
  const raw = value as { version?: unknown; body?: unknown };
  return { version: typeof raw.version === "string" && raw.version ? raw.version : "1", body: typeof raw.body === "string" ? raw.body : "" };
}
