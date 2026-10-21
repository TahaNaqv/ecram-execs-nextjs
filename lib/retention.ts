import type { Sql, TransactionSql } from "postgres";

/**
 * How long personal data is kept, and the code that removes it. The periods are the ones the privacy policy promises
 * (privacy.s5p1 and s8p* in the dictionaries): change one here and the policy text has to change with it.
 *
 * Takes a postgres.js client rather than the app's Drizzle `db`, so the same code runs in the admin panel (the Delete
 * button), in `scripts/retention.mts` (the scheduled job) and in the tests, none of which can share the app's server-only
 * database module. It changes rows only; the files that belonged to deleted rows are removed by the caller-supplied
 * function, after the rows are gone (a file left behind is an orphan, which scripts/sweep-documents.mts clears; a row
 * whose file is gone would be a broken download).
 */
export const RETENTION = {
  /** Quotation, bespoke and booking requests: months after the last contact. */
  requestMonths: 24,
  /**
   * What forms part of the financial records (see isFinancial): kept for this many years after the end of the calendar
   * year of the last contact, which is how long Dutch tax law counts (art. 52 AWR). From requestMonths on, the notes,
   * messages and technical data are removed from it and only what substantiates the invoice stays.
   */
  financialYears: 7,
  /** Driver applications that did not lead to a partnership, with their documents. */
  applicationMonths: 12,
  /** A Corporate Partner account nobody has signed in to, or touched a booking of, for this long. */
  accountInactiveMonths: 24,
  /** Someone who started creating an account and never finished. */
  abandonedSignupDays: 30,
  /** The most rows one rule removes in one run: a wrong rule or a bad clock then loses a few hundred rows, not the table. */
  maxPerRule: 200,
} as const;

type Db = Sql | TransactionSql;
export type RemoveFiles = (paths: string[]) => Promise<void>;

// Pick-ups are Dutch wall-clock time (a timestamp without a zone), so "now" for comparing with them is Dutch too.
const nlNow = (sql: Db) => sql`(now() at time zone 'Europe/Amsterdam')`;

/**
 * Part of the financial records: a completed booking, one with an invoice, or a confirmed one whose trip has passed (it was
 * driven and billed even if nobody marked it completed). Keeping too much is the safe error: a tax record is not recreated.
 * SQL for a quote_requests row aliased `r`.
 */
const isFinancial = (sql: Db) => sql`(
  r.status = 'completed'
  or exists (select 1 from booking_invoices i where i.request_id = r.id)
  or (r.status = 'confirmed' and r.pickup_at is not null and r.pickup_at < ${nlNow(sql)})
)`;

/** The last time anyone touched a booking: the row, its messages, its history or its invoices. NULLs from empty subqueries are ignored by greatest(). */
const lastContact = (sql: Db) => sql`greatest(
  r.updated_at,
  r.created_at,
  (select max(m.created_at) from booking_messages m where m.request_id = r.id),
  (select max(e.created_at) from request_events e where e.request_id = r.id),
  (select max(i.created_at) from booking_invoices i where i.request_id = r.id)
)`;

/** A trip that has not happened yet is never removed, whatever the age of its row (bespoke requests have no pick-up). */
const notUpcoming = (sql: Db) => sql`(r.pickup_at is null or r.pickup_at < ${nlNow(sql)} - interval '1 day')`;

/** A booking that is still open and not yet driven: an account holding one cannot be erased until it is cancelled or completed. */
const isUpcoming = (sql: Db) => sql`(r.status in ('new', 'contacted', 'quoted', 'confirmed') and r.pickup_at is not null and r.pickup_at >= ${nlNow(sql)})`;

/** Requests past their retention, as a WHERE fragment over `quote_requests r`. */
const requestDue = (sql: Db) => sql`
  ${notUpcoming(sql)}
  and (
    (not ${isFinancial(sql)} and ${lastContact(sql)} < now() - make_interval(months => ${RETENTION.requestMonths}))
    or (${isFinancial(sql)} and date_trunc('year', ${lastContact(sql)}) + make_interval(years => ${RETENTION.financialYears + 1}) <= now())
  )`;

/** A booking kept for the financial records that is old enough to be stripped of notes, messages and technical data. */
const financialToScrub = (sql: Db) => sql`
  ${isFinancial(sql)}
  and ${lastContact(sql)} < now() - make_interval(months => ${RETENTION.requestMonths})
  and (
    r.notes is not null or r.internal_notes is not null or r.ip_hash is not null or r.user_agent is not null
    or exists (select 1 from booking_messages m where m.request_id = r.id)
  )`;

/** Driver applications that did not become a partnership, past their retention, over `driver_applications a`. */
const applicationDue = (sql: Db) => sql`
  a.status <> 'approved'
  and greatest(a.updated_at, a.created_at, a.reviewed_at) < now() - make_interval(months => ${RETENTION.applicationMonths})`;

