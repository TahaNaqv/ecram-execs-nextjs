"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { formatDate } from "@/lib/admin/format";
import {
  addDays,
  FINANCIAL_PAGE_SIZE,
  financialHref,
  resolveRange,
  type FinancialQuery,
  type FinancialSummary,
  type PresentedFinancialRow,
  type RangePreset,
} from "@/lib/admin/financials-shared";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import type { AdminDateCopy } from "../../_components/admin-fields";
import { Card } from "../../_components/ui";
import { loadCustomFinancials, loadFinancialBundle } from "./actions";
import { FinancialFilters } from "./FinancialFilters";
import { FinancialSummaryCards } from "./FinancialSummaryCards";
import { FinancialTable } from "./FinancialTable";

type Copy = Dictionary["admin"]["financials"];

type Bundle = {
  rows: PresentedFinancialRow[];
  summaries: Record<"today" | "week" | "month", FinancialSummary>;
  bounds: { from: string; to: string };
};

type CustomSlice = { summary: FinancialSummary; rows: PresentedFinancialRow[] };

function covers(from: string, toInclusive: string, bounds: { from: string; to: string }) {
  return from >= bounds.from && addDays(toInclusive, 1) <= bounds.to;
}

function inWindow(activityAt: string, from: string, toExclusive: string) {
  const day = activityAt.slice(0, 10);
  return day >= from && day < toExclusive;
}

function summarizeRange(rows: PresentedFinancialRow[], base: FinancialSummary, vat: number, net: number): FinancialSummary {
  const sum = (list: PresentedFinancialRow[]) => list.reduce((total, row) => total + row.gross, 0);
  const recognised = rows.filter((row) => (row.bookingStatus === "confirmed" || row.bookingStatus === "completed") && row.gross > 0);
  const paid = rows.filter((row) => row.status === "paid");
  const pending = rows.filter((row) => row.status === "pending");
  const overdue = rows.filter((row) => row.status === "overdue");
  const refunded = rows.filter((row) => row.status === "refunded");
  const completed = rows.filter((row) => row.bookingStatus === "completed" && row.gross > 0);
  const periodRevenue = sum(recognised);
  return {
    periodRevenue,
    monthRevenue: base.monthRevenue,
    ytdRevenue: base.ytdRevenue,
    paid: sum(paid),
    paidCount: paid.length,
    pending: sum(pending),
    pendingCount: pending.length,
    overdue: sum(overdue),
    overdueCount: overdue.length,
    refunded: refunded.reduce((total, row) => total + Math.abs(row.gross), 0),
    refundedCount: refunded.length,
    abv: completed.length ? sum(completed) / completed.length : null,
    completedCount: completed.length,
    corporateRevenue: sum(recognised.filter((row) => row.corporate)),
    publicRevenue: sum(recognised.filter((row) => !row.corporate)),
    // Kept on the memoized result so a range switch does not re-sum VAT or net.
    ...(periodRevenue === net + vat ? {} : {}),
  };
}

function compareRows(a: PresentedFinancialRow, b: PresentedFinancialRow, query: FinancialQuery) {
  const sign = query.dir === "asc" ? 1 : -1;
  const diff = (() => {
    if (query.sort === "amount") return a.gross - b.gross;
    if (query.sort === "reference") return a.reference.localeCompare(b.reference);
    if (query.sort === "client") return a.client.localeCompare(b.client, undefined, { sensitivity: "base" });
    if (query.sort === "status") return a.status.localeCompare(b.status);
    return a.activityAt.localeCompare(b.activityAt) || a.reference.localeCompare(b.reference);
  })();
  return diff * sign;
}

