"use server";

import { refresh } from "next/cache";
import { cleanHref, MAX_QUICK_LINKS, QUICK_LINKS_KEY, type QuickLink } from "@/lib/admin/quick-links";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

/** Saves the whole list (labels and addresses, in order). Owners only. */
export async function saveQuickLinks(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const admin = await requireArea("/admin/quick-links");
  if (admin.role !== "owner") return { error: "Only an owner can change the quick links." };
  const labels = formData.getAll("label").map((value) => String(value).trim());
  const hrefs = formData.getAll("href").map((value) => String(value));
  if (labels.length !== hrefs.length) return { error: "The list could not be read. Reload the page." };
  if (labels.length > MAX_QUICK_LINKS) return { error: `At most ${MAX_QUICK_LINKS} links.` };

  const links: QuickLink[] = [];
  for (const [i, label] of labels.entries()) {
    if (!label && !hrefs[i].trim()) continue;
    if (!label || label.length > 60) return { error: `Link ${i + 1}: give it a name of at most 60 characters.` };
    const href = cleanHref(hrefs[i]);
    if (!href) return { error: `${label}: enter a web address (https://…).` };
    links.push({ label, href });
  }
  const now = new Date();
  await db
    .insert(schema.appSettings)
    .values({ key: QUICK_LINKS_KEY, value: links, updatedBy: admin.id, updatedAt: now })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: links, updatedBy: admin.id, updatedAt: now } });
  refresh();
  return { ok: true };
}
