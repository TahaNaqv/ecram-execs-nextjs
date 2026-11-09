import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { FLEET_BASE_KEY, parseFleetBase, type FleetBase } from "./base";

const s = schema.appSettings;

/** The fleet's base as the team last saved it, with who and when; null base until it is set. */
export async function fleetBaseSetting(): Promise<{ base: FleetBase | null; updatedAt: Date | null; updatedBy: string | null }> {
  const row = await readSetting().catch((error) => {
    console.error("[fleet] could not read the base for the Fleet page:", error);
    return undefined;
  });
  return { base: parseFleetBase(row?.value), updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
}

async function readSetting() {
  const [row] = await db
    .select({ value: s.value, updatedAt: s.updatedAt, updatedBy: schema.adminUsers.name })
    .from(s)
    .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, s.updatedBy))
    .where(eq(s.key, FLEET_BASE_KEY))
    .limit(1);
  return row;
}

/**
 * The fleet's base, for the drive home when a booking is confirmed. Read fresh each time (a confirm is rare, and a base the team
 * just changed counts at once). A database hiccup gives null: the drive back is then measured to the pick-up, never blocking a confirm.
 */
export async function getFleetBase(): Promise<FleetBase | null> {
  try {
    const [row] = await db.select({ value: s.value }).from(s).where(eq(s.key, FLEET_BASE_KEY)).limit(1);
    return parseFleetBase(row?.value);
  } catch (error) {
    console.error("[fleet] could not read the base, the drive back is measured to the pick-up:", error);
    return null;
  }
}
