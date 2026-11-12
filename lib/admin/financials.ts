import "server-only";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { bookingEuros } from "@/lib/admin/queries";
import {
  CORPORATE_TERM_DAYS,
  FINANCIAL_PAGE_SIZE,
  monthWindow,
  resolveRange,
  yearWindow,
  type FinancialQuery,
  type FinancialSummary,
  type PaymentStatus,
  type PresentedFinancialRow,
} from "@/lib/admin/financials-shared";
import { grossEuros, vatOf } from "@/lib/admin/financials-vat";
import { formatPickup, formatTimestamp } from "@/lib/admin/format";
import { requireAdmin } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import type { Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatCurrency } from "@/lib/pricing/rates";
import { isCorporateBooking } from "@/lib/quotes/audience";
import { REQUEST_STATUSES, type RequestStatus } from "@/lib/quotes/constants";

const q = schema.quoteRequests;
const contacts = schema.corporateContacts;
const invoices = schema.bookingInvoices;

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["paid", "pending", "overdue", "refunded", "failed"];

/**
 * How a booking is settled. There is no payments table: Mollie is not written onto the booking.
 *
 * - A public booking is paid when it is reserved (confirmed or completed).
 * - A corporate booking is paid once the team marks it completed. Until then it is pending, and
 *   overdue when the ride was more than {@link CORPORATE_TERM_DAYS} days ago and it is still only confirmed.
 * - A booking cancelled after it had been confirmed or completed is refunded, and left out of revenue.
 * - `failed` is reserved for a charge the processor refused. Nothing in the database records that yet.
 *
 * The date is the pick-up (Amsterdam wall time), or the moment the booking was created when it has none.
 */
function activityAt() {
  return sql`coalesce(${q.pickupAt}::timestamp, (${q.createdAt} at time zone 'Europe/Amsterdam'))`;
}

function isCorporateSql() {
  return sql`(
    ${q.corporateContactId} is not null
    or ${q.source} in ('portal', 'website-corporate')
    or coalesce(${q.priceEstimate}->>'segment', '') = 'corporate'
  )`;
}

function wasConfirmedThenCancelled() {
  return sql`exists (
    select 1
    from ${schema.requestEvents}
    where ${schema.requestEvents.requestId} = ${q.id}
      and ${schema.requestEvents.event} = 'changes'
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(${schema.requestEvents.params}->'changes') = 'array' then ${schema.requestEvents.params}->'changes'
            else '[]'::jsonb
          end
        ) ch
        where ch->>'kind' = 'status'
          and ch->>'to' = 'cancelled'
          and ch->>'from' in ('confirmed', 'completed')
      )
  )`;
}

function settlementSql() {
  return sql`case
    when ${q.status} = 'cancelled' and ${wasConfirmedThenCancelled()} then 'refunded'
    when not ${isCorporateSql()} and ${q.status} in ('confirmed', 'completed') then 'paid'
    when ${isCorporateSql()} and ${q.status} = 'completed' then 'paid'
    when ${isCorporateSql()} and ${q.status} = 'confirmed'
      and ${activityAt()} + interval '${sql.raw(String(CORPORATE_TERM_DAYS))} days' < (now() at time zone 'Europe/Amsterdam') then 'overdue'
    when ${q.status} in ('confirmed', 'completed') then 'pending'
    else 'excluded'
  end`;
}

function inLedger() {
  return sql`(
    ${bookingEuros()} > 0
    and (
      ${q.status} in ('confirmed', 'completed')
      or (${q.status} = 'cancelled' and ${wasConfirmedThenCancelled()})
    )
  )`;
}

function inWindow(from: string, to: string) {
  return sql`${activityAt()} >= ${from}::timestamp and ${activityAt()} < ${to}::timestamp`;
}

