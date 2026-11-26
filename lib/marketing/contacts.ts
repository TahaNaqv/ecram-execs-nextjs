import "server-only";
import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { MarketingContact } from "@/lib/db/schema";
import { deleteMember, mailchimpConnected, pushMember } from "./mailchimp";

/**
 * The newsletter list (schema.marketingContacts). Consent is recorded where it is given — the booking form's tick
 * (lib/quotes/create.ts) and a corporate partner's verified sign-up (lib/corporate/account-actions.ts) — or by the team for
 * someone who asked them. Withdrawal: Mailchimp's own unsubscribe link (its webhook), or an email to the team, who mark the
 * contact unsubscribed or, when they ask to be removed, suppressed (kept only so they are never added again).
 */

const m = schema.marketingContacts;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const cleanEmail = (raw: string) => {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
};

/** Records consent: a new contact, or one that had unsubscribed and agreed again. A suppressed contact stays suppressed. */
export async function recordOptIn(input: { email: string; name?: string | null; source: MarketingContact["source"]; sourceRef?: string | null; at?: Date }): Promise<void> {
  const email = cleanEmail(input.email);
  if (!email) return;
  const at = input.at ?? new Date();
  const name = input.name?.trim() || null;
  const [row] = await db
    .insert(m)
    .values({ email, name, source: input.source, sourceRef: input.sourceRef ?? null, status: "subscribed", consentedAt: at, syncPending: true })
    .onConflictDoUpdate({
      target: m.email,
      set: {
        status: sql`case when ${m.status} = 'suppressed' then ${m.status} else 'subscribed' end`,
        consentedAt: sql`case when ${m.status} = 'suppressed' then ${m.consentedAt} else ${at} end`,
        unsubscribedAt: sql`case when ${m.status} = 'suppressed' then ${m.unsubscribedAt} else null end`,
        name: sql`coalesce(${m.name}, ${name})`,
        syncPending: sql`case when ${m.status} = 'suppressed' then ${m.syncPending} else true end`,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (row) await syncContact(row);
}

/** The team (or Mailchimp's webhook) changes a contact's state. */
export async function setContactStatus(
  id: string,
  status: "subscribed" | "unsubscribed" | "suppressed",
  opts: { fromMailchimp?: boolean } = {},
): Promise<MarketingContact | null> {
  const [row] = await db
    .update(m)
    .set({
      status,
      unsubscribedAt: status === "subscribed" ? null : new Date(),
      ...(status === "subscribed" ? { consentedAt: new Date() } : {}),
      syncPending: !opts.fromMailchimp,
      ...(opts.fromMailchimp ? { syncedAt: new Date(), syncError: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(m.id, id))
    .returning();
  if (row && !opts.fromMailchimp) await syncContact(row);
  return row ?? null;
}

/** Erases a contact from the list and from Mailchimp: someone who asked for their data to be deleted entirely. */
export async function deleteContact(id: string): Promise<{ ok: true } | { error: string }> {
  const [row] = await db.select().from(m).where(eq(m.id, id)).limit(1);
  if (!row) return { ok: true };
  if (mailchimpConnected()) {
    try {
      await deleteMember(row.email);
    } catch (err) {
      return { error: `Mailchimp did not delete it (${err instanceof Error ? err.message : "error"}). Nothing was deleted; try again.` };
    }
  }
  await db.delete(m).where(eq(m.id, id));
  return { ok: true };
}

/** Sends one contact to Mailchimp when it is connected. A failure is kept on the row and tried again by "Sync now". */
export async function syncContact(row: MarketingContact): Promise<boolean> {
  if (!mailchimpConnected()) return false;
  try {
    await pushMember(row);
    // Only when nothing changed meanwhile; a later change stays pending
    await db.update(m).set({ syncPending: false, syncedAt: new Date(), syncError: null }).where(and(eq(m.id, row.id), eq(m.updatedAt, row.updatedAt)));
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    console.error(`[mailchimp] ${row.id} not synced:`, message);
    await db.update(m).set({ syncError: message.slice(0, 300) }).where(eq(m.id, row.id));
    return false;
  }
}

/** Every change Mailchimp has not had yet, oldest first. */
export async function syncPending(limit = 200): Promise<{ synced: number; failed: number }> {
  if (!mailchimpConnected()) return { synced: 0, failed: 0 };
  const rows = await db.select().from(m).where(eq(m.syncPending, true)).orderBy(asc(m.updatedAt)).limit(limit);
  let synced = 0;
  for (const row of rows) if (await syncContact(row)) synced += 1;
  return { synced, failed: rows.length - synced };
}

export async function listContacts(filter: { status?: MarketingContact["status"]; q?: string }, limit = 500): Promise<MarketingContact[]> {
  const needle = filter.q?.trim().replace(/[%_\\]/g, "");
  return db
    .select()
    .from(m)
    .where(
      and(
        filter.status ? eq(m.status, filter.status) : undefined,
        needle ? or(ilike(m.email, `%${needle}%`), ilike(m.name, `%${needle}%`)) : undefined,
      ),
    )
    .orderBy(desc(m.updatedAt))
    .limit(limit);
}

export async function contactCounts(): Promise<Record<MarketingContact["status"], number> & { pending: number }> {
  const rows = await db.select({ status: m.status, n: count() }).from(m).groupBy(m.status);
  const [{ pending }] = await db.select({ pending: count() }).from(m).where(eq(m.syncPending, true));
  const by = Object.fromEntries(rows.map((row) => [row.status, row.n])) as Partial<Record<MarketingContact["status"], number>>;
  return { subscribed: by.subscribed ?? 0, unsubscribed: by.unsubscribed ?? 0, suppressed: by.suppressed ?? 0, pending };
}

/** A spreadsheet cell that cannot run as a formula (the values come from public forms). */
function cell(value: string | null | undefined) {
  let s = value ?? "";
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The subscribed contacts as CSV, for a manual import into another tool. */
export async function subscribedCsv(): Promise<string> {
  const rows = await db.select().from(m).where(eq(m.status, "subscribed")).orderBy(asc(m.email));
  const lines = [["email", "name", "source", "source_ref", "consented_at"].join(",")];
  for (const row of rows) lines.push([row.email, row.name, row.source, row.sourceRef, row.consentedAt?.toISOString() ?? ""].map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