/** Partner accounts nobody has used or touched a booking of, over `corporate_contacts c`. */
const accountInactive = (sql: Db) => sql`
  c.password_hash is not null
  and greatest(c.last_login_at, c.last_access_at, c.password_set_at, c.created_at) < now() - make_interval(months => ${RETENTION.accountInactiveMonths})
  and not exists (
    select 1 from quote_requests r
    where r.corporate_contact_id = c.id and ${lastContact(sql)} >= now() - make_interval(months => ${RETENTION.accountInactiveMonths})
  )`;

/** Sign-ups that were never finished, over `corporate_contacts c`. A contact with consent or a booking is a real one. */
const signupAbandoned = (sql: Db) => sql`
  c.password_hash is null
  and c.marketing_consent = false
  and greatest(c.created_at, c.updated_at, c.verified_at, c.last_access_at) < now() - make_interval(days => ${RETENTION.abandonedSignupDays})
  and not exists (select 1 from quote_requests r where r.corporate_contact_id = c.id)
  and not exists (select 1 from corporate_challenges ch where ch.contact_id = c.id and ch.expires_at > now())`;

export type ErasureResult = {
  /** Bookings that were not part of the financial records, deleted with the account. */
  deleted: number;
  /** References of the bookings that stay (financial records), now unlinked from the account and stripped. */
  kept: string[];
};
/** The account holds bookings that are still open and not yet driven: nothing was changed. */
export type ErasureBlocked = { blocked: number };

/**
 * Closes a Corporate Partner account and deletes the details held in it, the account itself, its sessions and the
 * consent to email. The partner's bookings that are not part of the financial records are deleted (their history,
 * messages and anything else on them go with them). A booking that is part of them has to be kept (seven years), but only
 * as far as it substantiates the invoice: it stays, unlinked from the account, without the messages, notes and technical
 * data, and with the contact person's name, email and phone replaced; the company (name and KvK number), route, pick-up,
 * amount and invoices remain. A note in its history says why.
 *
 * Refused (`blocked`) while the account holds an open booking whose trip has not happened: cancel or complete it first.
 * With `onlyIfInactive` (the scheduled job) the account is looked at again once locked, and left alone if its owner has
 * signed in since it was picked. Returns null when there is nothing to erase.
 */
export async function erasePartnerAccount(sql: Sql, contactId: string, options: { onlyIfInactive?: boolean } = {}): Promise<ErasureResult | ErasureBlocked | null> {
  return sql.begin(async (tx) => {
    const [locked] = await tx<{ id: string }[]>`
      select c.id from corporate_contacts c
      where c.id = ${contactId} ${options.onlyIfInactive ? tx`and ${accountInactive(tx)}` : tx``}
      for update of c`;
    if (!locked) return null;

    const bookings = await tx<{ id: string; reference: string; financial: boolean; upcoming: boolean }[]>`
      select r.id, r.reference, ${isFinancial(tx)} as financial, ${isUpcoming(tx)} as upcoming from quote_requests r where r.corporate_contact_id = ${contactId}`;
    const upcoming = bookings.filter((b) => b.upcoming).length;
    if (upcoming > 0) return { blocked: upcoming };

    const gone = bookings.filter((b) => !b.financial).map((b) => b.id);
    const kept = bookings.filter((b) => b.financial);

    if (gone.length > 0) await tx`delete from quote_requests where id in ${tx(gone)}`;
    if (kept.length > 0) {
      const ids = kept.map((b) => b.id);
      await tx`delete from booking_messages where request_id in ${tx(ids)}`;
      // Only what the invoice needs stays. (The contact person is a natural person; the invoice is to the company.)
      await tx`
        update quote_requests set
          corporate_contact_id = null, notes = null, internal_notes = null, ip_hash = null, user_agent = null,
          name = coalesce(entity, 'Erased partner'), email = 'erased@invalid', phone = ''
        where id in ${tx(ids)}`;
      await tx`insert into request_events (request_id, event) select id, 'partner_erased' from quote_requests where id in ${tx(ids)}`;
    }
    await tx`delete from corporate_contacts where id = ${contactId}`;
    return { deleted: gone.length, kept: kept.map((b) => b.reference) };
  }) as Promise<ErasureResult | ErasureBlocked | null>;
}

/** For the confirmation before an account is deleted: each account's bookings by what would happen to them. */
export async function bookingCountsByContact(sql: Sql): Promise<Map<string, { deleted: number; kept: number; upcoming: number }>> {
  const rows = await sql<{ id: string; deleted: string; kept: string; upcoming: string }[]>`
    select r.corporate_contact_id as id,
           count(*) filter (where not ${isFinancial(sql)}) as deleted,
           count(*) filter (where ${isFinancial(sql)}) as kept,
           count(*) filter (where ${isUpcoming(sql)}) as upcoming
    from quote_requests r where r.corporate_contact_id is not null group by r.corporate_contact_id`;
  return new Map(rows.map((r) => [r.id, { deleted: Number(r.deleted), kept: Number(r.kept), upcoming: Number(r.upcoming) }]));
}

