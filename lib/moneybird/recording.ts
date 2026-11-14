import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { mollieConfig } from "@/lib/mollie/config";
import { moneybirdConfig } from "./config";

/**
 * Whether online payments (lib/mollie) are written into Moneybird by this site. Off when MOLLIE_MONEYBIRD_RECORD=off (the
 * accountant connected Mollie in Moneybird, which then matches payments itself), and always off for Mollie's test mode
 * against a real Moneybird: test money never goes into real books (only into the e2e stand-in, on a loopback address).
 */
export function recordingOn(): boolean {
  const mb = moneybirdConfig();
  if (!mb || process.env.MOLLIE_MONEYBIRD_RECORD === "off") return false;
  if (mollieConfig()?.mode === "test" && mb.api.startsWith("https://")) return false;
  return true;
}

/** Paid online (in the current Mollie mode) and not yet written into Moneybird. */
export async function hasUnrecordedPayment(requestId: string): Promise<boolean> {
  const mode = mollieConfig()?.mode;
  if (!mode) return false;
  const p = schema.payments;
  const [row] = await db
    .select({ id: p.id })
    .from(p)
    .where(and(eq(p.requestId, requestId), eq(p.mode, mode), eq(p.status, "paid"), isNull(p.moneybirdRegisteredAt)))
    .limit(1);
  return Boolean(row);
}

/** Paid online at all (in the current mode): with recording off, Moneybird may not know of it yet. */
export async function hasOnlinePayment(requestId: string): Promise<boolean> {
  const mode = mollieConfig()?.mode;
  if (!mode) return false;
  const p = schema.payments;
  const [row] = await db.select({ id: p.id }).from(p).where(and(eq(p.requestId, requestId), eq(p.mode, mode), eq(p.status, "paid"))).limit(1);
  return Boolean(row);
}
