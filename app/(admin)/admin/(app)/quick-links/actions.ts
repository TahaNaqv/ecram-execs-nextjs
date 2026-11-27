"use server";

import { refresh, revalidatePath } from "next/cache";
import { QUICK_LINKS_KEY, readQuickLinkDraft } from "@/lib/admin/quick-links";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

/** Saves the whole list (labels and addresses, in order). Owners only. Called from the Save links button. */
export async function saveQuickLinks(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const admin = await requireArea("/admin/quick-links");
  if (admin.role !== "owner") return { error: "Only an owner can change the quick links." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(String(formData.get("links") ?? ""));
  } catch {
    return { error: "The list could not be read. Reload the page." };
  }
  const draft = readQuickLinkDraft(parsed);
  if ("error" in draft) return draft;

  const now = new Date();
  await db
    .insert(schema.appSettings)
    .values({ key: QUICK_LINKS_KEY, value: draft.links, updatedBy: admin.id, updatedAt: now })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: draft.links, updatedBy: admin.id, updatedAt: now } });
  revalidatePath("/admin/quick-links");
  revalidatePath("/admin");
  refresh();
  return { ok: true };
}
