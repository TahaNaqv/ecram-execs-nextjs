import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatRelative } from "@/lib/admin/format";
import { chatList, CHAT_PAGE_SIZE, type ChatRow } from "@/lib/admin/chats";
import { RETENTION } from "@/lib/retention";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { ChatIcon, ChevronLeftIcon, ChevronRightIcon } from "../../_components/icons";
import { btn, Card, EmptyState, PageBody, PageHeader, Skeleton } from "../../_components/ui";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.chats.title };
}

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  if (part === "title") return admin.chats.title;
  return interpolate(admin.chats.description, { days: RETENTION.chatDays });
}

const Fallback = () => <span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />;

export default function ChatsPage({ searchParams }: PageProps<"/admin/chats">) {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<Fallback />}>
            <Heading part="title" />
          </Suspense>
        }
        description={
          <Suspense fallback={<Fallback />}>
            <Heading part="description" />
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

const pageHref = (page: number) => (page <= 1 ? "/admin/chats" : `/admin/chats?page=${page}`);

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

async function Chats({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: rawPage } = await searchParams;
  const requested = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const [{ admin: t }, admin, data] = await Promise.all([adminDictionary(), requireAdmin(), chatList(requested)]);
  const c = t.chats;
  const { rows, nowMs, total, booked, page, pages } = data;

  if (rows.length === 0) {
    return (
      <Card className="mt-6">
        <EmptyState icon={<ChatIcon size={18} />} title={c.empty} description={c.emptyNote} />
      </Card>
    );
  }
  const from = (page - 1) * CHAT_PAGE_SIZE + 1;
  const to = from + rows.length - 1;
  const pager = () => (
    <nav className="flex items-center gap-2" aria-label={t.common.pagination}>
      <PageLink disabled={page <= 1} href={pageHref(page - 1)} label={t.common.previousPage}>
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
            href={pageHref(n)}
            aria-current={n === page ? "page" : undefined}
            className={`${btn.base} size-8 px-0 tabular-nums ${n === page ? btn.primary : btn.secondary}`}
          >
            {n}
          </Link>
        ),
      )}
      <PageLink disabled={page >= pages} href={pageHref(page + 1)} label={t.common.nextPage}>
        <ChevronRightIcon />
      </PageLink>
    </nav>
  );
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-zinc-500">{interpolate(c.summary, { total, booked })}</p>
        {pages > 1 && pager()}
      </div>
      <Card className="mt-3">
        <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0">
          {rows.map((row) => (
            <Row key={row.id} row={row} nowMs={nowMs} locale={admin.locale} />
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

async function Row({ row, nowMs, locale }: { row: ChatRow; nowMs: number; locale: "en" | "nl" }) {
  const { admin: t } = await adminDictionary();
  const c = t.chats;
  return (
    <li data-chat={row.id}>
      <Link href={`/admin/chats/${row.id}`} className="flex flex-col gap-1.5 px-5 py-4 transition-colors hover:bg-zinc-50">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>{formatRelative(new Date(row.lastMs), nowMs, locale)}</span>
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
    </li>
  );
}
