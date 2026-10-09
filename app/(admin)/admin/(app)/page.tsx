import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatEuro, formatRelative, formatTimestamp, isPast, pickupInstant, pickupParts, STATUS_DOT, STATUS_LABEL } from "@/lib/admin/format";
import { listRequests, PAGE_SIZE, requestStats, statusCounts } from "@/lib/admin/queries";
import { REQUEST_STATUSES } from "@/lib/quotes/constants";
import {
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EuroIcon,
  InboxIcon,
  SearchIcon,
  XIcon,
} from "../_components/icons";
import { StatusBadge } from "../_components/status-badge";
import { Avatar, btn, Card, EmptyState, field, PageBody, PageHeader, Skeleton, StatCard, StatCardSkeleton } from "../_components/ui";

export const metadata: Metadata = { title: "Quote requests" };

type Search = { status?: string; q?: string; page?: string };

export default function RequestsPage({ searchParams }: PageProps<"/admin">) {
  return (
    <PageBody>
      <PageHeader title="Quote requests" description="Every enquiry from the website, from first contact to completed journey." />
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <Requests searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </PageBody>
  );
}

function href(params: Search) {
  const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = sp.toString();
  return s ? `/admin?${s}` : "/admin";
}

async function Stats() {
  const [counts, stats] = await Promise.all([statusCounts(), requestStats()]);
  const inProgress = counts.contacted + counts.quoted;
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        tone="accent"
        label="Awaiting reply"
        value={counts.new}
        hint={stats.last24h ? `${stats.last24h} received in the last 24h` : "Nothing new in the last 24h"}
        icon={<InboxIcon />}
      />
      <StatCard
        label="In progress"
        value={inProgress}
        hint={`${counts.contacted} contacted · ${counts.quoted} quoted`}
        icon={<CheckCircleIcon />}
      />
      <StatCard label="Open quotes" value={formatEuro(stats.openValue)} hint="Sent, awaiting client decision" icon={<EuroIcon />} />
      <StatCard
        label="Upcoming journeys"
        value={stats.upcoming}
        hint={`${stats.next7} in the next 7 days · ${formatEuro(stats.confirmedValue)} booked`}
        icon={<CalendarIcon />}
      />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

async function Requests({ searchParams }: { searchParams: Promise<Search> }) {
  const { status, q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const [{ rows, total }, counts] = await Promise.all([
    listRequests({ status, search: q?.trim(), page }),
    statusCounts(),
  ]);
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabs = [
    { key: "", label: "All", n: all, dot: "" },
    ...REQUEST_STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], n: counts[s], dot: STATUS_DOT[s] })),
  ];
  const filtered = Boolean(q || status);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <Card className="mt-6 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-3 sm:p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <nav className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" aria-label="Filter by status">
          <div className="inline-flex gap-1 rounded-lg bg-zinc-100/80 p-1">
            {tabs.map((t) => {
              const active = (status ?? "") === t.key;
              return (
                <Link
                  key={t.key || "all"}
                  href={href({ status: t.key, q })}
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
        <form action="/admin" role="search" className="flex w-full gap-2 sm:max-w-md 2xl:w-auto 2xl:max-w-none">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative min-w-0 flex-1 2xl:w-72 2xl:flex-none">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search name, email, ref, place…"
              aria-label="Search requests"
              className={`${field} h-9 pl-9 ${q ? "pr-9" : ""}`}
            />
            {q && (
              <Link
                href={href({ status })}
                aria-label="Clear"
                title="Clear"
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <XIcon size={14} />
              </Link>
            )}
          </div>
          <button className={`${btn.base} ${btn.primary} ${btn.md}`}>Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={filtered ? <SearchIcon size={18} /> : <InboxIcon size={18} />}
          title={filtered ? "No requests match these filters" : "No quote requests yet"}
          description={
            filtered
              ? "Try a different search term or status."
              : "New enquiries from the website will appear here as soon as they're submitted."
          }
          action={
            filtered && (
              <Link href="/admin" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                Reset filters
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Phones and tablets: stacked list */}
          <ul className="divide-y divide-zinc-100 lg:hidden">
            {rows.map((r) => {
              const pickup = pickupParts(r.pickupAt);
              return (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 active:bg-zinc-100">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-sm ${r.status === "new" ? "font-semibold" : "font-medium"} text-zinc-950`}>{r.name}</p>
                          <p className="truncate text-xs text-zinc-500">{r.email}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                        {r.collection} <span className="text-zinc-400">→</span> {r.destination}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon size={12} />
                          {pickup.date} · {pickup.time}
                        </span>
                        <span>{r.service}</span>
                        <span className="ml-auto font-mono text-[11px] text-zinc-400">{r.reference}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-xs font-medium text-zinc-500">
                  <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Client</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Journey</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Pick-up (NL)</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Service</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Quote</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="py-2.5 pl-3 pr-5 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r) => {
                  const pickup = pickupParts(r.pickupAt);
                  const pickupAt = pickupInstant(r.pickupAt);
                  const past = isPast(pickupAt);
                  return (
                    <tr key={r.id} className="group relative transition-colors hover:bg-zinc-50/80">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          {r.status === "new" && <span aria-label="Unread" className="absolute left-1.5 size-1.5 rounded-full bg-zinc-950" />}
                          <Avatar name={r.name} size="sm" />
                          <div className="min-w-0">
                            {/* Stretched link: the whole row is clickable */}
                            <Link
                              href={`/admin/requests/${r.id}`}
                              className={`block max-w-50 truncate text-zinc-950 after:absolute after:inset-0 after:content-[''] ${
                                r.status === "new" ? "font-semibold" : "font-medium"
                              }`}
                            >
                              {r.name}
                            </Link>
                            <span className="block max-w-50 truncate text-xs text-zinc-500">{r.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-70 px-3 py-3.5">
                        <div className="flex gap-2.5">
                          <span aria-hidden="true" className="mt-1.5 flex flex-col items-center">
                            <span className="size-1.5 rounded-full border border-zinc-400" />
                            <span className="my-0.5 h-3 w-px bg-zinc-300" />
                            <span className="size-1.5 rounded-full bg-zinc-900" />
                          </span>
                          <div className="min-w-0 text-[13px] leading-5 text-zinc-700">
                            <p className="truncate" title={r.collection}>{r.collection}</p>
                            <p className="truncate" title={r.destination}>{r.destination}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <p className={`font-medium ${past ? "text-zinc-500" : "text-zinc-900"}`}>{pickup.date}</p>
                        <p className="text-xs text-zinc-500">
                          {pickup.time} · {formatRelative(pickupAt)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-zinc-600">{r.service}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-zinc-900">
                        {r.quotedAmount === null ? <span className="text-zinc-300">—</span> : formatEuro(r.quotedAmount)}
                      </td>
                      <td className="px-3 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="whitespace-nowrap py-3.5 pl-3 pr-5 text-right">
                        <p className="text-zinc-700" title={formatTimestamp(r.createdAt)}>
                          {formatRelative(r.createdAt)}
                        </p>
                        <p className="font-mono text-[11px] text-zinc-400">{r.reference}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Footer / pagination */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-[13px] text-zinc-500 sm:px-5">
          <p>
            Showing <span className="font-medium tabular-nums text-zinc-900">{from}–{to}</span> of{" "}
            <span className="font-medium tabular-nums text-zinc-900">{total}</span> {total === 1 ? "request" : "requests"}
          </p>
          {pages > 1 && (
            <nav className="flex items-center gap-2" aria-label="Pagination">
              <span className="mr-1 hidden tabular-nums sm:inline">
                Page {page} of {pages}
              </span>
              <PageLink disabled={page <= 1} href={href({ status, q, page: String(page - 1) })} label="Previous page">
                <ChevronLeftIcon />
              </PageLink>
              <PageLink disabled={page >= pages} href={href({ status, q, page: String(page + 1) })} label="Next page">
                <ChevronRightIcon />
              </PageLink>
            </nav>
          )}
        </div>
      )}
    </Card>
  );
}

function PageLink({ disabled, href, label, children }: { disabled: boolean; href: string; label: string; children: React.ReactNode }) {
  const cls = `${btn.base} ${btn.secondary} size-8 px-0`;
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={`${cls} cursor-not-allowed opacity-40`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={cls}>
      {children}
    </Link>
  );
}

function TableSkeleton() {
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 xl:flex-row xl:justify-between">
        <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg xl:w-80" />
      </div>
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="hidden h-3.5 w-32 md:block" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
