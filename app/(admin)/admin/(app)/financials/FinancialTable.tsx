import Link from "next/link";
import { formatEuro, STATUS_DOT, STATUS_STYLE as BOOKING_STATUS_STYLE } from "@/lib/admin/format";
import { FINANCIAL_PAGE_SIZE, financialHref, type FinancialQuery, type PaymentStatus, type PresentedFinancialRow, type SortKey } from "@/lib/admin/financials-shared";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import type { RequestStatus } from "@/lib/quotes/constants";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon, InboxIcon, SearchIcon } from "../../_components/icons";
import { btn, EmptyState } from "../../_components/ui";

type Copy = Dictionary["admin"]["financials"];

const STATUS_STYLE: Record<PaymentStatus, string> = {
  paid: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  overdue: "bg-red-50 text-red-800 ring-red-200",
  refunded: "bg-white text-zinc-500 ring-zinc-200",
  failed: "bg-red-50 text-red-800 ring-red-200",
};

function statusLabel(copy: Copy, status: PaymentStatus): string {
  if (status === "paid") return copy.paid;
  if (status === "pending") return copy.pending;
  if (status === "overdue") return copy.overdue;
  if (status === "refunded") return copy.refunded;
  return copy.failed;
}

function sortHref(query: FinancialQuery, key: SortKey): string {
  const dir = query.sort !== key ? (key === "client" || key === "reference" || key === "status" ? "asc" : "desc") : query.dir === "asc" ? "desc" : "asc";
  return financialHref({ ...query, sort: key, dir, page: 1 });
}

function pageWindow(page: number, pages: number): (number | null)[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return shown.flatMap((n, i) => (i > 0 && n - shown[i - 1] > 1 ? [null, n] : [n]));
}

function SortHeader({ query, sort, label, align = "left", onNavigate }: { query: FinancialQuery; sort: SortKey; label: string; align?: "left" | "right"; onNavigate?: (next: FinancialQuery) => void }) {
  const active = query.sort === sort;
  const className = `inline-flex items-center gap-1 hover:text-zinc-950 ${align === "right" ? "flex-row-reverse" : ""}`;
  const nextDir = query.sort !== sort ? (sort === "client" || sort === "reference" || sort === "status" ? "asc" : "desc") : query.dir === "asc" ? "desc" : "asc";
  const mark = active && <ChevronDownIcon size={12} className={query.dir === "asc" ? "rotate-180" : ""} />;
  return (
    <th scope="col" aria-sort={active ? (query.dir === "asc" ? "ascending" : "descending") : "none"} className={`px-3 py-2.5 font-medium ${align === "right" ? "text-right" : ""}`}>
      {onNavigate ? (
        <button type="button" onClick={() => onNavigate({ ...query, sort, dir: nextDir, page: 1 })} className={className}>
          {label}
          {mark}
        </button>
      ) : (
        <Link href={sortHref(query, sort)} scroll={false} className={className}>
          {label}
          {mark}
        </Link>
      )}
    </th>
  );
}

function BookingStatus({ status, label }: { status: RequestStatus; label: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${BOOKING_STATUS_STYLE[status]}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {label}
    </span>
  );
}

function Audience({ corporate, copy }: { corporate: boolean; copy: Copy }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-medium tracking-wide text-white lowercase">
      {corporate ? copy.badgeBusiness : copy.badgePublic}
    </span>
  );
}

function Payment({ status, copy }: { status: PaymentStatus; copy: Copy }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {statusLabel(copy, status)}
    </span>
  );
}

function Vat({ row, copy }: { row: PresentedFinancialRow; copy: Copy }) {
  return (
    <div className="text-right">
      <p className="font-medium tabular-nums text-zinc-900">{formatEuro(row.vatLow + row.vatHigh)}</p>
      <p className="text-[11px] text-zinc-500">
        {copy.vatLow} {formatEuro(row.vatLow)}
        {row.vatHigh ? ` · ${copy.vatHigh} ${formatEuro(row.vatHigh)}` : ""}
        {row.vatEstimated ? ` · ${copy.vatEstimated}` : ""}
      </p>
    </div>
  );
}

