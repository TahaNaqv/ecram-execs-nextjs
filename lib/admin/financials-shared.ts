/**
 * Filters for the financials ledger. No database access, so the filter bar can import it.
 *
 * Dates are calendar days in Europe/Amsterdam. `to` on a custom range is inclusive; the query
 * turns it into an exclusive bound when it asks the database.
 */

export const FINANCIAL_PAGE_SIZE = 10;
/** Dutch B2B payment term (BW 6:119a): a confirmed corporate booking is overdue after this many days. */
export const CORPORATE_TERM_DAYS = 30;
export const FINANCIAL_KEYS = ["range", "from", "to", "status", "q", "sort", "dir", "page"] as const;

export type RangePreset = "today" | "week" | "month" | "custom";
export type PaymentStatus = "paid" | "pending" | "overdue" | "refunded" | "failed";
export type StatusFilter = "all" | Exclude<PaymentStatus, "failed">;
export type SortKey = "date" | "amount" | "reference" | "client" | "status";

export type FinancialQuery = {
  range: RangePreset;
  /** Inclusive calendar day, only when `range` is custom. */
  from?: string;
  /** Inclusive calendar day, only when `range` is custom. */
  to?: string;
  status: StatusFilter;
  q?: string;
  sort: SortKey;
  dir: "asc" | "desc";
  page: number;
};

export type FinancialSummary = {
  periodRevenue: number;
  monthRevenue: number;
  ytdRevenue: number;
  paid: number;
  paidCount: number;
  pending: number;
  pendingCount: number;
  overdue: number;
  overdueCount: number;
  refunded: number;
  refundedCount: number;
  /** Mean gross of completed rides in the selected period. Null when there are none. */
  abv: number | null;
  completedCount: number;
  corporateRevenue: number;
  publicRevenue: number;
};

export type PresentedFinancialRow = {
  id: string;
  reference: string;
  when: string;
  client: string;
  clientSub: string | null;
  corporate: boolean;
  service: string;
  route: string;
  /** Negative when the row is a refund, so a filtered total can be summed. */
  gross: number;
  vatLow: number;
  vatHigh: number;
  vatEstimated: boolean;
  status: PaymentStatus;
  invoiceId: string | null;
  invoiceCount: number;
  invoiceFile: string | null;
};

const STATUSES: readonly StatusFilter[] = ["all", "paid", "pending", "overdue", "refunded"];
const SORTS: readonly SortKey[] = ["date", "amount", "reference", "client", "status"];

function one(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y < 2000 || y > 2100) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's calendar day in the Netherlands, as YYYY-MM-DD. */
export function amsterdamToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday = 1 … Sunday = 7, for a calendar day (UTC date arithmetic, no clock time). */
function weekdayMonday1(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const sunday0 = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return sunday0 === 0 ? 7 : sunday0;
}

export function parseFinancialQuery(raw: Record<string, string | string[] | undefined>): FinancialQuery {
  const rangeRaw = one(raw.range);
  const statusRaw = one(raw.status);
  const sortRaw = one(raw.sort);
  const dirRaw = one(raw.dir);
  let from = one(raw.from);
  let to = one(raw.to);
  if (isIsoDate(from) && isIsoDate(to) && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const custom = rangeRaw === "custom" && isIsoDate(from) && isIsoDate(to);
  const range: RangePreset = custom ? "custom" : rangeRaw === "today" || rangeRaw === "week" ? rangeRaw : "month";
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(one(raw.page)) || 1)));
  const q = one(raw.q)?.slice(0, 120);
  return {
    range,
    from: range === "custom" ? from : undefined,
    to: range === "custom" ? to : undefined,
    status: (STATUSES as readonly string[]).includes(statusRaw ?? "") ? (statusRaw as StatusFilter) : "all",
    q,
    sort: (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SortKey) : "date",
    dir: dirRaw === "asc" ? "asc" : "desc",
    page,
  };
}

/** Inclusive start and exclusive end, as Amsterdam calendar timestamps. */
export function resolveRange(query: FinancialQuery, now = new Date()): { from: string; to: string } {
  const today = amsterdamToday(now);
  if (query.range === "today") return { from: today, to: addDays(today, 1) };
  if (query.range === "week") {
    const start = addDays(today, 1 - weekdayMonday1(today));
    return { from: start, to: addDays(start, 7) };
  }
  if (query.range === "custom" && query.from && query.to) return { from: query.from, to: addDays(query.to, 1) };
  const [y, m] = today.split("-");
  const start = `${y}-${m}-01`;
  const next = m === "12" ? `${Number(y) + 1}-01-01` : `${y}-${String(Number(m) + 1).padStart(2, "0")}-01`;
  return { from: start, to: next };
}

export function monthWindow(now = new Date()): { from: string; to: string } {
  return resolveRange({ range: "month", status: "all", sort: "date", dir: "desc", page: 1 }, now);
}

/** 1 January through the end of today, Amsterdam. */
export function yearWindow(now = new Date()): { from: string; to: string } {
  const today = amsterdamToday(now);
  return { from: `${today.slice(0, 4)}-01-01`, to: addDays(today, 1) };
}

export function financialHref(query: FinancialQuery): string {
  const sp = new URLSearchParams();
  if (query.range !== "month") sp.set("range", query.range);
  if (query.range === "custom" && query.from && query.to) {
    sp.set("from", query.from);
    sp.set("to", query.to);
  }
  if (query.status !== "all") sp.set("status", query.status);
  if (query.q) sp.set("q", query.q);
  if (query.sort !== "date") sp.set("sort", query.sort);
  if (query.dir !== "desc") sp.set("dir", query.dir);
  if (query.page > 1) sp.set("page", String(query.page));
  const s = sp.toString();
  return s ? `/admin/financials?${s}` : "/admin/financials";
}

export function financialExportHref(query: FinancialQuery): string {
  const href = financialHref({ ...query, page: 1 });
  const qs = href.split("?")[1];
  return qs ? `/admin/financials/export?${qs}` : "/admin/financials/export";
}

export function isCanonicalFinancialUrl(raw: Record<string, string | string[] | undefined>, query: FinancialQuery): boolean {
  const canonical = new URLSearchParams(financialHref(query).split("?")[1] ?? "");
  for (const key of FINANCIAL_KEYS) {
    const value = one(raw[key]);
    if ((value ?? "") !== (canonical.get(key) ?? "")) return false;
  }
  return true;
}
