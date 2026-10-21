"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { sqlClient } from "@/lib/db";
import { erasePartnerAccount } from "@/lib/retention";

/**
 * Closes a Corporate Partner account and deletes the details held in it (a partner's request, or the retention rule for
 * idle accounts, which the scheduled job applies itself). Which bookings go and which stay is decided in
 * lib/retention.ts, which also refuses while the partner has an open booking whose trip has not happened. A second click,
 * or a double submit, finds nothing left to delete and does nothing.
 */
export async function deleteCorporateContact(formData: FormData) {
  await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const result = await erasePartnerAccount(sqlClient, id.data);
  // The id and counts only: a log line is not the place for a name or an email address
  if (result && "blocked" in result) console.info(`[admin] partner account ${id.data} not deleted: ${result.blocked} open upcoming booking(s)`);
  else if (result) console.info(`[admin] partner account ${id.data} deleted: ${result.deleted} booking(s) deleted, ${result.kept.length} kept for the financial records`);
  refresh();
}
