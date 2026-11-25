export const instant = false;

import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCustomFinancials, getFinancialBundle } from "@/lib/admin/financials";
import { addDays, financialHref, isCanonicalFinancialUrl, parseFinancialQuery } from "@/lib/admin/financials-shared";
import { can } from "@/lib/admin/access";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { Card, PageBody, PageHeader, Skeleton, StatCardSkeleton } from "../../_components/ui";
import { FinancialsBoard } from "./financials-board";

type Search = Record<string, string | string[] | undefined>;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.financials.title };
}

async function Financials({ searchParams }: { searchParams: Promise<Search> }) {
  const raw = await searchParams;
  const query = parseFinancialQuery(raw);
  if (!isCanonicalFinancialUrl(raw, query)) redirect(financialHref(query));

  const [dict, admin] = await Promise.all([adminDictionary(), requireAdmin()]);
  if (!can(admin.role, admin.permissions, "financials")) {
    return <p className="mt-6 text-sm text-zinc-600">Only someone with financial access can open this page.</p>;
  }
  const locale = admin?.locale ?? "en";
  const labels = { services: dict.services, hourly: dict.admin.requestDetail.durationValue };
  const bundle = await getFinancialBundle({ status: query.status, q: query.q }, locale, labels);
  const outside = query.range === "custom" && query.from && query.to && (query.from < bundle.bounds.from || addDays(query.to, 1) > bundle.bounds.to);
  const custom = outside ? await getCustomFinancials(query, locale, labels) : null;

  return (
    <FinancialsBoard
      initialQuery={query}
      bundle={bundle}
      custom={custom}
      copy={dict.admin.financials}
      locale={locale === "nl" ? "nl" : "en"}
      dateCopy={{ chooseDate: dict.admin.common.chooseDate, previousMonth: dict.admin.common.previousMonth, nextMonth: dict.admin.common.nextMonth }}
      paging={{
        previous: dict.admin.common.previousPage,
        next: dict.admin.common.nextPage,
        pagination: dict.admin.common.pagination,
        reset: dict.admin.common.resetFilters,
      }}
      statusLabels={dict.admin.statuses}
    />
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

async function Heading() {
  const { admin } = await adminDictionary();
  return admin.financials.title;
}

export default function FinancialsPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-64 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading />
          </Suspense>
        }
      />
      <Suspense fallback={<FinancialsSkeleton />}>
        <Financials searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}
