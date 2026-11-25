"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { can } from "@/lib/admin/access";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export async function saveSecurityNotes(formData: FormData) {
  const admin = await requireAdmin();
  if (!can(admin.role, admin.permissions, "approve")) return;
  const id = String(formData.get("id") ?? "");
  await db
    .update(schema.quoteRequests)
    .set({
      closeProtection: formData.get("closeProtection") === "on",
      securityNotes: String(formData.get("securityNotes") ?? "").trim() || null,
    })
    .where(eq(schema.quoteRequests.id, id));
  refresh();
}