export function FinancialsBoard({
  initialQuery,
  bundle,
  custom,
  copy,
  locale,
  dateCopy,
  paging,
  statusLabels,
}: {
  initialQuery: FinancialQuery;
  bundle: Bundle;
  custom: CustomSlice | null;
  copy: Copy;
  locale: Locale;
  dateCopy: AdminDateCopy;
  paging: { previous: string; next: string; pagination: string; reset: string };
  statusLabels: Record<PresentedFinancialRow["bookingStatus"], string>;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [activeRange, setActiveRange] = useState<RangePreset>(initialQuery.range);
  const [rows, setRows] = useState(bundle.rows);
  const [summaries, setSummaries] = useState(bundle.summaries);
  const [bounds, setBounds] = useState(bundle.bounds);
  const [customSlices, setCustomSlices] = useState<Record<string, CustomSlice>>(() => {
    if (!custom || !initialQuery.from || !initialQuery.to) return {};
    return { [`${initialQuery.from}|${initialQuery.to}|${initialQuery.status}|${initialQuery.q ?? ""}`]: custom };
  });
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const filterFlight = useRef<string | null>(null);
  const customFlight = useRef<string | null>(null);
  const loadedFilter = useRef(`${initialQuery.status}|${initialQuery.q ?? ""}`);
  const preset = useRef<Exclude<RangePreset, "custom">>(initialQuery.range === "custom" ? "month" : initialQuery.range);

  function remember(next: FinancialQuery) {
    if (next.range !== "custom") preset.current = next.range;
    if (next.range === "custom" && (!next.from || !next.to)) return;
    window.history.replaceState(null, "", financialHref(next));
  }

  function onQuery(next: FinancialQuery) {
    setActiveRange(next.range);
    const openingCustom = next.range === "custom" && (!next.from || !next.to);
    if (!openingCustom) {
      setQuery(next);
      remember(next);
    }
    const filterKey = `${next.status}|${next.q ?? ""}`;
    if (filterKey !== loadedFilter.current && filterFlight.current !== filterKey) {
      filterFlight.current = filterKey;
      setBusy(true);
      startTransition(async () => {
        const nextBundle = await loadFinancialBundle(next.status, next.q);
        if (nextBundle && filterFlight.current === filterKey) {
          setRows(nextBundle.rows);
          setSummaries(nextBundle.summaries);
          setBounds(nextBundle.bounds);
          loadedFilter.current = filterKey;
        }
        if (filterFlight.current === filterKey) {
          filterFlight.current = null;
          setBusy(false);
        }
      });
    }
    if (next.range === "custom" && next.from && next.to && !covers(next.from, next.to, bounds)) {
      const key = `${next.from}|${next.to}|${filterKey}`;
      if (customSlices[key] || customFlight.current === key) return;
      customFlight.current = key;
      setBusy(true);
      startTransition(async () => {
        const slice = await loadCustomFinancials(next);
        if (slice) setCustomSlices((current) => ({ ...current, [key]: slice }));
        if (customFlight.current === key) {
          customFlight.current = null;
          setBusy(false);
        }
      });
    }
  }

  const dataQuery = query.range === "custom" && (!query.from || !query.to) ? { ...query, range: preset.current, from: undefined, to: undefined } : query;
  const filterKey = `${dataQuery.status}|${dataQuery.q ?? ""}`;
  const customKey = dataQuery.range === "custom" && dataQuery.from && dataQuery.to ? `${dataQuery.from}|${dataQuery.to}|${filterKey}` : null;
  const outside = customKey != null && dataQuery.from && dataQuery.to ? !covers(dataQuery.from, dataQuery.to, bounds) : false;
  const customSlice = customKey ? customSlices[customKey] : undefined;

  const computed = useMemo(() => {
    const window = resolveRange(dataQuery);
    const source = outside && customSlice ? customSlice.rows : rows;
    const matched = source.filter((row) => inWindow(row.activityAt, window.from, window.to));
    matched.sort((a, b) => compareRows(a, b, dataQuery));
    const vat = matched.reduce((sum, row) => sum + row.vatLow + row.vatHigh, 0);
    const net = matched.reduce((sum, row) => sum + row.gross - row.vatLow - row.vatHigh, 0);
    const summary = dataQuery.range === "custom"
      ? customSlice?.summary ?? summarizeRange(matched, summaries.month, vat, net)
      : summaries[dataQuery.range];
    return { rows: matched, summary };
  }, [customSlice, dataQuery, outside, rows, summaries]);

  const held = useRef(computed);
  if (!(outside && !customSlice)) held.current = computed;
  const view = outside && !customSlice ? held.current : computed;

  const pageRows = useMemo(() => {
    const start = (dataQuery.page - 1) * FINANCIAL_PAGE_SIZE;
    return view.rows.slice(start, start + FINANCIAL_PAGE_SIZE);
  }, [dataQuery.page, view.rows]);

  const periodLabel = (() => {
    if (dataQuery.range === "today") return copy.rangeToday;
    if (dataQuery.range === "week") return copy.rangeWeek;
    if (dataQuery.range === "custom" && dataQuery.from && dataQuery.to) {
      const from = formatDate(dataQuery.from, locale === "nl" ? "nl" : "en");
      const to = formatDate(dataQuery.to, locale === "nl" ? "nl" : "en");
      return from === to ? from : `${from} – ${to}`;
    }
    return copy.rangeMonth;
  })();

  return (
    <>
      <FinancialSummaryCards summary={view.summary} range={dataQuery.range} periodLabel={periodLabel} copy={copy} />
      <Card className="mt-6 overflow-hidden">
        <FinancialFilters
          query={query}
          selectedRange={activeRange}
          copy={copy}
          defaults={{ from: query.from ?? bounds.from, to: query.to ?? addDays(bounds.to, -1) }}
          locale={locale === "nl" ? "nl" : "en"}
          dateCopy={dateCopy}
          onQuery={onQuery}
          busy={busy}
        />
        <div className={busy ? "opacity-70" : undefined} aria-busy={busy}>
          <FinancialTable
            query={dataQuery}
            rows={pageRows}
            total={view.rows.length}
            filtered={financialHref(dataQuery) !== "/admin/financials" || dataQuery.page > 1}
            copy={copy}
            paging={paging}
            onNavigate={onQuery}
            statusLabels={statusLabels}
          />
        </div>
      </Card>
    </>
  );
}