function Actions({ row, copy }: { row: PresentedFinancialRow; copy: Copy }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {row.moneybirdHref && (
        <a
          href={row.moneybirdHref}
          target="_blank"
          rel="noreferrer"
          className={`${btn.base} ${btn.secondary} ${btn.sm}`}
          title={row.moneybirdNumber ? interpolate(copy.moneybirdInvoice, { number: row.moneybirdNumber }) : copy.openMoneybird}
        >
          {row.moneybirdNumber ? interpolate(copy.moneybirdInvoice, { number: row.moneybirdNumber }) : copy.openMoneybird}
        </a>
      )}
      {row.invoiceId && (
        <a
          href={`/api/admin/invoices/${row.invoiceId}`}
          target="_blank"
          rel="noreferrer"
          className={`${btn.base} ${btn.secondary} ${btn.sm}`}
          title={row.invoiceCount > 1 ? interpolate(copy.invoiceCount, { count: row.invoiceCount }) : copy.downloadInvoice}
        >
          <DownloadIcon size={13} />
          {copy.downloadInvoice}
        </a>
      )}
      <a href={`/api/admin/financials/receipt/${row.id}`} target="_blank" rel="noreferrer" className={`${btn.base} ${btn.ghost} ${btn.sm}`}>
        <FileTextIcon size={13} />
        {copy.downloadReceipt}
      </a>
    </div>
  );
}

