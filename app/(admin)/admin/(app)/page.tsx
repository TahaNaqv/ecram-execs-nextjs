import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dashboardFigures, fleetStatus, recentRequests, upcomingPickups } from "@/lib/admin/dashboard";
import { formatEuro, formatRelative, pickupParts } from "@/lib/admin/format";
import { systemHealth, type HealthKey, type HealthState } from "@/lib/admin/health";
import { unseenPartnerMessages } from "@/lib/admin/portal";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeVehicleKey, vehicleByKey } from "@/lib/fleet/vehicles";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { serviceLabel } from "@/lib/quotes/constants";
import { ActivityIcon, BatteryIcon, BriefcaseIcon, CalendarIcon, CarIcon, EuroIcon, InboxIcon, MapIcon } from "../_components/icons";
import { StatusBadge } from "../_components/status-badge";
import { Card, CardHeader, EmptyState, PageBody, PageHeader, Skeleton, StatCard, StatCardSkeleton } from "../_components/ui";
import { amsterdamToday, daySchedule } from "@/lib/admin/schedule";
import { DayMap } from "./requests/schedule/day-map";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.dashboard.title };
}

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  if (part === "title") return admin.dashboard.title;
  const { locale } = await requireAdmin();
  const date = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  return `${admin.dashboard.description} ${interpolate(admin.dashboard.asOf, { date })}`;
}

const Fallback = () => <span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />;

export default function DashboardPage() {
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
      <Suspense fallback={<FiguresSkeleton />}>
        <Figures />
      </Suspense>
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <div className="flex h-full min-h-0 flex-col xl:h-[420px]">
            <ScheduleMap />
          </div>
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={5} />}>
          <div className="flex h-full min-h-0 flex-col gap-4 xl:h-[420px]">
            <Incoming />
            
          </div>
        </Suspense>
      </div>
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <div className="flex h-full min-h-0 flex-col xl:h-[420px]">
            <Fleet />
          </div>
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <div className="flex h-full min-h-0 flex-col xl:h-[420px]">
            <SystemHealthStatus />
          </div>
        </Suspense>
      </div>
    </PageBody>
  );
}

function FiguresSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <Card>
      <div className="border-b border-zinc-100 px-5 py-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-4 p-5">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </Card>
  );
}

async function Figures() {
  const { admin: t } = await adminDictionary();
  const d = t.dashboard;
  const { fleet, jobs, partners, revenue } = await dashboardFigures();
  const switchedOff = fleet.total - fleet.available;
  return (
    <div className="mt-6 grid grid-cols-2 items-stretch gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        tone="accent"
        label={d.fleetLabel}
        value={`${fleet.available}/${fleet.total}`}
        hint={switchedOff > 0 ? interpolate(d.fleetHintSwitchedOff, { count: switchedOff }) : d.fleetHint}
        icon={<CarIcon />}
      />
      <StatCard
        label={d.jobsLabel}
        value={jobs.today}
        hint={`${d.jobsHint} · ${jobs.nextAt ? interpolate(d.jobsNext, { time: jobs.nextAt }) : d.jobsNone}`}
        icon={<CalendarIcon />}
      />
      <StatCard label={d.partnersLabel} value={partners.total} hint={d.partnersHint} icon={<BriefcaseIcon />} />
      <StatCard
        label={d.revenueLabel}
        value={formatEuro(revenue.amount)}
        hint={d.revenueHint}
        icon={<EuroIcon />}
      />
    </div>
  );
}

