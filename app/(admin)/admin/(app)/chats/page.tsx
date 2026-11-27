import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatRelative } from "@/lib/admin/format";
import { chatList, CHAT_PAGE_SIZE, type ChatRow } from "@/lib/admin/chats";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { setChatFollowUp } from "./actions";
import { interpolate } from "@/lib/i18n/interpolate";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon } from "../../_components/icons";
import { btn, Card, EmptyState, PageBody, PageHeader, Skeleton } from "../../_components/ui";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.chats.title };
}

async function Heading() {
  const { admin } = await adminDictionary();
  return admin.chats.title;
}

const Fallback = () => <span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />;

export default function ChatsPage({ searchParams }: PageProps<"/admin/chats">) {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<Fallback />}>
            <Heading />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <Card className="mt-6">
            <div className="flex flex-col gap-4 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          </Card>
        }
      >
        <Chats searchParams={searchParams} />
      </Suspense>
    </PageBody>
  );
}

const pageHref = (page: number, query: string, follow: string) => {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (follow) params.set("follow", follow);
  if (page > 1) params.set("page", String(page));
  const text = params.toString();
  return text ? `/admin/chats?${text}` : "/admin/chats";
};

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

const pill = "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset";

async function Chats({ searchParams }: { searchParams: Promise<{ page?: string; q?: string; follow?: string }> }) {
  const { page: rawPage, q, follow: rawFollow } = await searchParams;
  const query = (q ?? "").trim().slice(0, 120);
  const follow = rawFollow === "needed" || rawFollow === "resolved" ? rawFollow : "";
  const requested = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const [{ admin: t }, admin, data] = await Promise.all([adminDictionary(), requireAdmin(), chatList(requested, query, follow)]);
  const c = t.chats;
  const { rows, nowMs, total, booked, page, pages } = data;

  const filters = (
    <form action="/admin/chats" className="mt-6 flex flex-wrap items-center gap-2">
      <input name="q" defaultValue={query} placeholder={c.searchPlaceholder} className="h-9 min-w-56 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900" />
      <select name="follow" defaultValue={follow} className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900">
        <option value="">{c.followAll}</option>
        <option value="needed">{c.followNeeded}</option>
        <option value="resolved">{c.followResolved}</option>
      </select>
      <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>{c.filter}</button>
    </form>
  );
  if (rows.length === 0) {
    return (
      <>
        {filters}
        <Card className="mt-3">
          <EmptyState icon={<ChatIcon size={18} />} title={c.empty} description={c.emptyNote} />
        </Card>
      </>
    );
  }
  const from = (page - 1) * CHAT_PAGE_SIZE + 1;
  const to = from + rows.length - 1;
  const pager = () => (
    <nav className="flex items-center gap-2" aria-label={t.common.pagination}>
      <PageLink disabled={page <= 1} href={pageHref(page - 1, query, follow)} label={t.common.previousPage}>
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
            href={pageHref(n, query, follow)}
            aria-current={n === page ? "page" : undefined}
            className={`${btn.base} size-8 px-0 tabular-nums ${n === page ? btn.primary : btn.secondary}`}
          >
            {n}
          </Link>
        ),
      )}
      <PageLink disabled={page >= pages} href={pageHref(page + 1, query, follow)} label={t.common.nextPage}>
        <ChevronRightIcon />
      </PageLink>
    </nav>
  );
  return (
    <>
      {filters}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-zinc-500">{interpolate(c.summary, { total, booked })}</p>
      </div>
      <Card className="mt-3">
        <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0">
          {rows.map((row) => (
            <Row key={row.id} row={row} nowMs={nowMs} locale={admin.locale} copy={c} />
          ))}
        </ul>
        {pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3 text-[13px] text-zinc-500">
            <p className="m-0">{interpolate(c.range, { from, to, total })}</p>
            {pager()}
          </div>
        )}
      </Card>
    </>
  );
}

async function Row({ row, nowMs, locale, copy }: { row: ChatRow; nowMs: number; locale: "en" | "nl"; copy: Dictionary["admin"]["chats"] }) {
  const c = copy;
  return (
    <li data-chat={row.id} className="flex items-stretch">
      <Link href={`/admin/chats/${row.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5 px-5 py-4 transition-colors hover:bg-zinc-50">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>{formatRelative(new Date(row.lastMs), nowMs, locale)}</span>
          <span className="font-medium text-zinc-800">{c.visitorName}: {row.visitorName ?? "—"}</span>
          <span className="break-all">{c.visitorEmail}: {row.visitorEmail ?? "—"}</span>
          {row.followUp ? <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200">{c.followRequired}</span> : null}
          <span aria-hidden="true">·</span>
          <span>{row.messages === 1 ? c.messageOne : interpolate(c.messageMany, { count: row.messages })}</span>
          <span aria-hidden="true">·</span>
          <span className="uppercase">{row.locale}</span>
        </span>
        <span className="truncate text-sm font-medium text-zinc-950">{row.preview ?? "—"}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          {row.request && <span className={`${pill} bg-emerald-50 text-emerald-700 ring-emerald-200`}>{interpolate(c.bookingSent, { reference: row.request.reference })}</span>}
          {row.ready && !row.request && <span className={`${pill} bg-amber-50 text-amber-800 ring-amber-200`}>{c.readyNotSent}</span>}
          {row.handedOver && <span className={`${pill} bg-sky-50 text-sky-700 ring-sky-200`}>{c.handedOver}</span>}
        </span>
      </Link>
      <form action={setChatFollowUp} className="flex items-center px-4">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="followUp" value={row.followUp ? "0" : "1"} />
        <button className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${row.followUp ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-zinc-50 text-zinc-600 ring-zinc-200"}`}>
          {row.followUp ? c.followRequired : c.followResolved}
        </button>
      </form>
    </li>
  );
}
