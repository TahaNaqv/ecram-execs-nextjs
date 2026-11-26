import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { count, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { mollieConfig } from "@/lib/mollie/config";
import { moneybirdConfigured } from "@/lib/moneybird/config";

export const SITE_ADDRESS = "https://www.ecramexecs.com";

const COMMIT = /^[0-9a-f]{7,40}$/i;

/** The deployed git commit: GIT_COMMIT (or a host's own variable) when set, else the checkout's .git/HEAD. Never throws. */
export async function appVersion(): Promise<string> {
  const fromEnv = [process.env.GIT_COMMIT, process.env.SOURCE_COMMIT, process.env.VERCEL_GIT_COMMIT_SHA]
    .map((value) => value?.trim() ?? "")
    .find((value) => COMMIT.test(value));
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    const gitDir = path.join(process.cwd(), ".git");
    const head = (await readFile(path.join(gitDir, "HEAD"), "utf8")).trim();
    if (COMMIT.test(head)) return head.slice(0, 7);
    const ref = /^ref: (refs\/[\w./-]+)$/.exec(head)?.[1];
    if (!ref || ref.includes("..")) return "unknown";
    const loose = await readFile(path.join(gitDir, ref), "utf8").then((text) => text.trim()).catch(() => "");
    if (COMMIT.test(loose)) return loose.slice(0, 7);
    const packed = await readFile(path.join(gitDir, "packed-refs"), "utf8").catch(() => "");
    const line = packed.split("\n").find((entry) => entry.endsWith(` ${ref}`));
    const sha = line?.split(" ")[0] ?? "";
    return COMMIT.test(sha) ? sha.slice(0, 7) : "unknown";
  } catch {
    return "unknown";
  }
}

/** Online payments, as lib/mollie/config decides it. The key itself is never shown. */
export function paymentsMode(): "Live" | "Test mode" | "Off" {
  const config = mollieConfig();
  if (!config) return "Off";
  return config.mode === "live" ? "Live" : "Test mode";
}

/** Mirrors the mail provider choice in lib/email.ts, without reading any secret's value out. */
export function emailProvider(): string | null {
  const { RESEND_API_KEY, SMTP_HOST, SMTP_USER, SMTP_PASS, EMAIL_PROVIDER } = process.env;
  const smtp = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
  if (EMAIL_PROVIDER === "smtp" && smtp) return "SMTP";
  if (RESEND_API_KEY) return "Resend";
  if (smtp) return "SMTP";
  return null;
}

export const moneybirdConnected = () => moneybirdConfigured();

export async function platformCounts() {
  const [[staff], [vehicles], [drivers], [partners]] = await Promise.all([
    db.select({ n: count() }).from(schema.adminUsers),
    db.select({ n: count() }).from(schema.vehicles),
    db.select({ n: count() }).from(schema.drivers).where(eq(schema.drivers.active, true)),
    db.select({ n: count() }).from(schema.corporateContacts).where(isNull(schema.corporateContacts.archivedAt)),
  ]);
  return { staff: staff?.n ?? 0, vehicles: vehicles?.n ?? 0, drivers: drivers?.n ?? 0, partners: partners?.n ?? 0 };
}

const savedAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Amsterdam",
});

export const formatSavedAt = (date: Date) => savedAtFormat.format(date);

/** Every saved version of the terms, newest first. */
export async function termsHistory() {
  const rows = await db
    .select({
      id: schema.termsVersions.id,
      version: schema.termsVersions.version,
      body: schema.termsVersions.body,
      savedAt: schema.termsVersions.savedAt,
      savedBy: schema.adminUsers.name,
    })
    .from(schema.termsVersions)
    .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.termsVersions.savedBy))
    .orderBy(desc(schema.termsVersions.savedAt));
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    body: row.body,
    savedAt: formatSavedAt(row.savedAt),
    savedBy: row.savedBy ?? "Unknown",
  }));
}