function searchTerm(value: string) {
  return `%${value.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

function conditions(query: FinancialQuery, opts: { status: boolean; search: boolean }): SQL[] {
  const window = resolveRange(query);
  const where: SQL[] = [inLedger(), inWindow(window.from, window.to)];
  if (opts.status && query.status !== "all") where.push(sql`${settlementSql()} = ${query.status}`);
  if (opts.search && query.q) {
    const term = searchTerm(query.q);
    where.push(
      or(
        ilike(q.reference, term),
        ilike(q.name, term),
        ilike(q.email, term),
        ilike(q.entity, term),
        ilike(contacts.companyName, term),
        ilike(contacts.name, term),
        sql`exists (
          select 1 from ${invoices}
          where ${invoices.requestId} = ${q.id}
            and ${invoices.fileName} ilike ${term}
        )`,
      )!,
    );
  }
  return where;
}

function asStatus(value: string): PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value) ? (value as PaymentStatus) : "pending";
}

function asBookingStatus(value: string): RequestStatus {
  return (REQUEST_STATUSES as readonly string[]).includes(value) ? (value as RequestStatus) : "confirmed";
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function getFinancialSummary(query: FinancialQuery): Promise<FinancialSummary> {
  await requireAdmin();
  const period = resolveRange(query);
  const month = monthWindow();
  const year = yearWindow();
  // Settlement is worked out once per booking, then every card reads that row.
  const ledger = db
    .select({
      euros: bookingEuros().as("euros"),
      status: sql<string>`${q.status}`.as("status"),
      activity: activityAt().as("activity"),
      corporate: isCorporateSql().as("corporate"),
      settlement: settlementSql().as("settlement"),
    })
    .from(q)
    .as("ledger");
  const during = (from: string, to: string) =>
    sql`${ledger.activity} >= ${from}::timestamp and ${ledger.activity} < ${to}::timestamp`;
  const recognised = sql`${ledger.euros} > 0 and ${ledger.status} in ('confirmed', 'completed')`;
  const [row] = await db
    .select({
      periodRevenue: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${recognised} and ${during(period.from, period.to)}), 2), 0)`,
      monthRevenue: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${recognised} and ${during(month.from, month.to)}), 2), 0)`,
      ytdRevenue: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${recognised} and ${during(year.from, year.to)}), 2), 0)`,
      paid: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'paid' and ${during(period.from, period.to)}), 2), 0)`,
      paidCount: sql<number>`count(*) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'paid' and ${during(period.from, period.to)})`.mapWith(Number),
      pending: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'pending' and ${during(period.from, period.to)}), 2), 0)`,
      pendingCount: sql<number>`count(*) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'pending' and ${during(period.from, period.to)})`.mapWith(Number),
      overdue: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'overdue' and ${during(period.from, period.to)}), 2), 0)`,
      overdueCount: sql<number>`count(*) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'overdue' and ${during(period.from, period.to)})`.mapWith(Number),
      refunded: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'refunded' and ${during(period.from, period.to)}), 2), 0)`,
      refundedCount: sql<number>`count(*) filter (where ${ledger.euros} > 0 and ${ledger.settlement} = 'refunded' and ${during(period.from, period.to)})`.mapWith(Number),
      abv: sql<string | null>`round(avg(${ledger.euros}) filter (where ${ledger.euros} > 0 and ${ledger.status} = 'completed' and ${during(period.from, period.to)}), 2)`,
      completedCount: sql<number>`count(*) filter (where ${ledger.euros} > 0 and ${ledger.status} = 'completed' and ${during(period.from, period.to)})`.mapWith(Number),
      corporateRevenue: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${recognised} and ${ledger.corporate} and ${during(period.from, period.to)}), 2), 0)`,
      publicRevenue: sql<string>`coalesce(round(sum(${ledger.euros}) filter (where ${recognised} and not ${ledger.corporate} and ${during(period.from, period.to)}), 2), 0)`,
    })
    .from(ledger);

  return {
    periodRevenue: num(row?.periodRevenue),
    monthRevenue: num(row?.monthRevenue),
    ytdRevenue: num(row?.ytdRevenue),
    paid: num(row?.paid),
    paidCount: num(row?.paidCount),
    pending: num(row?.pending),
    pendingCount: num(row?.pendingCount),
    overdue: num(row?.overdue),
    overdueCount: num(row?.overdueCount),
    refunded: num(row?.refunded),
    refundedCount: num(row?.refundedCount),
    abv: row?.abv == null ? null : num(row.abv),
    completedCount: num(row?.completedCount),
    corporateRevenue: num(row?.corporateRevenue),
    publicRevenue: num(row?.publicRevenue),
  };
}

type LedgerRow = {
  id: string;
  reference: string;
  service: string;
  name: string;
  entity: string | null;
  itinerary: string | null;
  collection: string | null;
  destination: string | null;
  destinations: string[] | null;
  durationHours: number | null;
  pickupAt: string | null;
  createdAt: Date;
  quotedAmount: string | null;
  priceEstimate: unknown;
  corporateContactId: string | null;
  source: string;
  companyName: string | null;
  bookingStatus: string;
  settlement: string;
};

function sortExpr(query: FinancialQuery): SQL {
  if (query.sort === "amount") return bookingEuros();
  if (query.sort === "reference") return sql`${q.reference}`;
  if (query.sort === "client") {
    return sql`case when ${isCorporateSql()} then coalesce(${contacts.companyName}, ${q.entity}, ${q.name}) else ${q.name} end`;
  }
  if (query.sort === "status") return settlementSql();
  return activityAt();
}

async function selectLedger(query: FinancialQuery, limit: number, offset: number): Promise<{ rows: LedgerRow[]; total: number }> {
  const where = and(...conditions(query, { status: true, search: true }));
  const order = query.dir === "asc" ? asc(sortExpr(query)) : desc(sortExpr(query));
  const [rows, [counted]] = await Promise.all([
    db
      .select({
        id: q.id,
        reference: q.reference,
        service: q.service,
        name: q.name,
        entity: q.entity,
        itinerary: q.itinerary,
        collection: q.collection,
        destination: q.destination,
        destinations: q.destinations,
        durationHours: q.durationHours,
        pickupAt: q.pickupAt,
        createdAt: q.createdAt,
        quotedAmount: q.quotedAmount,
        priceEstimate: q.priceEstimate,
        corporateContactId: q.corporateContactId,
        source: q.source,
        companyName: contacts.companyName,
        bookingStatus: q.status,
        settlement: sql<string>`${settlementSql()}`,
      })
      .from(q)
      .leftJoin(contacts, eq(contacts.id, q.corporateContactId))
      .where(where)
      .orderBy(order, asc(q.reference))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int`.mapWith(Number) })
      .from(q)
      .leftJoin(contacts, eq(contacts.id, q.corporateContactId))
      .where(where),
  ]);
  return { rows: rows as LedgerRow[], total: num(counted?.total) };
}

