import "server-only";
import { access, constants } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { storageConfigured } from "@/lib/storage";

/**
 * What a service looks like from here. Honest about how much was checked: only the database is asked a question
 * ("operational" or "down"); the others are "configured" when their keys are in place; "notConnected" is a service the system
 * has no link to at all.
 */
export type HealthState = "operational" | "configured" | "missing" | "down" | "notConnected";
export type HealthKey = "database" | "email" | "address" | "concierge" | "documents" | "cdt" | "mollie" | "whatsappBusiness";
export type HealthItem = { key: HealthKey; state: HealthState; ms?: number };

const set = (name: string) => Boolean(process.env[name]?.trim());

async function databaseState(): Promise<HealthItem> {
  const started = performance.now();
  try {
    await Promise.race([db.execute(sql`select 1`), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))]);
    return { key: "database", state: "operational", ms: Math.round(performance.now() - started) };
  } catch {
    return { key: "database", state: "down" };
  }
}

async function documentsState(): Promise<HealthItem> {
  const dir = process.env.DOCUMENTS_DIR?.trim();
  if (dir) {
    try {
      await access(dir, constants.W_OK);
      return { key: "documents", state: "configured" };
    } catch {
      return { key: "documents", state: "down" };
    }
  }
  // Without a folder, the same test the app uses to decide whether it can store documents at all (the Supabase keys, both of them)
  return { key: "documents", state: storageConfigured() ? "configured" : "missing" };
}

/** The services the site relies on, for the dashboard. Reports only yes or no per service: no key or path ever leaves this file. */
export async function systemHealth(): Promise<HealthItem[]> {
  await requireAdmin();
  const emailReady = (set("RESEND_API_KEY") || (set("SMTP_HOST") && set("SMTP_USER") && set("SMTP_PASS"))) && set("EMAIL_FROM");
  const [database, documents] = await Promise.all([databaseState(), documentsState()]);
  return [
    database,
    { key: "email", state: emailReady ? "configured" : "missing" },
    { key: "address", state: set("GOOGLE_MAPS_API_KEY") ? "configured" : "missing" },
    // (without a key the concierge still answers from the FAQ, but not in its own words)
    { key: "concierge", state: set("ANTHROPIC_API_KEY") || set("CLAUDE_API_KEY") ? "configured" : "missing" },
    documents,
    { key: "cdt", state: "notConnected" },
    { key: "mollie", state: "notConnected" },
    { key: "whatsappBusiness", state: "notConnected" },
  ];
}