function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "muted"; children: React.ReactNode }) {
  const style = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
    bad: "bg-red-50 text-red-700 ring-red-200",
    muted: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  }[tone];
  const dot = { good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500", muted: "bg-zinc-400" }[tone];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

async function ScheduleMap() {
  const { admin: t, locale } = await dashboardCopy();
  const d = t.dashboard;
  const today = await daySchedule(amsterdamToday());

  return (
    <Card className="flex h-full min-h-[16rem] flex-col overflow-hidden">
      <CardHeader
        title={d.mapLiveTitle}
        description={d.mapLiveDescription}
        icon={<MapIcon size={16} />}
        actions={
          <Link href="/admin/requests/schedule" className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline whitespace-nowrap">
            {d.dispatchGrid}
          </Link>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {today.trips.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500">{d.mapEmpty}</p>
        ) : (
          <Suspense fallback={<Skeleton className="h-44 w-full" />}>
            <DayMap trips={today.trips} locale={locale === "nl" ? "nl" : "en"} copy={t.schedule} framed={false} layout="dashboard" />
          </Suspense>
        )}
      </div>
    </Card>
  );
}

async function Incoming() {
  const { admin: t, locale } = await dashboardCopy();
  const d = t.dashboard;
  const [rows, fleet] = await Promise.all([upcomingPickups(), fleetStatus()]);
  const unseen = await unseenPartnerMessages(rows.map((r) => r.id));
  const carName = (raw: string | null) => {
    if (!raw) return null;
    const key = normalizeVehicleKey(raw) ?? raw;
    return fleet.find((v) => v.id === key)?.name ?? vehicleByKey(key)?.name ?? null;
  };

  return (
    <section aria-labelledby="incoming-requests" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-5 py-4">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {d.nextBadge}
          </span>
          <div className="min-w-0">
            <h3 id="incoming-requests" className="text-sm font-semibold text-gray-900">{d.nextTitle}</h3>
            <p className="mt-0.5 text-xs text-gray-500">{d.nextDescription}</p>
          </div>
        </header>
        {rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">{d.nextEmpty}</p>
        ) : (
          <ul className="m-0 flex max-h-[420px] min-h-0 flex-1 list-none flex-col divide-y divide-gray-100 overflow-y-auto overscroll-contain p-0 px-5">
            {rows.map((r) => {
              const when = pickupParts(r.at, locale);
              const journey = r.to ? [r.from, r.to].filter(Boolean).join(" → ") : [r.from, r.durationHours ? interpolate(t.requestDetail.durationValue, { hours: r.durationHours }) : null].filter(Boolean).join(" · ");
              const car = carName(r.vehicle);
              const unread = unseen.get(r.id) ?? 0;
              const unreadLabel =
                unread === 1 ? t.requests.partnerMessage : interpolate(t.requests.partnerMessages, { count: unread });
              return (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex items-center gap-4 py-3 no-underline hover:bg-gray-50 sm:-mx-2 sm:rounded-lg">
                    <span className="w-24 shrink-0 text-xs text-gray-500">
                      <span className="block font-semibold tabular-nums text-gray-900">{when.time}</span>
                      {when.date}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {r.isReturn && <span className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">{d.nextReturn}</span>}
                        {journey}
                      </span>
                      <span className="block truncate text-xs text-gray-500">{[r.entity ?? r.name, car].filter(Boolean).join(" · ")}</span>
                    </span>
                    {unread > 0 && (
                      <span
                        className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
                        title={unreadLabel}
                        aria-label={unreadLabel}
                      >
                        {unread}
                      </span>
                    )}
                    <span className="hidden shrink-0 font-mono text-xs text-gray-400 sm:block">{r.reference}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

async function Fleet() {
  const { admin: t } = await dashboardCopy();
  const d = t.dashboard;
  const rows = await fleetStatus();

  return (
    <Card className="flex h-full max-h-[420px] min-h-[16rem] flex-col overflow-hidden">
      <CardHeader
        title={d.fleetLiveTitle}
        icon={<BatteryIcon size={16} />}
        actions={
          <Link
            href="/admin/vehicles"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline whitespace-nowrap"
          >
            {d.manageFleet}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<CarIcon size={18} />} title={d.fleetEmpty} />
      ) : (
        <ul className="m-0 flex max-h-[420px] min-h-0 flex-1 list-none flex-col divide-y divide-zinc-100 overflow-y-auto overscroll-contain p-0 px-5">
          {rows.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-950">{v.name}</span>
                <span className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  <span className="font-mono text-emerald-700 font-semibold">{interpolate(d.batteryPct, { percent: v.batterySoC })}</span>
                  <span>·</span>
                  <span className="font-mono text-zinc-600">{interpolate(d.rangeKm, { km: v.rangeKm })}</span>
                </span>
              </span>
              <Pill tone={v.available ? "good" : "muted"}>{v.available ? d.available : d.switchedOff}</Pill>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto flex shrink-0 items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
        <span>{d.telemetryConnected}</span>
        <span className="font-mono text-[11px] text-emerald-700 font-semibold">● {d.telemetryLive}</span>
      </div>
    </Card>
  );
}


const HEALTH_TONE: Record<HealthState, "good" | "bad" | "muted"> = {
  operational: "good",
  down: "bad",
  notConnected: "muted",
};

async function SystemHealthStatus() {
  const { admin: t } = await dashboardCopy();
  const d = t.dashboard;
  const items = await systemHealth();
  const names: Record<HealthKey, string> = {
    database: d.svcDatabase,
    cdt: d.svcCdt,
    googleMaps: d.svcAddress,
    mollie: d.svcMollie,
    moneybird: d.svcMoneybird,
    whatsappBusiness: d.svcWhatsappBusiness,
  };
  const labels: Record<HealthState, string> = {
    operational: d.stateOperational,
    down: d.stateDown,
    notConnected: d.stateNotConnected,
  };

  return (
    <Card className="flex h-full max-h-[420px] min-h-[16rem] flex-col overflow-hidden">
      <CardHeader title={d.healthTitle} description={d.healthDescription} icon={<ActivityIcon size={16} />} />
      <ul className="m-0 flex max-h-[420px] min-h-0 flex-1 list-none flex-col divide-y divide-zinc-100 overflow-y-auto overscroll-contain p-0 px-5">
        {items.map((item) => (
          <li key={item.key} data-health={item.key} data-state={item.state} className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-medium text-zinc-950">
              {names[item.key]}
              {item.ms !== undefined && (
                <span className="block text-[11px] font-mono text-zinc-400">{interpolate(d.svcDatabaseNote, { ms: item.ms })}</span>
              )}
            </span>
            <Pill tone={HEALTH_TONE[item.state]}>{labels[item.state]}</Pill>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-auto shrink-0 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">{d.healthNote}</p>
    </Card>
  );
}

async function dashboardCopy() {
  const [dict, admin] = await Promise.all([adminDictionary(), requireAdmin()]);
  return { ...dict, locale: admin.locale };
}