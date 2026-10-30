import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatRelative } from "@/lib/admin/format";
import { DUE_SOON_MINUTES, enquiryQueues, type AnsweredEnquiry, type OpenEnquiry, type Queue, type QueueSummary } from "@/lib/admin/sla";
import { requireAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { CheckCircleIcon, ClockIcon } from "../../_components/icons";
import { StatusBadge, UrgentBadge } from "../../_components/status-badge";
import { Card, EmptyState, PageBody, PageHeader, Skeleton } from "../../_components/ui";
import { AutoRefresh, Countdown } from "./live";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.enquiries.title };
}

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  return admin.enquiries[part];
}

const Fallback = () => <span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />;

export default function EnquiriesPage() {
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
      <Suspense fallback={<QueuesSkeleton />}>
        <Queues />
      </Suspense>
    </PageBody>
  );
}

function QueuesSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[0, 1].map((i) => (
        <Card key={i}>
          <div className="flex flex-col gap-4 p-5">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
}

/** "12 min", "1 h 05 min", "40 s": short enough for a figure; the word for an hour is the language's own ("h", "u"). */
function duration(ms: number, hour: string) {
  const minutes = Math.round(ms / 60_000);
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} ${hour} ${String(minutes % 60).padStart(2, "0")} min`;
}

async function Queues() {
  const [{ admin: t }, admin, data] = await Promise.all([adminDictionary(), requireAdmin(), enquiryQueues()]);
  const e = t.enquiries;
  const { nowMs, standard, corporate } = data;
  const queueName: Record<Queue, string> = { standard: e.queueStandardShort, corporate: e.queueCorporateShort };

  // The strip at the foot: the worst news first
  const parts: { tone: "bad" | "warn"; text: string }[] = [];
  for (const q of [standard, corporate]) {
    if (q.overdue) parts.push({ tone: "bad", text: interpolate(e.alertOverdueText, { queue: queueName[q.queue], count: q.overdue }) });
  }
  for (const q of [standard, corporate]) {
    if (q.dueSoon) parts.push({ tone: "warn", text: interpolate(e.alertSoonText, { queue: queueName[q.queue], count: q.dueSoon, minutes: DUE_SOON_MINUTES }) });
  }
  const level = parts.some((p) => p.tone === "bad") ? "bad" : parts.length ? "warn" : "good";
  const levelLabel = { bad: e.alertOverdue, warn: e.alertSoon, good: e.alertOnTrack }[level];
  const levelStyle = {
    bad: "bg-red-600 text-white",
    warn: "bg-amber-500 text-zinc-950",
    good: "bg-emerald-600 text-white",
  }[level];

  return (
    <>
      <AutoRefresh />
      <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <QueueCard summary={standard} nowMs={nowMs} locale={admin.locale} />
        <QueueCard summary={corporate} nowMs={nowMs} locale={admin.locale} />
      </div>
      <Card className="mt-4" >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" role="status" data-alert={level}>
          <span className={`inline-flex shrink-0 items-center self-start rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${levelStyle}`}>{levelLabel}</span>
          <p className="m-0 text-sm text-zinc-800">{parts.length ? parts.map((p) => p.text).join(" ") : e.alertAllClear}</p>
        </div>
      </Card>
    </>
  );
}

async function QueueCard({ summary, nowMs, locale }: { summary: QueueSummary; nowMs: number; locale: "en" | "nl" }) {
  const { admin: t } = await adminDictionary();
  const e = t.enquiries;
  const corporate = summary.queue === "corporate";
  const name = corporate ? e.corporateTitle : e.standardTitle;
  const tag = corporate ? e.corporateTag : e.standardTag;
  const targetMs = summary.targetMinutes * 60_000;
  const dueSoonMs = DUE_SOON_MINUTES * 60_000;
  const hidden = summary.newCount - summary.open.length;
  const headingId = `queue-${summary.queue}`;

  return (
    <Card>
      <section aria-labelledby={headingId} data-queue={summary.queue}>
        <header className="border-b border-zinc-100 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={headingId} className="text-sm font-semibold text-zinc-950">
              {interpolate(e.queueLabel, { name })}
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">{tag}</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{corporate ? e.corporateNote : e.standardNote}</p>
        </header>

        <dl className="m-0 grid grid-cols-3 gap-3 border-b border-zinc-100 p-5">
          <div>
            <dt className="text-xs text-zinc-500">{e.statNew}</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950" data-stat="new">
              {summary.newCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{e.statAverage}</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950" data-stat="average">
              {summary.avgResponseMs === null ? "—" : duration(summary.avgResponseMs, e.unitHour)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">{e.statWithin}</dt>
            <dd className="m-0 mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-950" data-stat="compliance">
              {summary.compliance === null ? "—" : `${summary.compliance}%`}
            </dd>
          </div>
          <p className="col-span-3 m-0 text-xs text-zinc-500">
            {e.statWindow} · {interpolate(e.statTarget, { minutes: summary.targetMinutes })}
          </p>
        </dl>

        {summary.open.length === 0 ? (
          <EmptyState icon={<CheckCircleIcon size={18} />} title={e.empty} description={e.emptyNote} />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(9rem,1fr)] gap-4 border-b border-zinc-100 px-5 py-2 text-xs font-medium text-zinc-500 md:grid" aria-hidden="true">
              <span>
                {e.colEnquiry} · {corporate ? e.colCompany : e.colClient}
              </span>
              <span>{e.colSubmitted}</span>
              <span>{e.colLeft}</span>
            </div>
            {/* Open Enquiries Container with Explicit Scrollbars */}
            <div className="max-h-[260px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
              <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0 px-5" aria-label={interpolate(e.queueLabel, { name })}>
                {summary.open.map((r) => (
                  <Row key={r.id} row={r} nowMs={nowMs} targetMs={targetMs} dueSoonMs={dueSoonMs} locale={locale} overdueLabel={e.overdue} timeLeftLabel={e.colLeft} />
                ))}
              </ul>
            </div>
            {hidden > 0 && (
              <p className="m-0 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
                {interpolate(e.more, { count: hidden })} ·{" "}
                <Link href="/admin/requests?status=new" className="underline underline-offset-4 hover:text-zinc-950">
                  {e.moreLink}
                </Link>
              </p>
            )}
          </>
        )}

        <Answered answered={summary.answered} nowMs={nowMs} locale={locale} />
      </section>
    </Card>
  );
}

function Row({ row, nowMs, targetMs, dueSoonMs, locale, overdueLabel, timeLeftLabel }: { row: OpenEnquiry; nowMs: number; targetMs: number; dueSoonMs: number; locale: "en" | "nl"; overdueLabel: string; timeLeftLabel: string }) {
  return (
    <li className="relative grid cursor-pointer grid-cols-1 gap-x-4 gap-y-2 py-4 hover:bg-zinc-50 md:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(9rem,1fr)] md:items-center" data-enquiry={row.reference}>
      <Link
        href={`/admin/requests/${row.id}`}
        aria-label={`${row.reference}, ${row.who}`}
        className="absolute inset-0 z-10 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
      />
      <div className="min-w-0">
        <p className="m-0 font-mono text-sm font-medium text-sky-700">{row.reference}</p>
        <p className="m-0 truncate text-sm text-zinc-950">{row.who}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={row.status} />
          <UrgentBadge request={{ status: row.status, pickupAt: row.pickupAt, returnAt: row.returnAt }} />
        </div>
      </div>
      <p className="m-0 text-sm text-zinc-600">{formatRelative(new Date(row.createdMs), nowMs, locale)}</p>
      <Countdown deadline={row.deadlineMs} serverNow={nowMs} target={targetMs} dueSoon={dueSoonMs} overdueLabel={overdueLabel} label={timeLeftLabel} />
    </li>
  );
}

async function Answered({ answered, nowMs, locale }: { answered: AnsweredEnquiry[]; nowMs: number; locale: "en" | "nl" }) {
  const { admin: t } = await adminDictionary();
  const e = t.enquiries;
  return (
    <div className="border-t border-zinc-100 px-5 py-4">
      <h3 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-950">
        <ClockIcon size={14} className="text-zinc-400" />
        {e.answeredTitle}
      </h3>
      {answered.length === 0 ? (
        <p className="m-0 mt-2 text-xs text-zinc-500">{e.answeredEmpty}</p>
      ) : (
        /* Answered Enquiries Container with Explicit Scrollbars */
        <div className="max-h-[260px] overflow-y-auto pr-2 mt-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-400">
          <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0">
            {answered.map((a) => (
              <li key={a.id} className="relative flex cursor-pointer items-center justify-between gap-3 py-2 text-sm hover:bg-zinc-50" data-answered={a.reference}>
                <Link
                  href={`/admin/requests/${a.id}`}
                  aria-label={`${a.reference}, ${a.who}`}
                  className="absolute inset-0 z-10 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                />
                <span className="min-w-0 truncate">
                  <span className="font-mono text-xs text-sky-700">{a.reference}</span>{" "}
                  <span className="text-zinc-600">{a.who}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-500">
                  {interpolate(e.answeredIn, { time: duration(a.respondedMs - a.createdMs, e.unitHour) })} · {formatRelative(new Date(a.respondedMs), nowMs, locale)}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                      a.withinTarget ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-red-50 text-red-700 ring-red-200"
                    }`}
                  >
                    {a.withinTarget ? e.onTime : e.late}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}