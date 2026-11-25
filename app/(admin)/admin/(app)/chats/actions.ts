"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

export async function setChatFollowUp(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await db
    .update(schema.conciergeConversations)
    .set({ followUp: formData.get("followUp") === "1" })
    .where(eq(schema.conciergeConversations.id, id));
  revalidatePath("/admin/chats");
  revalidatePath(`/admin/chats/${id}`);
}
