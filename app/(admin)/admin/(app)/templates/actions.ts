"use server";

import { refresh } from "next/cache";
import { can } from "@/lib/admin/access";
import { isTemplateKey, saveTemplate } from "@/lib/admin/templates";
import { requireAdmin } from "@/lib/auth/session";

export type TemplateState = { ok?: boolean; error?: boolean };

export async function saveEmailTemplate(_prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const admin = await requireAdmin();
  if (!can(admin.role, admin.permissions, "templates")) return { error: true };
  const key = String(formData.get("key") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!isTemplateKey(key) || !subject || !body) return { error: true };
  await saveTemplate(key, subject.slice(0, 200), body.slice(0, 2000), admin.id);
  refresh();
  return { ok: true };
}
