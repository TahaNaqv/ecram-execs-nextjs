"use server";

import { and, count, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { LEGAL_DOCS, legalTag, type LegalDoc } from "@/lib/legal/documents";
import { amsterdamToday } from "@/lib/drivers/time";
import type { SettingsResult } from "./actions";

/**
 * The Terms & Conditions and the Privacy Policy, edited in Settings. A draft is saved and edited as often as needed and
 * only the admin sees it; Publish puts it on the website at once (the public pages' cache is cleared). Drafts can be
 * deleted, and so can a published version, unless bookings agreed to it (terms) or it is the only one left.
 */

const MAX_LENGTH = 200_000;
const NAMES: Record<LegalDoc, string> = { terms: "Terms & Conditions", privacy: "Privacy Policy" };

const normalise = (text: string) => text.replace(/\r\n?/g, "\n").trim();
const isDoc = (value: unknown): value is LegalDoc => LEGAL_DOCS.includes(value as LegalDoc);
const lock = (doc: LegalDoc) => sql`select pg_advisory_xact_lock(hashtext(${`legal-${doc}`}))`;

function isoDate(raw: FormDataEntryValue | null): string | null | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) return undefined;
  return text;
}

/** Creates a draft, or saves changes to one (id given). Never touches what the website shows. */
export async function saveLegalDraft(formData: FormData): Promise<SettingsResult & { id?: string }> {
  const admin = await requireArea("/admin/desk");
  const doc = formData.get("doc");
  if (!isDoc(doc)) return { error: "Unknown document." };
  const id = String(formData.get("id") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const body = normalise(String(formData.get("body") ?? ""));
  const effectiveOn = isoDate(formData.get("effectiveOn"));
  if (!version) return { error: "Enter a version for this draft." };
  if (version.length > 40) return { error: "The version is too long (40 characters at most)." };
  if (!body) return { error: "The text cannot be empty." };
  if (body.length > MAX_LENGTH) return { error: "The text is too long." };
  if (effectiveOn === undefined) return { error: "The date is not a valid date." };

  const result = await db.transaction(async (tx) => {
    await tx.execute(lock(doc));
    const [clash] = await tx
      .select({ id: schema.termsVersions.id })
      .from(schema.termsVersions)
      .where(and(eq(schema.termsVersions.doc, doc), eq(schema.termsVersions.version, version), id ? ne(schema.termsVersions.id, id) : undefined))
      .limit(1);
    if (clash) return { error: `Version ${version} is already used. Choose another version.` } as const;
    const now = new Date();
    if (id) {
      const updated = await tx
        .update(schema.termsVersions)
        .set({ version, body, effectiveOn, savedBy: admin.id, savedAt: now })
        .where(and(eq(schema.termsVersions.id, id), eq(schema.termsVersions.doc, doc), eq(schema.termsVersions.status, "draft")))
        .returning({ id: schema.termsVersions.id });
      if (updated.length === 0) return { error: "This draft was published or deleted in the meantime. Reload the page." } as const;
      return { ok: true, id } as const;
    }
    const [created] = await tx
      .insert(schema.termsVersions)
      .values({ doc, status: "draft", version, body, effectiveOn, savedBy: admin.id, savedAt: now })
      .returning({ id: schema.termsVersions.id });
    return { ok: true, id: created.id } as const;
  });
  if ("ok" in result) refresh();
  return result;
}

/** Puts a draft on the website: it becomes the newest published version. */
export async function publishLegalDraft(formData: FormData): Promise<SettingsResult> {
  const admin = await requireArea("/admin/desk");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Save the draft first." };

  const result = await db.transaction(async (tx): Promise<{ error: string } | { ok: true; doc: LegalDoc }> => {
    const [draft] = await tx.select().from(schema.termsVersions).where(eq(schema.termsVersions.id, id)).limit(1);
    if (!draft || draft.status !== "draft") return { error: "This draft was published or deleted in the meantime. Reload the page." };
    await tx.execute(lock(draft.doc));
    const now = new Date();
    const updated = await tx
      .update(schema.termsVersions)
      .set({ status: "published", publishedAt: now, publishedBy: admin.id, effectiveOn: draft.effectiveOn ?? amsterdamToday() })
      .where(and(eq(schema.termsVersions.id, id), eq(schema.termsVersions.status, "draft")))
      .returning({ doc: schema.termsVersions.doc });
    if (updated.length === 0) return { error: "This draft was published or deleted in the meantime. Reload the page." };
    return { ok: true, doc: draft.doc };
  });
  if ("error" in result) return { error: result.error };
  // Expired at once (not stale-while-revalidate): the very next visit shows what was published
  updateTag(legalTag(result.doc));
  refresh();
  return { ok: true };
}

/** Deletes a draft, or a published version no booking agreed to (never the last published one). */
export async function deleteLegalVersion(formData: FormData): Promise<SettingsResult> {
  await requireArea("/admin/desk");
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Unknown version." };

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.termsVersions).where(eq(schema.termsVersions.id, id)).limit(1);
    if (!row) return { ok: true, doc: null } as const;
    await tx.execute(lock(row.doc));
    if (row.status === "published") {
      const [{ n: published }] = await tx
        .select({ n: count() })
        .from(schema.termsVersions)
        .where(and(eq(schema.termsVersions.doc, row.doc), eq(schema.termsVersions.status, "published")));
      if (published <= 1) return { error: `This is the only published ${NAMES[row.doc]}: publish another version before deleting it.` } as const;
      if (row.doc === "terms") {
        const [{ n: bookings }] = await tx.select({ n: count() }).from(schema.quoteRequests).where(eq(schema.quoteRequests.termsVersion, row.version));
        if (bookings > 0) {
          return { error: `${bookings === 1 ? "1 booking was" : `${bookings} bookings were`} made under version ${row.version}, so it is kept as their record.` } as const;
        }
      }
    }
    await tx.delete(schema.termsVersions).where(eq(schema.termsVersions.id, id));
    return { ok: true, doc: row.status === "published" ? row.doc : null } as const;
  });
  if (!("ok" in result)) return result;
  // Deleting the live version puts the one before it back on the website
  if (result.doc) updateTag(legalTag(result.doc));
  refresh();
  return { ok: true };
}

