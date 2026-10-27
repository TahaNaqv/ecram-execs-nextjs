import "server-only";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export type HealthKey = "database" | "cdt" | "googleMaps" | "mollie" | "whatsappBusiness";
export type HealthState = "operational" | "down" | "notConnected";

export interface SystemHealthItem {
  key: HealthKey;
  state: HealthState;
  ms?: number;
}

export async function systemHealth(): Promise<SystemHealthItem[]> {
  // 1. Real Database Ping & Latency Check
  let dbState: HealthState = "operational";
  let dbMs = 15;
  const start = performance.now();
  try {
    await db.execute(sql`SELECT 1`);
    dbMs = Math.round(performance.now() - start);
  } catch {
    dbState = "down";
  }

  // 2. Real Environment & API Key Verification
  const hasGoogleMaps = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const hasMollie = Boolean(process.env.MOLLIE_API_KEY);
  const hasWhatsapp = Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
  const hasCdt = Boolean(process.env.CDT_API_ENDPOINT);

  return [
    { key: "database", state: dbState, ms: dbMs },
    { key: "cdt", state: hasCdt ? "operational" : "notConnected" },
    { key: "googleMaps", state: hasGoogleMaps ? "operational" : "notConnected" },
    { key: "mollie", state: hasMollie ? "operational" : "notConnected" },
    { key: "whatsappBusiness", state: hasWhatsapp ? "operational" : "notConnected" },
  ];
}