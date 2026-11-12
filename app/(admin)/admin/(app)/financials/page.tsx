export const instant = false;

import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/admin/format";
import { getFinancialPage } from "@/lib/admin/financials";
import { FINANCIAL_PAGE_SIZE, amsterdamToday, financialHref, isCanonicalFinancialUrl, parseFinancialQuery, type FinancialQuery } from "@/lib/admin/financials-shared";
import { getAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { Card, PageBody, PageHeader, Skeleton, StatCardSkeleton } from "../../_components/ui";
import { FinancialFilters } from "./FinancialFilters";
import { FinancialSummaryCards } from "./FinancialSummaryCards";
import { FinancialTable } from "./FinancialTable";

type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.financials.title };
}

function periodLabel(query: FinancialQuery, month: string, today: string, week: string, locale: "en" | "nl"): string {
  if (query.range === "today") return today;
  if (query.range === "week") return week;
  if (query.range === "custom" && query.from && query.to) {
    const from = formatDate(query.from, locale);
    const to = formatDate(query.to, locale);
    return from === to ? from : `${from} – ${to}`;
  }
  return month;
}

async function Financials({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const query = parseFinancialQuery(raw);
  if (!isCanonicalFinancialUrl(raw, query)) redirect(financialHref(query));

  const [dict, admin] = await Promise.all([adminDictionary(), getAdmin()]);
  const locale = admin?.locale ?? "en";
  const copy = dict.admin.financials;
  const { summary, rows, total } = await getFinancialPage(query, locale, {
    services: dict.services,
    hourly: dict.admin.requestDetail.durationValue,
  });
  const pages = Math.max(1, Math.ceil(total / FINANCIAL_PAGE_SIZE));
  if (query.page > pages) redirect(financialHref({ ...query, page: pages }));
  const today = amsterdamToday();

  return (
    <>
      <FinancialSummaryCards
        summary={summary}
        range={query.range}
        periodLabel={periodLabel(query, copy.rangeMonth, copy.rangeToday, copy.rangeWeek, locale)}
        copy={copy}
      />
      <Card className="mt-6 overflow-hidden">
        <FinancialFilters query={query} copy={copy} defaults={{ from: query.from ?? today, to: query.to ?? today }} />
        <FinancialTable
          query={query}
          rows={rows}
          total={total}
          filtered={financialHref(query) !== "/admin/financials"}
          copy={copy}
          paging={{
            previous: dict.admin.common.previousPage,
            next: dict.admin.common.nextPage,
            pagination: dict.admin.common.pagination,
            reset: dict.admin.common.resetFilters,
          }}
        />
      </Card>
    </>
  );
}

function FinancialsSkeleton() {
  return (
    <>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4">
          <Skeleton className="h-9 w-full max-w-md rounded-lg" />
          <Skeleton className="h-9 w-full max-w-xl rounded-lg" />
        </div>
        <div className="space-y-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Card>
    </>
  );
}

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  return admin.financials[part];
}

export default function FinancialsPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-64 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="title" />
          </Suspense>
        }
        description={
          <Suspense fallback={<span className="inline-block h-[1em] w-96 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="description" />
          </Suspense>
        }
      />
      <Suspense fallback={<FinancialsSkeleton />}>
        <Financials searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}