/** Starts a draft from any version (the live one, or an older one to bring back), with the next free version number. */
export async function draftFromVersion(formData: FormData): Promise<SettingsResult> {
  const admin = await requireArea("/admin/desk");
  const id = String(formData.get("id") ?? "").trim();
  const result = await db.transaction(async (tx) => {
    const [source] = await tx.select().from(schema.termsVersions).where(eq(schema.termsVersions.id, id)).limit(1);
    if (!source) return { error: "That version no longer exists. Reload the page." } as const;
    await tx.execute(lock(source.doc));
    const taken = new Set(
      (await tx.select({ version: schema.termsVersions.version }).from(schema.termsVersions).where(eq(schema.termsVersions.doc, source.doc))).map((row) => row.version),
    );
    const [newest] = await tx
      .select({ version: schema.termsVersions.version })
      .from(schema.termsVersions)
      .where(and(eq(schema.termsVersions.doc, source.doc), isNotNull(schema.termsVersions.publishedAt)))
      .orderBy(desc(schema.termsVersions.publishedAt))
      .limit(1);
    const base = Number.parseInt(newest?.version ?? source.version, 10);
    let next = Number.isFinite(base) ? base + 1 : taken.size + 1;
    while (taken.has(String(next))) next += 1;
    await tx.insert(schema.termsVersions).values({ doc: source.doc, status: "draft", version: String(next), body: source.body, savedBy: admin.id });
    return { ok: true } as const;
  });
  if ("ok" in result) refresh();
  return result;
}