export function FinancialTable({
  query,
  rows,
  total,
  filtered,
  copy,
  paging,
  onNavigate,
  statusLabels,
}: {
  query: FinancialQuery;
  rows: PresentedFinancialRow[];
  total: number;
  filtered: boolean;
  copy: Copy;
  paging: { previous: string; next: string; pagination: string; reset: string };
  onNavigate?: (next: FinancialQuery) => void;
  statusLabels: Record<RequestStatus, string>;
}) {
  const page = query.page;
  const pages = Math.max(1, Math.ceil(total / FINANCIAL_PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * FINANCIAL_PAGE_SIZE + 1;
  const to = Math.min(total, page * FINANCIAL_PAGE_SIZE);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={filtered ? <SearchIcon size={18} /> : <InboxIcon size={18} />}
        title={filtered ? copy.emptyFiltered : copy.emptyTitle}
        description={filtered ? copy.emptyFilteredNote : copy.emptyNote}
        action={
          filtered ? (
            onNavigate ? (
              <button type="button" onClick={() => onNavigate({ range: "month", status: "all", sort: "date", dir: "desc", page: 1 })} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                {paging.reset}
              </button>
            ) : (
              <Link href="/admin/financials" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
                {paging.reset}
              </Link>
            )
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-zinc-100 xl:hidden">
        {rows.map((row) => (
          <li key={row.id} className="space-y-2 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-950">{row.client}</p>
                {row.clientSub && <p className="truncate text-xs text-zinc-500">{row.clientSub}</p>}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Audience corporate={row.corporate} copy={copy} />
                  <BookingStatus status={row.bookingStatus} label={statusLabels[row.bookingStatus]} />
                  <Payment status={row.status} copy={copy} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-zinc-950">{formatEuro(row.gross)}</p>
                <p className="text-[11px] text-zinc-500">{formatEuro(row.vatLow + row.vatHigh)}</p>
              </div>
            </div>
            <p className="text-sm text-zinc-700">{row.service}</p>
            <p className="text-xs text-zinc-500">{row.route}</p>
            <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
              <span>{row.when}</span>
              <Link href={`/admin/requests/${row.id}`} className="font-mono text-[11px] text-zinc-700 underline-offset-2 hover:underline">
                {row.reference}
              </Link>
            </div>
            <Actions row={row} copy={copy} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-max min-w-full text-left text-sm">
          <caption className="sr-only">{copy.title}</caption>
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
              <SortHeader query={query} sort="reference" label={copy.colReference} onNavigate={onNavigate} />
              <SortHeader query={query} sort="date" label={copy.colDate} onNavigate={onNavigate} />
              <SortHeader query={query} sort="client" label={copy.colClient} onNavigate={onNavigate} />
              <th scope="col" className="px-3 py-2.5 font-medium">{copy.colRoute}</th>
              <SortHeader query={query} sort="amount" label={copy.colGross} align="right" onNavigate={onNavigate} />
              <th scope="col" className="px-3 py-2.5 text-right font-medium">{copy.colVat}</th>
              <SortHeader query={query} sort="status" label={copy.colStatus} onNavigate={onNavigate} />
              <th scope="col" className="px-3 py-2.5 font-medium">{copy.colBookingStatus}</th>
              <th scope="col" className="sticky right-0 bg-zinc-50 py-2.5 pr-5 pl-3 text-right font-medium shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.08)]">{copy.colActions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.id} className="group align-top hover:bg-zinc-50/80">
                <td className="py-3.5 pr-3 pl-5">
                  <Link href={`/admin/requests/${row.id}`} className="font-mono text-[13px] font-medium text-zinc-950 underline-offset-2 hover:underline">
                    {row.reference}
                  </Link>
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap text-[13px] text-zinc-700">{row.when}</td>
                <td className="max-w-56 px-3 py-3.5">
                  <p className="truncate font-medium text-zinc-950" title={row.client}>{row.client}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Audience corporate={row.corporate} copy={copy} />
                    {row.clientSub && <span className="truncate text-xs text-zinc-500">{row.clientSub}</span>}
                  </div>
                </td>
                <td className="max-w-64 px-3 py-3.5">
                  <p className="text-[13px] text-zinc-900">{row.service}</p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500" title={row.route}>{row.route}</p>
                </td>
                <td className="px-3 py-3.5 text-right font-medium tabular-nums whitespace-nowrap text-zinc-950">{formatEuro(row.gross)}</td>
                <td className="px-3 py-3.5 whitespace-nowrap"><Vat row={row} copy={copy} /></td>
                <td className="px-3 py-3.5"><Payment status={row.status} copy={copy} /></td>
                <td className="px-3 py-3.5"><BookingStatus status={row.bookingStatus} label={statusLabels[row.bookingStatus]} /></td>
                <td className="sticky right-0 bg-white py-3.5 pr-5 pl-3 shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.08)] group-hover:bg-zinc-50"><Actions row={row} copy={copy} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3 text-[13px] text-zinc-500 sm:px-5">
        <p>{interpolate(copy.showing, { from, to, total })}</p>
        <nav className="flex flex-wrap items-center gap-2" aria-label={paging.pagination}>
          <span className="px-1 font-medium text-zinc-700 tabular-nums">{interpolate(copy.pageOf, { page, pages })}</span>
          <PageLink disabled={page <= 1} href={financialHref({ ...query, page: page - 1 })} label={paging.previous} onClick={onNavigate ? () => onNavigate({ ...query, page: page - 1 }) : undefined}>
            <ChevronLeftIcon />
          </PageLink>
          {pageWindow(page, pages).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} aria-hidden="true" className="px-1">…</span>
            ) : onNavigate ? (
              <button
                key={n}
                type="button"
                onClick={() => onNavigate({ ...query, page: n })}
                aria-current={n === page ? "page" : undefined}
                className={`${btn.base} size-8 px-0 tabular-nums ${n === page ? btn.primary : btn.secondary}`}
              >
                {n}
              </button>
            ) : (
              <Link
                key={n}
                href={financialHref({ ...query, page: n })}
                scroll={false}
                aria-current={n === page ? "page" : undefined}
                className={`${btn.base} size-8 px-0 tabular-nums ${n === page ? btn.primary : btn.secondary}`}
              >
                {n}
              </Link>
            ),
          )}
          <PageLink disabled={page >= pages} href={financialHref({ ...query, page: page + 1 })} label={paging.next} onClick={onNavigate ? () => onNavigate({ ...query, page: page + 1 }) : undefined}>
            <ChevronRightIcon />
          </PageLink>
        </nav>
      </div>
    </>
  );
}

function PageLink({ disabled, href, label, children, onClick }: { disabled: boolean; href: string; label: string; children: React.ReactNode; onClick?: () => void }) {
  const cls = `${btn.base} ${btn.secondary} size-8 px-0`;
  if (disabled) {
    return (
      <span aria-disabled="true" aria-label={label} className={`${cls} cursor-not-allowed opacity-40`}>
        {children}
      </span>
    );
  }
  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} scroll={false} aria-label={label} className={cls}>
      {children}
    </Link>
  );
}
