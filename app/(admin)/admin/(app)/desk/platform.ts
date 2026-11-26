import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, schema } from "@/lib/db";
import { mollieConfig } from "@/lib/mollie/config";
import { moneybirdConfigured } from "@/lib/moneybird/config";
import type { LegalDoc } from "@/lib/legal/documents";

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

/** One version of a legal document as the Settings editor shows it (desk/legal-editor.tsx). */
export type LegalVersionView = {
  id: string;
  status: "draft" | "published";
  version: string;
  body: string;
  effectiveOn: string;
  savedAt: string;
  savedBy: string;
  publishedAt: string | null;
  publishedBy: string | null;
  /** The live version: the newest published one */
  current: boolean;
  /** Bookings that agreed to this version (the terms only); such a version cannot be deleted */
  bookings: number;
};

/** Every version of a legal document: drafts first, then the published ones from the newest. */
export async function legalVersions(doc: LegalDoc): Promise<LegalVersionView[]> {
  const saver = alias(schema.adminUsers, "saver");
  const publisher = alias(schema.adminUsers, "publisher");
  const [rows, used] = await Promise.all([
    db
      .select({
        id: schema.termsVersions.id,
        status: schema.termsVersions.status,
        version: schema.termsVersions.version,
        body: schema.termsVersions.body,
        effectiveOn: schema.termsVersions.effectiveOn,
        savedAt: schema.termsVersions.savedAt,
        savedBy: saver.name,
        publishedAt: schema.termsVersions.publishedAt,
        publishedBy: publisher.name,
      })
      .from(schema.termsVersions)
      .leftJoin(saver, eq(saver.id, schema.termsVersions.savedBy))
      .leftJoin(publisher, eq(publisher.id, schema.termsVersions.publishedBy))
      .where(eq(schema.termsVersions.doc, doc))
      .orderBy(desc(schema.termsVersions.publishedAt), desc(schema.termsVersions.savedAt)),
    doc === "terms"
      ? db
          .select({ version: schema.quoteRequests.termsVersion, n: count() })
          .from(schema.quoteRequests)
          .where(isNotNull(schema.quoteRequests.termsVersion))
          .groupBy(schema.quoteRequests.termsVersion)
      : Promise.resolve([] as { version: string | null; n: number }[]),
  ]);
  const bookings = new Map(used.map((row) => [row.version, row.n]));
  const live = rows.filter((row) => row.status === "published" && row.publishedAt).sort((a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime())[0];
  const views = rows.map((row) => ({
    id: row.id,
    status: row.status,
    version: row.version,
    body: row.body,
    effectiveOn: row.effectiveOn ?? (row.publishedAt ? row.publishedAt.toISOString().slice(0, 10) : ""),
    savedAt: formatSavedAt(row.savedAt),
    savedBy: row.savedBy ?? "Unknown",
    publishedAt: row.publishedAt ? formatSavedAt(row.publishedAt) : null,
    publishedBy: row.publishedAt ? (row.publishedBy ?? "Unknown") : null,
    current: row.id === live?.id,
    bookings: bookings.get(row.version) ?? 0,
  }));
  return [...views.filter((view) => view.status === "draft"), ...views.filter((view) => view.status === "published")];
}