export type RetentionReport = {
  /** References of the requests deleted (or that would be). */
  requests: string[];
  /** References of bookings kept for the financial records that were stripped of notes, messages and technical data. */
  scrubbed: string[];
  applications: string[];
  /** Ids of partner accounts erased: not names or emails, so a log of the job holds no personal data. */
  accounts: string[];
  /** Ids of abandoned sign-ups removed. */
  signups: string[];
  /** Ids of accounts the job would not erase because they hold an open upcoming booking. */
  blocked: string[];
  /** True when a rule stopped at its cap: run again to continue. */
  capped: boolean;
};

/**
 * Removes what is past its retention. Without `apply` it only reports. Each rule takes at most RETENTION.maxPerRule rows
 * per run, and every delete repeats its rule in the same statement, so a row that stopped qualifying between the look and
 * the delete (a partner who signed in, a booking someone just updated) is left alone.
 */
export async function runRetention({ sql, apply, removeFiles }: { sql: Sql; apply: boolean; removeFiles: RemoveFiles }): Promise<RetentionReport> {
  const cap = RETENTION.maxPerRule;
  const report: RetentionReport = { requests: [], scrubbed: [], applications: [], accounts: [], signups: [], blocked: [], capped: false };

  // 1. Requests past their period
  const requests = await sql<{ id: string; reference: string }[]>`select r.id, r.reference from quote_requests r where ${requestDue(sql)} order by r.created_at limit ${cap + 1}`;
  if (requests.length > cap) report.capped = true;
  for (const { id, reference } of requests.slice(0, cap)) {
    if (!apply) {
      report.requests.push(reference);
      continue;
    }
    const files = await sql.begin(async (tx) => {
      const invoices = await tx<{ path: string }[]>`select path from booking_invoices where request_id = ${id}`;
      const [removed] = await tx<{ id: string }[]>`delete from quote_requests r where r.id = ${id} and ${requestDue(tx)} returning r.id`;
      return removed ? invoices.map((i) => i.path) : null;
    });
    if (files === null) continue;
    report.requests.push(reference);
    await removeFiles(files);
  }

  // 2. Bookings kept for the financial records: strip what the invoice does not need once the ordinary period has passed
  const toScrub = await sql<{ id: string; reference: string }[]>`select r.id, r.reference from quote_requests r where ${financialToScrub(sql)} order by r.created_at limit ${cap + 1}`;
  if (toScrub.length > cap) report.capped = true;
  for (const { id, reference } of toScrub.slice(0, cap)) {
    if (!apply) {
      report.scrubbed.push(reference);
      continue;
    }
    const done = await sql.begin(async (tx) => {
      const [row] = await tx<{ id: string }[]>`select r.id from quote_requests r where r.id = ${id} and ${financialToScrub(tx)} for update of r`;
      if (!row) return false;
      await tx`delete from booking_messages where request_id = ${id}`;
      await tx`update quote_requests set notes = null, internal_notes = null, ip_hash = null, user_agent = null where id = ${id}`;
      return true;
    });
    if (done) report.scrubbed.push(reference);
  }

  // 3. Driver applications
  const applications = await sql<{ id: string; reference: string }[]>`select a.id, a.reference from driver_applications a where ${applicationDue(sql)} order by a.created_at limit ${cap + 1}`;
  if (applications.length > cap) report.capped = true;
  for (const { id, reference } of applications.slice(0, cap)) {
    if (!apply) {
      report.applications.push(reference);
      continue;
    }
    const [removed] = await sql<{ documents: { path: string }[] | null }[]>`delete from driver_applications a where a.id = ${id} and ${applicationDue(sql)} returning a.documents`;
    if (!removed) continue;
    report.applications.push(reference);
    await removeFiles(removed.documents?.map((d) => d.path) ?? []);
  }

  // 4. Partner accounts nobody uses
  const accounts = await sql<{ id: string }[]>`select c.id from corporate_contacts c where ${accountInactive(sql)} order by c.created_at limit ${cap + 1}`;
  if (accounts.length > cap) report.capped = true;
  for (const { id } of accounts.slice(0, cap)) {
    if (!apply) {
      report.accounts.push(id);
      continue;
    }
    const result = await erasePartnerAccount(sql, id, { onlyIfInactive: true });
    if (result && "blocked" in result) report.blocked.push(id);
    else if (result) report.accounts.push(id);
  }

  // 5. Sign-ups that were never finished
  const signups = await sql<{ id: string }[]>`select c.id from corporate_contacts c where ${signupAbandoned(sql)} order by c.created_at limit ${cap + 1}`;
  if (signups.length > cap) report.capped = true;
  for (const { id } of signups.slice(0, cap)) {
    if (!apply) {
      report.signups.push(id);
      continue;
    }
    const removed = await sql`delete from corporate_contacts c where c.id = ${id} and ${signupAbandoned(sql)} returning c.id`;
    if (removed.length > 0) report.signups.push(id);
  }

  return report;
}
