import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";

/**
 * What the team sees of the partner side of a request: who it is linked to, the conversation, the invoices.
 * Every function checks for an admin itself, like the rest of lib/admin. Partner columns are named one by one:
 * the password hash is never selected.
 */
const contact = {
  id: schema.corporateContacts.id,
  name: schema.corporateContacts.name,
  companyName: schema.corporateContacts.companyName,
  email: schema.corporateContacts.email,
};

/**
 * Whom a request may be attached to, given what it already holds. A request with no messages and no invoices can go to
 * anyone. One that has them belongs to the partner whose messages are in it, and may only go back to that same
 * partner: moving it would hand the first partner's conversation and invoices to the second. If it holds history that
 * names nobody (a team reply or an invoice with no partner message), it cannot be attached again at all.
 * Returns null for "anyone", otherwise the partner ids allowed. Callers have already checked for an admin.
 */
export async function attachRestriction(executor: Pick<typeof db, "select">, requestId: string): Promise<string[] | null> {
  const [messages] = await executor
    .select({
      n: count(),
      partners: sql<string[]>`coalesce(array_agg(distinct ${schema.bookingMessages.contactId}) filter (where ${schema.bookingMessages.authorKind} = 'partner' and ${schema.bookingMessages.contactId} is not null), '{}')`,
    })
    .from(schema.bookingMessages)
    .where(eq(schema.bookingMessages.requestId, requestId));
  const [invoices] = await executor.select({ n: count() }).from(schema.bookingInvoices).where(eq(schema.bookingInvoices.requestId, requestId));
  if (messages.n === 0 && invoices.n === 0) return null;
  return messages.partners;
}

export async function getPartnerLink(requestId: string) {
  await requireAdmin();
  const [request] = await db
    .select({ contactId: schema.quoteRequests.corporateContactId, email: schema.quoteRequests.email })
    .from(schema.quoteRequests)
    .where(eq(schema.quoteRequests.id, requestId))
    .limit(1);
  if (!request) return null;

  if (request.contactId) {
    const [linked] = await db.select(contact).from(schema.corporateContacts).where(eq(schema.corporateContacts.id, request.contactId)).limit(1);
    return { linked: linked ?? null, suggestion: null, partners: [], restricted: false };
  }
  // Not linked: offer the partner whose account uses this request's email address, and the others to choose from
  const withAccount = isNotNull(schema.corporateContacts.passwordSetAt);
  const [suggestion] = await db
    .select(contact)
    .from(schema.corporateContacts)
    .where(and(withAccount, eq(schema.corporateContacts.email, request.email.toLowerCase())))
    .limit(1);
  const everyone = await db.select(contact).from(schema.corporateContacts).where(withAccount).orderBy(asc(schema.corporateContacts.name)).limit(500);
  const allowed = await attachRestriction(db, requestId);
  const partners = allowed ? everyone.filter((p) => allowed.includes(p.id)) : everyone;
  return {
    linked: null,
    suggestion: suggestion && partners.some((p) => p.id === suggestion.id) ? suggestion : null,
    partners,
    restricted: allowed !== null,
  };
}

export async function listRequestMessages(requestId: string) {
  await requireAdmin();
  return db
    .select({
      id: schema.bookingMessages.id,
      authorKind: schema.bookingMessages.authorKind,
      kind: schema.bookingMessages.kind,
      body: schema.bookingMessages.body,
      createdAt: schema.bookingMessages.createdAt,
      seen: sql<boolean>`(${schema.bookingMessages.seenByTeamAt} is not null)`,
      by: schema.adminUsers.name,
    })
    .from(schema.bookingMessages)
    .leftJoin(schema.adminUsers, eq(schema.adminUsers.id, schema.bookingMessages.adminId))
    .where(eq(schema.bookingMessages.requestId, requestId))
    .orderBy(desc(schema.bookingMessages.createdAt));
}

export async function listRequestInvoices(requestId: string) {
  await requireAdmin();
  return db
    .select({ id: schema.bookingInvoices.id, fileName: schema.bookingInvoices.fileName, size: schema.bookingInvoices.size, path: schema.bookingInvoices.path, createdAt: schema.bookingInvoices.createdAt })
    .from(schema.bookingInvoices)
    .where(eq(schema.bookingInvoices.requestId, requestId))
    .orderBy(desc(schema.bookingInvoices.createdAt));
}

/** How many partner messages nobody on the team has opened yet, for the requests on one page of the list. */
export async function unseenPartnerMessages(requestIds: string[]) {
  await requireAdmin();
  if (requestIds.length === 0) return new Set<string>();
  const rows = await db
    .selectDistinct({ requestId: schema.bookingMessages.requestId })
    .from(schema.bookingMessages)
    .where(and(inArray(schema.bookingMessages.requestId, requestIds), eq(schema.bookingMessages.authorKind, "partner"), sql`${schema.bookingMessages.seenByTeamAt} is null`));
  return new Set(rows.map((r) => r.requestId));
}