async function attachInvoices(rows: LedgerRow[]): Promise<Map<string, { id: string; fileName: string; count: number }>> {
  const map = new Map<string, { id: string; fileName: string; count: number }>();
  if (rows.length === 0) return map;
  const found = await db
    .select({ requestId: invoices.requestId, id: invoices.id, fileName: invoices.fileName })
    .from(invoices)
    .where(inArray(invoices.requestId, rows.map((row) => row.id)))
    .orderBy(desc(invoices.createdAt));
  for (const invoice of found) {
    const existing = map.get(invoice.requestId);
    if (!existing) map.set(invoice.requestId, { id: invoice.id, fileName: invoice.fileName, count: 1 });
    else existing.count += 1;
  }
  return map;
}

export type PresentLabels = {
  services: Record<string, string>;
  /** "{hours}" — how an hourly booking with no destination is described. */
  hourly: string;
};

function routeOf(row: LedgerRow, hourly: string): string {
  if (row.service === "bespoke") {
    const text = [row.entity, row.itinerary].map((part) => part?.trim()).filter(Boolean).join(" · ");
    return text || "—";
  }
  const stops = [row.collection, ...(Array.isArray(row.destinations) ? row.destinations : [])].filter((part): part is string => Boolean(part?.trim()));
  if (row.destination?.trim() && row.destination.trim() !== stops[stops.length - 1]) stops.push(row.destination.trim());
  if (stops.length > 0) return stops.join(" → ");
  if (row.durationHours) return interpolate(hourly, { hours: row.durationHours });
  return "—";
}

