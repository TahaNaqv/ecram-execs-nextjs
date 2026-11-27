import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Outside tools the operations desk opens: the Quick Links tab (/admin/quick-links) and the dashboard's To do card.
 * Owners edit the list on that tab; it is stored in app_settings "quick_links". Until it is first edited, these are shown.
 */
export type QuickLink = { label: string; href: string };

export const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { label: "E-Flux Dashboard", href: "https://dashboard.e-flux.io/" },
  { label: "Rabobank Business", href: "https://banking.rabobank.com/welcome" },
  { label: "Moneybird", href: "https://moneybird.com/login/" },
  { label: "Mollie", href: "https://www.mollie.com/nl/" },
];

export const QUICK_LINKS_KEY = "quick_links";
export const MAX_QUICK_LINKS = 30;

/**
 * The draft the editor submits, in order. Blank rows are dropped. A half-filled row is an error, so a save never
 * stores a link with no name or no address.
 */
export function readQuickLinkDraft(raw: unknown): { links: QuickLink[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length > 100) return { error: "The list could not be read. Reload the page." };
  const links: QuickLink[] = [];
  for (const [i, item] of raw.entries()) {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const hrefText = typeof record.href === "string" ? record.href : "";
    if (!label && !hrefText.trim()) continue;
    if (links.length >= MAX_QUICK_LINKS) return { error: `At most ${MAX_QUICK_LINKS} links.` };
    if (!label || label.length > 60) return { error: `Link ${i + 1}: give it a name of at most 60 characters.` };
    const href = cleanHref(hrefText);
    if (!href) return { error: `${label}: enter a web address (https://…).` };
    links.push({ label, href });
  }
  return { links };
}

/** An https address, or null. Only web addresses are kept, so a link can never run script. */
export function cleanHref(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > 500) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function quickLinks(): Promise<QuickLink[]> {
  try {
    const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, QUICK_LINKS_KEY)).limit(1);
    if (!row || !Array.isArray(row.value)) return DEFAULT_QUICK_LINKS;
    return (row.value as unknown[])
      .map((item) => (item && typeof item === "object" ? (item as Record<string, unknown>) : {}))
      .filter((item): item is QuickLink => typeof item.label === "string" && typeof item.href === "string" && cleanHref(item.href) !== null)
      .slice(0, MAX_QUICK_LINKS);
  } catch (error) {
    console.error("[quick-links] could not be read", error);
    return DEFAULT_QUICK_LINKS;
  }
}
