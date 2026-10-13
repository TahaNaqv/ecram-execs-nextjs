import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

const { corporateContacts: c } = schema;

export async function listCorporateContacts(optedInOnly = false, limit: number | null = 500) {
  await requireAdmin();
  const query = db
    .select()
    .from(c)
    .where(optedInOnly ? eq(c.marketingConsent, true) : undefined)
    .orderBy(desc(c.createdAt));
  return limit === null ? query : query.limit(limit);
}

export async function corporateTotals() {
  await requireAdmin();
  const [{ total }] = await db.select({ total: count() }).from(c);
  const [{ optedIn }] = await db.select({ optedIn: count() }).from(c).where(eq(c.marketingConsent, true));
  return { total, optedIn };
}

/**
 * A spreadsheet treats a cell starting with = + - @ as a formula, and these values come from the public
 * form, so they are neutralised before they reach a CSV someone opens in Excel.
 */
function cell(value: string | null | undefined) {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function corporateContactsCsv(optedInOnly: boolean) {
  // The export is the whole list; only the on-screen list is capped
  const rows = await listCorporateContacts(optedInOnly, null);
  const header = ["name", "email", "position", "company", "kvk", "language", "verified_at", "marketing_consent", "consented_at", "created_at"];
  const lines = rows.map((r) =>
    [
      r.name,
      r.email,
      r.position,
      r.companyName,
      r.kvkNumber,
      r.locale,
      r.verifiedAt?.toISOString(),
      r.marketingConsent ? "yes" : "no",
      r.consentedAt?.toISOString(),
      r.createdAt.toISOString(),
    ]
      .map(cell)
      .join(","),
  );
  // BOM so Excel reads the file as UTF-8 (names with accents)
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}