export function presentLedger(rows: LedgerRow[], invoicesByRequest: Map<string, { id: string; fileName: string; count: number }>, locale: Locale, labels: PresentLabels): PresentedFinancialRow[] {
  return rows.map((row) => {
    const corporate = isCorporateBooking({
      corporateContactId: row.corporateContactId,
      source: row.source,
      priceEstimate: asSegment(row.priceEstimate),
    });
    const company = (row.companyName || row.entity || "").trim();
    const person = row.name.trim();
    const gross = grossEuros({ quotedAmount: row.quotedAmount, priceEstimate: asTotal(row.priceEstimate) });
    const vat = vatOf(gross, row.priceEstimate);
    const sign = row.settlement === "refunded" ? -1 : 1;
    const invoice = invoicesByRequest.get(row.id);
    return {
      id: row.id,
      reference: row.reference,
      when: row.pickupAt ? formatPickup(row.pickupAt, locale) : formatTimestamp(row.createdAt, locale),
      client: corporate ? company || person : person,
      clientSub: corporate
        ? company && person && company.toLowerCase() !== person.toLowerCase()
          ? person
          : null
        : company || null,
      corporate,
      service: labels.services[row.service] ?? row.service,
      route: routeOf(row, labels.hourly),
      gross: sign * gross,
      vatLow: sign * vat.low,
      vatHigh: sign * vat.high,
      vatEstimated: vat.estimated,
      status: asStatus(row.settlement),
      bookingStatus: asBookingStatus(row.bookingStatus),
      invoiceId: invoice?.id ?? null,
      invoiceCount: invoice?.count ?? 0,
      invoiceFile: invoice?.fileName ?? null,
    };
  });
}

function asSegment(value: unknown): { segment: "corporate" | "public" } | null {
  if (!value || typeof value !== "object" || !("segment" in value)) return null;
  const segment = (value as { segment?: unknown }).segment;
  return segment === "corporate" || segment === "public" ? { segment } : null;
}

function asTotal(value: unknown): { total?: unknown } | null {
  if (!value || typeof value !== "object" || !("total" in value)) return null;
  return { total: (value as { total?: unknown }).total };
}

export async function getFinancialPage(query: FinancialQuery, locale: Locale, labels: PresentLabels) {
  await requireAdmin();
  const [summary, ledger] = await Promise.all([
    getFinancialSummary(query),
    selectLedger(query, FINANCIAL_PAGE_SIZE, (query.page - 1) * FINANCIAL_PAGE_SIZE),
  ]);
  const invoicesByRequest = await attachInvoices(ledger.rows);
  return {
    summary,
    rows: presentLedger(ledger.rows, invoicesByRequest, locale, labels),
    total: ledger.total,
  };
}

const CSV_EXPORT_LIMIT = 10_000;

/** Every cell is quoted. A comma inside a Dutch amount or a date must not become a column. */
function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function csvMoney(value: number): string {
  return csvCell(formatCurrency(value).replaceAll("\u00a0", " ").replaceAll("\u202f", " "));
}

export type CsvLabels = {
  headers: [string, string, string, string, string, string, string, string, string, string, string, string];
  status: Record<PaymentStatus, string>;
  business: string;
  public: string;
};

/** Semicolon-separated, UTF-8 with BOM. Text, dates and euro amounts are quoted so Excel keeps each value in one cell. */
export function toFinancialCsv(rows: PresentedFinancialRow[], labels: CsvLabels): string {
  const lines = [
    labels.headers.map((header) => csvCell(header)).join(";"),
    ...rows.map((row) =>
      [
        csvCell(row.reference),
        csvCell(row.when),
        csvCell(row.clientSub ? `${row.client} — ${row.clientSub}` : row.client),
        csvCell(row.corporate ? labels.business : labels.public),
        csvCell(row.service),
        csvCell(row.route),
        csvMoney(row.gross),
        csvMoney(row.vatLow),
        csvMoney(row.vatHigh),
        csvMoney(row.vatLow + row.vatHigh),
        csvCell(labels.status[row.status]),
        csvCell(row.invoiceFile ?? ""),
      ].join(";"),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function exportFinancialCsv(query: FinancialQuery, locale: Locale, present: PresentLabels, labels: CsvLabels): Promise<string> {
  await requireAdmin();
  const ledger = await selectLedger({ ...query, page: 1 }, CSV_EXPORT_LIMIT, 0);
  const invoicesByRequest = await attachInvoices(ledger.rows);
  return toFinancialCsv(presentLedger(ledger.rows, invoicesByRequest, locale, present), labels);
}
