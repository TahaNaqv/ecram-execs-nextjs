import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { dashboardFigures, fleetStatus, recentRequests, upcomingPickups } from "@/lib/admin/dashboard";
import { formatEuro, formatRelative, pickupParts } from "@/lib/admin/format";
import { systemHealth, type HealthKey, type HealthState } from "@/lib/admin/health";
import { requireAdmin } from "@/lib/auth/session";
import { normalizeVehicleKey, vehicleByKey } from "@/lib/fleet/vehicles";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { serviceLabel } from "@/lib/quotes/constants";
import { ActivityIcon, BatteryIcon, BriefcaseIcon, CalendarIcon, CarIcon, EuroIcon, InboxIcon, MapIcon } from "../_components/icons";
import { StatusBadge } from "../_components/status-badge";
import { Card, CardHeader, EmptyState, PageBody, PageHeader, Skeleton, StatCard, StatCardSkeleton } from "../_components/ui";
import { LiveMap } from "../_components/live-map";

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
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <ScheduleMap />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <Fleet />
        </Suspense>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Suspense fallback={<PanelSkeleton rows={5} />}>
          <Recent />
        </Suspense>
        <Suspense fallback={<PanelSkeleton rows={4} />}>
          <SystemHealthStatus />
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
    <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
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
      <StatCard label={d.partnersLabel} value={partners.total} hint={interpolate(d.partnersHint, { count: partners.recent })} icon={<BriefcaseIcon />} />
      <StatCard
        label={d.revenueLabel}
        value={formatEuro(revenue.amount)}
        hint={interpolate(d.revenueHint, { count: revenue.count })}
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
  const [rows, fleet] = await Promise.all([upcomingPickups(), fleetStatus()]);
  const carName = (raw: string | null) => {
    if (!raw) return null;
    const key = normalizeVehicleKey(raw) ?? raw;
    return fleet.find((v) => v.id === key)?.name ?? vehicleByKey(key)?.name ?? null;
  };

  return (
    <Card>
      <CardHeader
        title="Live Interactive Schedule Map - Amsterdam & Schiphol"
        description="Real-time vehicle GPS tracking & corridor dispatch"
        icon={<MapIcon size={16} />}
        actions={
          <div className="flex items-center gap-2">
            <Pill tone="good">Real-Time</Pill>
            <Link href="/admin/dispatch" className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline whitespace-nowrap">
              Dispatch Grid →
            </Link>
          </div>
        }
      />
      <div className="p-5">
        <LiveMap />

        <h3 className="mt-6 text-[13px] font-semibold text-zinc-950">{d.nextTitle}</h3>
        <p className="mt-0.5 text-xs text-zinc-500">{d.nextDescription}</p>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">{d.nextEmpty}</p>
        ) : (
          <ul className="m-0 mt-3 flex list-none flex-col divide-y divide-zinc-100 p-0">
            {rows.map((r) => {
              const when = pickupParts(r.at, locale);
              const journey = r.to ? [r.from, r.to].filter(Boolean).join(" → ") : [r.from, r.durationHours ? interpolate(t.requestDetail.durationValue, { hours: r.durationHours }) : null].filter(Boolean).join(" · ");
              const car = carName(r.vehicle);
              return (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex items-center gap-4 py-3 no-underline hover:bg-zinc-50 sm:-mx-2 sm:px-2 sm:rounded-lg">
                    <span className="w-24 shrink-0 text-xs text-zinc-500">
                      <span className="block font-semibold tabular-nums text-zinc-950">{when.time}</span>
                      {when.date}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-950">
                        {r.isReturn && <span className="mr-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">{d.nextReturn}</span>}
                        {journey}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">{[r.entity ?? r.name, car].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="hidden shrink-0 font-mono text-xs text-zinc-400 sm:block">{r.reference}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

async function Fleet() {
  const { admin: t, locale } = await dashboardCopy();
  const d = t.dashboard;
  const rows = await fleetStatus();

  return (
    <Card>
      <CardHeader
        title="Executive Fleet Telemetry Feed"
        description="Real-time battery SoC, range, and dispatch availability"
        icon={<BatteryIcon size={16} />}
        actions={
          <Link
            href="/admin/vehicles"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 underline whitespace-nowrap"
          >
            Manage Fleet →
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<CarIcon size={18} />} title={d.fleetEmpty} />
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0 px-5 max-h-[380px] overflow-y-auto">
          {rows.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-950">{v.name}</span>
                <span className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                  <span className="font-mono text-emerald-700 font-semibold">{v.batterySoC}% Battery</span>
                  <span>·</span>
                  <span className="font-mono text-zinc-600">{v.rangeKm} km Range</span>
                </span>
              </span>
              <Pill tone={v.available ? "good" : "muted"}>{v.available ? d.available : d.switchedOff}</Pill>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
        <span>OBD-II &amp; RDW Registry Connected</span>
        <span className="font-mono text-[11px] text-emerald-700 font-semibold">● 100% BEV Telemetry Live</span>
      </div>
    </Card>
  );
}

async function Recent() {
  const { admin: t, services, locale } = await dashboardCopy();
  const d = t.dashboard;
  const rows = await recentRequests();
  return (
    <Card>
      <CardHeader
        title={d.recentTitle}
        description={d.recentDescription}
        icon={<InboxIcon size={16} />}
        actions={
          <Link href="/admin/requests" className="shrink-0 whitespace-nowrap text-xs font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950">
            {d.viewAll}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<InboxIcon size={18} />} title={d.recentEmpty} />
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0 px-5">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/requests/${r.id}`} className="flex items-center gap-3 py-3 no-underline hover:bg-zinc-50 sm:-mx-2 sm:rounded-lg sm:px-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-950">
                    <span className="mr-2 font-mono text-xs text-zinc-400">{r.reference}</span>
                    {serviceLabel(r.service, services)}
                  </span>
                  <span className="block truncate text-xs text-zinc-500">
                    {r.entity ?? r.name} · {formatRelative(r.createdAt, undefined, locale)}
                  </span>
                </span>
                <StatusBadge status={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const HEALTH_LABEL: Record<HealthState, string> = {
  operational: "Operational",
  down: "Down",
  notConnected: "Not Connected",
};

const HEALTH_TONE: Record<HealthState, "good" | "bad" | "muted"> = {
  operational: "good",
  down: "bad",
  notConnected: "muted",
};

async function SystemHealthStatus() {
  const items = await systemHealth();
  const names: Record<HealthKey, string> = {
    database: "PostgreSQL Database",
    cdt: "CDT API (ILT)",
    googleMaps: "Google Maps API",
    mollie: "Mollie Payment API",
    whatsappBusiness: "WhatsApp Business API",
  };

  return (
    <Card>
      <CardHeader title="System Health Status" description="Live integration gateways and real-time environment checks" icon={<ActivityIcon size={16} />} />
      <ul className="m-0 flex list-none flex-col divide-y divide-zinc-100 p-0 px-5">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm font-medium text-zinc-950">
              {names[item.key]}
              {item.ms !== undefined && <span className="block text-[11px] font-mono text-zinc-400">{item.ms}ms response</span>}
            </span>
            <Pill tone={HEALTH_TONE[item.state]}>{HEALTH_LABEL[item.state]}</Pill>
          </li>
        ))}
      </ul>
      <p className="m-0 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">Statuses update dynamically based on live database handshakes and environment keys.</p>
    </Card>
  );
}

async function dashboardCopy() {
  const [dict, admin] = await Promise.all([adminDictionary(), requireAdmin()]);
  return { ...dict, locale: admin.locale };
}