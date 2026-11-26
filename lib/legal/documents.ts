import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema } from "@/lib/db";
import { DEFAULT_LEGAL } from "./defaults";

/**
 * The published legal documents, as the website shows them. The team edits them in Settings (drafts, then Publish); the
 * public pages read the newest published version through a cache that Publish and Delete clear (legalTag), so a change
 * is live on the next visit without rebuilding the site. Without a database (a build, an outage) the built-in texts in
 * lib/legal/defaults.ts are shown, which are the ones the database was seeded with.
 */

export const LEGAL_DOCS = ["terms", "privacy"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];

export type PublishedDocument = { version: string; effectiveOn: string; body: string };

export const legalTag = (doc: LegalDoc) => `legal-${doc}`;

/** The live version, read straight from the database: what a booking agrees to at this moment. */
export async function livePublished(doc: LegalDoc): Promise<PublishedDocument | null> {
  const [row] = await db
    .select({
      version: schema.termsVersions.version,
      body: schema.termsVersions.body,
      effectiveOn: schema.termsVersions.effectiveOn,
      publishedAt: schema.termsVersions.publishedAt,
    })
    .from(schema.termsVersions)
    .where(and(eq(schema.termsVersions.doc, doc), eq(schema.termsVersions.status, "published"), isNotNull(schema.termsVersions.publishedAt)))
    .orderBy(desc(schema.termsVersions.publishedAt))
    .limit(1);
  if (!row) return null;
  return {
    version: row.version,
    body: row.body,
    effectiveOn: row.effectiveOn ?? row.publishedAt!.toISOString().slice(0, 10),
  };
}

/** The version the public page shows, cached until the next Publish or Delete. */
export async function publishedDocument(doc: LegalDoc): Promise<PublishedDocument> {
  "use cache";
  cacheTag(legalTag(doc));
  // One cacheLife per run (Next's rule): a long life for what was read, a short one for the fallback so it is retried soon
  let published: PublishedDocument | null;
  try {
    published = await livePublished(doc);
  } catch (error) {
    console.error(`[legal] the published ${doc} could not be read; showing the built-in text`, error);
    cacheLife("minutes");
    return DEFAULT_LEGAL[doc];
  }
  cacheLife("days");
  return published ?? DEFAULT_LEGAL[doc];
}
