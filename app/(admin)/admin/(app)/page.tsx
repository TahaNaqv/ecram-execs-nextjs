import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatEuro, formatRelative, formatTimestamp, isPast, pickupInstant, pickupParts, STATUS_DOT } from "@/lib/admin/format";
import { unseenPartnerMessages } from "@/lib/admin/portal";
import { listRequests, PAGE_SIZE, requestStats, statusCounts } from "@/lib/admin/queries";
import { REQUEST_STATUSES, serviceLabel } from "@/lib/quotes/constants";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import type { QuoteRequest } from "@/lib/db/schema";
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
import { StatusBadge, UrgentBadge } from "../_components/status-badge";
import { LiveSearchInput } from "./live-search-input";
import { Avatar, btn, Card, EmptyState, field, PageBody, PageHeader, Skeleton, StatCard, StatCardSkeleton } from "../_components/ui";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.requests.title };
}

type Search = { status?: string; q?: string; page?: string };

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  return admin.requests[part];
}

async function NewBookingLink() {
  const { admin } = await adminDictionary();
  return (
    <Link href="/admin/requests/new" className={`${btn.base} ${btn.primary} ${btn.md}`}>
      {admin.newBooking.cta}
    </Link>
  );
}

export default function RequestsPage({ searchParams }: PageProps<"/admin">) {
  return (
    <PageBody>
      {/* The heading depends on the admin's language, which is a cookie read — so it streams
          rather than blocking the page's static shell under Cache Components. */}
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="title" />
          </Suspense>
        }
        description={
          <Suspense fallback={<span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="description" />
          </Suspense>
        }
        actions={
          <Suspense fallback={null}>
            <NewBookingLink />
          </Suspense>
        }
      />
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
  const { admin: t } = await adminDictionary();
  const [counts, stats] = await Promise.all([statusCounts(), requestStats()]);
  const inProgress = counts.contacted + counts.quoted;
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        tone="accent"
        label={t.requests.statAwaiting}
        value={counts.new}
        hint={stats.last24h ? `${stats.last24h} received in the last 24h` : t.requests.statAwaitingNone}
        icon={<InboxIcon />}
      />
      <StatCard
        label={t.requests.statInProgress}
        value={inProgress}
        hint={`${counts.contacted} contacted · ${counts.quoted} quoted`}
        icon={<CheckCircleIcon />}
      />
      <StatCard label={t.requests.statOpenQuotes} value={formatEuro(stats.openValue)} hint={t.requests.statOpenQuotesNote} icon={<EuroIcon />} />
      <StatCard
        label={t.requests.statUpcoming}
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
  const [{ rows, total }, counts, dict] = await Promise.all([
    listRequests({ status, search: q?.trim(), page }),
    statusCounts(),
    adminDictionary(),
  ]);
  const serviceLabels = dict.services;
  const t = dict.admin;
  // Requests on this page where a partner has written and nobody on the team has opened it yet
  const unseen = await unseenPartnerMessages(rows.map((r: QuoteRequest) => r.id));
  const partnerBadge = (id: string) =>
    unseen.has(id) ? <span className="mt-1 inline-block rounded bg-zinc-950 px-1.5 py-0.5 text-[10px] font-medium text-white">{t.requests.partnerMessage}</span> : null;
  const all = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabs = [
    { key: "", label: t.requests.all, n: all, dot: "" },
    ...REQUEST_STATUSES.map((s) => ({ key: s, label: t.statuses[s], n: counts[s], dot: STATUS_DOT[s] })),
  ];
  const filtered = Boolean(q || status);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <Card className="mt-6 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-100 p-3 sm:p-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <nav className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0" aria-label={t.common.filterByStatus}>
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
            <LiveSearchInput
              status={status}
              defaultValue={q}
              placeholder={t.requests.searchPlaceholder}
              aria-label={t.requests.searchLabel}
              className={`${field} h-9 pl-9 ${q ? "pr-9" : ""}`}
            />
            {q && (
              <Link
                href={href({ status })}
                aria-label={t.common.clear}
                title={t.common.clear}
                className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-zinc-950 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <XIcon size={14} className="text-zinc-950" />
              </Link>
            )}
          </div>
          <button className={`${btn.base} ${btn.primary} ${btn.md}`}>{t.common.search}</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={filtered ? <SearchIcon size={18} /> : <InboxIcon size={18} />}
          title={filtered ? t.requests.emptyFiltered : t.requests.emptyAll}
          description={
            filtered
              ? t.requests.emptyFilteredNote
              : t.requests.emptyAllNote
          }
          action={
            filtered && (
              <Link href="/admin" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                {t.common.resetFilters}
              </Link>
            )
          }
        />
      ) : (
        <>
          {/* Phones, tablets and small laptops: stacked list (the table needs about a thousand pixels) */}
          <ul className="divide-y divide-zinc-100 xl:hidden">
            {rows.map((r: QuoteRequest) => {
              const pickup = r.pickupAt ? pickupParts(r.pickupAt) : null;
              const destinationsArray = [...(r.destinations ?? []), r.destination]; // stops on the way, then where to
              return (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 active:bg-zinc-100">
                    <Avatar name={r.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`truncate text-sm ${r.status === "new" ? "font-semibold" : "font-medium"} text-zinc-950`}>{r.name}</p>
                          <p className="truncate text-xs text-zinc-500">{r.email}</p>
                          {partnerBadge(r.id)}
                        </div>
                        <span className="flex flex-col items-end gap-1">
                          <StatusBadge status={r.status} />
                          <UrgentBadge request={r} />
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-700">
                        {r.collection === null ? (
                          (r.entity ?? r.itinerary)
                        ) : (
                          <>
                            {r.collection} <span className="text-zinc-400">→</span> {destinationsArray.join(" → ")}
                          </>
                        )}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon size={12} />
                          {pickup ? `${pickup.date} · ${pickup.time}` : "—"}
                        </span>
                        <span>{serviceLabel(r.service, serviceLabels)}</span>
                        <span className="ml-auto font-mono text-[11px] text-zinc-400">{r.reference}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Wide screens: table. It scrolls inside the card in both directions, so its scrollbars are always in view */}
          <div className="hidden max-h-[calc(100dvh-9rem)] overflow-auto xl:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-10 border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
                  <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">{t.requests.colClient}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t.requests.colJourney}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t.requests.colPickup}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t.requests.colService}</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">{t.requests.colQuote}</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">{t.requests.colStatus}</th>
                  <th scope="col" className="py-2.5 pl-3 pr-5 text-right font-medium">{t.requests.colReceived}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((r: QuoteRequest) => {
                  const pickup = r.pickupAt ? pickupParts(r.pickupAt) : null;
                  const pickupAt = r.pickupAt ? pickupInstant(r.pickupAt) : null;
                  const past = pickupAt ? isPast(pickupAt) : false;
                  
                  const isBespoke = r.collection === null;
                  const allStops = isBespoke
                    ? []
                    : [r.collection, ...(r.destinations ?? []), r.destination].filter(Boolean);

                  return (
                    <tr key={r.id} className="group relative transition-colors hover:bg-zinc-50/80">
                      <td className="py-3.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          {r.status === "new" && <span aria-label={t.requests.unread} className="absolute left-1.5 size-1.5 rounded-full bg-zinc-950" />}
                          <Avatar name={r.name} size="sm" />
                          <div className="min-w-0">
                            {/* Stretched link: the whole row is clickable */}
                            <Link
                              href={`/admin/requests/${r.id}`}
                              className={`block max-w-44 truncate text-zinc-950 after:absolute after:inset-0 after:content-[''] ${
                                r.status === "new" ? "font-semibold" : "font-medium"
                              }`}
                            >
                              {r.name}
                            </Link>
                            <span className="block max-w-44 truncate text-xs text-zinc-500" title={r.email}>{r.email}</span>
                            {partnerBadge(r.id)}
                          </div>
                        </div>
                      </td>
                      <td className="max-w-56 px-3 py-3.5">
                        {isBespoke ? (
                          <div className="text-[13px] leading-5 text-zinc-700">
                            <p className="truncate" title={r.entity ?? ""}>{r.entity}</p>
                            <p className="truncate" title={r.itinerary ?? ""}>{r.itinerary}</p>
                          </div>
                        ) : (
                          <div className="relative flex flex-col gap-1.5 py-0.5 text-[13px] leading-4 text-zinc-700">
                            {allStops.map((stop, i, arr) => {
                              const isFirst = i === 0;
                              const isLast = i === arr.length - 1;
                              
                              return (
                                <div key={i} className="flex items-center gap-2.5">
                                  <span aria-hidden="true" className="relative flex size-2 shrink-0 items-center justify-center">
                                    {!isFirst && (
                                      <span className="absolute -top-3 left-[3px] h-3 w-px bg-zinc-300" />
                                    )}
                                    <span
                                      className={`size-1.5 rounded-full ${
                                        isFirst
                                          ? "border border-zinc-400 bg-white"
                                          : isLast
                                          ? "bg-zinc-950"
                                          : "bg-zinc-900 ring-2 ring-zinc-100"
                                      }`}
                                    />
                                  </span>
                                  <span className="truncate" title={stop as string}>{stop}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        {pickup && pickupAt ? (
                          <>
                            <p className={`font-medium ${past ? "text-zinc-500" : "text-zinc-900"}`}>{pickup.date}</p>
                            <p className="text-xs text-zinc-500">
                              {pickup.time} · {formatRelative(pickupAt)}
                            </p>
                          </>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-zinc-600">{serviceLabel(r.service, serviceLabels)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-zinc-900">
                        {r.quotedAmount === null ? <span className="text-zinc-300">—</span> : formatEuro(r.quotedAmount)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="flex flex-col items-start gap-1">
                          <StatusBadge status={r.status} />
                          <UrgentBadge request={r} />
                        </span>
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
            <nav className="flex items-center gap-2" aria-label={t.common.pagination}>
              <PageLink disabled={page <= 1} href={href({ status, q, page: String(page - 1) })} label={t.common.previousPage}>
                <ChevronLeftIcon />
              </PageLink>
              {pageWindow(page, pages).map((n, i) =>
                n === null ? (
                  <span key={`gap-${i}`} aria-hidden="true" className="px-1">
                    …
                  </span>
                ) : (
                  <Link
                    key={n}
                    href={href({ status, q, page: n === 1 ? undefined : String(n) })}
                    aria-current={n === page ? "page" : undefined}
                    className={`${btn.base} size-8 px-0 tabular-nums ${n === page ? btn.primary : btn.secondary}`}
                  >
                    {n}
                  </Link>
                ),
              )}
              <PageLink disabled={page >= pages} href={href({ status, q, page: String(page + 1) })} label={t.common.nextPage}>
                <ChevronRightIcon />
              </PageLink>
            </nav>
          )}
        </div>
      )}
    </Card>
  );
}

/** The page numbers to show: the first, the last and the ones around the current page, with a gap (null) where numbers are left out. */
function pageWindow(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? [null, n] : [n]));
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