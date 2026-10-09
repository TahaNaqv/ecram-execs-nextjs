import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { applicationCounts, listApplications } from "@/lib/admin/applications";
import { APPLICATION_DOT, APPLICATION_LABEL, formatRelative, formatTimestamp } from "@/lib/admin/format";
import { APPLICATION_STATUSES, colourLabel, makeLabel } from "@/lib/partners/criteria";
import { AlertIcon, ArrowLeftIcon, InboxIcon } from "../../../_components/icons";
import { ApplicationBadge } from "../../../_components/status-badge";
import { Avatar, Card, EmptyState, PageBody, PageHeader, Skeleton } from "../../../_components/ui";

export const metadata: Metadata = { title: "Driver applications" };

export default function ApplicationsPage({ searchParams }: PageProps<"/admin/drivers/applications">) {
  return (
    <PageBody>
      <PageHeader
        eyebrow={
          <Link href="/admin/drivers" className="mb-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-950">
            <ArrowLeftIcon size={14} />
            Drivers
          </Link>
        }
        title="Driver applications"
        description={
          <>
            Independent drivers applying to join with their own car from the{" "}
            <a href="/drive-with-us" target="_blank" className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950">
              Drive with us
            </a>{" "}
            page. Cars are checked against the RDW register on submission.
          </>
        }
      />
      <Suspense fallback={<ListSkeleton />}>
        <Applications searchParams={searchParams as Promise<{ status?: string }>} />
      </Suspense>
    </PageBody>
  );
}

async function Applications({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const [rows, counts] = await Promise.all([listApplications(status), applicationCounts()]);
  const all = Object.values(counts).reduce((x, y) => x + y, 0);
  const tabs = [
    { key: "", label: "All", n: all, dot: "" },
    ...APPLICATION_STATUSES.map((s) => ({ key: s, label: APPLICATION_LABEL[s], n: counts[s], dot: APPLICATION_DOT[s] })),
  ];

  return (
    <Card className="mt-6 overflow-hidden">
      <nav className="overflow-x-auto border-b border-zinc-100 p-3 sm:p-4" aria-label="Filter by status">
        <div className="inline-flex gap-1 rounded-lg bg-zinc-100/80 p-1">
          {tabs.map((t) => {
            const active = (status ?? "") === t.key;
            return (
              <Link
                key={t.key || "all"}
                href={t.key ? `/admin/drivers/applications?status=${t.key}` : "/admin/drivers/applications"}
                aria-current={active ? "page" : undefined}
                className={`flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition ${
                  active ? "bg-white text-zinc-950 shadow-card ring-1 ring-zinc-200/80" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {t.dot && <span aria-hidden="true" className={`size-1.5 rounded-full ${t.key === "new" ? "bg-zinc-950" : t.dot}`} />}
                {t.label}
                <span className={`tabular-nums ${active ? "text-zinc-500" : "text-zinc-400"}`}>{t.n}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<InboxIcon size={18} />}
          title={status ? "No applications with this status" : "No applications yet"}
          description="Applications from the Drive with us page will appear here as soon as they're submitted."
        />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/drivers/applications/${r.id}`}
                className="flex gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 active:bg-zinc-100 sm:items-center sm:px-5"
              >
                <Avatar name={r.name} />
                <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-center sm:gap-6">
                  <div className="min-w-0">
                    <p className={`truncate text-sm text-zinc-950 ${r.status === "new" ? "font-semibold" : "font-medium"}`}>{r.name}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {r.experienceYears} yrs experience · {r.phone}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="shrink-0 rounded border border-[#1d3f8f]/30 bg-[#eef2fb] px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-[#1d3f8f]">
                      {r.plate}
                    </span>
                    {r.rdwCheckedAt ? (
                      <span className="truncate text-[13px] text-zinc-700">
                        {makeLabel(r.make ?? "")} {r.model}
                        <span className="text-zinc-400"> · {colourLabel(r.colour ?? "")}, {r.firstRegistered?.slice(0, 4)}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[13px] text-amber-700">
                        <AlertIcon size={13} /> Not verified with RDW
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:justify-end">
                    <ApplicationBadge status={r.status} />
                    <span className="ml-auto text-xs text-zinc-500 sm:ml-0 sm:w-20 sm:text-right" title={formatTimestamp(r.createdAt)}>
                      {formatRelative(r.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ListSkeleton() {
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-zinc-100 p-4">
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
