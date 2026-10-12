import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { applicationCounts } from "@/lib/admin/applications";
import { listDrivers } from "@/lib/admin/drivers";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { formatTimestamp, isPast } from "@/lib/admin/format";
import { SHIFT_HOURS, SHIFT_MS } from "@/lib/admin/shift";
import {
  ArchiveIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  NoteIcon,
  PlayIcon,
  PlusIcon,
  SteeringIcon,
  StopIcon,
  UndoIcon,
  UsersIcon,
} from "../../_components/icons";
import { Avatar, btn, Card, CardHeader, EmptyState, PageBody, PageHeader, Skeleton, StatCard, StatCardSkeleton } from "../../_components/ui";
import { endShift, setDriverActive, startShift } from "./actions";
import { AddDriverForm } from "./add-driver-form";
import { ShiftCountdown } from "./shift-countdown";
import { SubmitButton } from "./submit-button";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.drivers.title };
}

async function Heading({ part = "title" }: { part?: "title" | "description" | "applications" }) {
  const { admin } = await adminDictionary();
  if (part === "applications") return admin.nav.applications;
  if (part === "description") return fill(admin.drivers.description, { hours: SHIFT_HOURS });
  return admin.drivers.title;
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => (key in values ? String(values[key]) : token));

export default function DriversPage() {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading />
          </Suspense>
        }
        description={
          <Suspense fallback={<span className="inline-block h-[1em] w-72 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading part="description" />
          </Suspense>
        }
        actions={
          <Link href="/admin/drivers/applications" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <NoteIcon className="text-zinc-500" />
            <Suspense fallback={<span className="inline-block h-[1em] w-20 animate-pulse rounded bg-zinc-100 align-middle" />}>
              <Heading part="applications" />
            </Suspense>
            <Suspense fallback={null}>
              <NewApplications />
            </Suspense>
            <ChevronRightIcon className="-mr-1 text-zinc-400" />
          </Link>
        }
      />
      <Suspense fallback={<DriversSkeleton />}>
        <Drivers />
      </Suspense>
    </PageBody>
  );
}

async function NewApplications() {
  const counts = await applicationCounts();
  if (!counts.new) return null;
  return (
    <span className="rounded-full bg-zinc-950 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white" title={`${counts.new} new`}>
      {counts.new}
    </span>
  );
}

type Row = { name: string; phone: string | null; partner: boolean; vehicle: string | null };

async function DriverName({ name, phone, partner, vehicle }: Row) {
  const { admin } = await adminDictionary();
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={name} size="sm" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-950">
          <span className="truncate">{name}</span>
          {partner && (
            <span className="shrink-0 rounded-full bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
              Partner
            </span>
          )}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {phone && (
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-zinc-900 hover:underline">
              {phone}
            </a>
          )}
          {phone && vehicle && " · "}
          {vehicle}
          {!phone && !vehicle && <span className="text-zinc-400">{admin.drivers.noPhone}</span>}
        </p>
      </div>
    </div>
  );
}

async function Drivers() {
  const { admin: dict } = await adminDictionary();
  const t = dict.drivers;
  const [{ onShift, offShift, archived }, apps] = await Promise.all([listDrivers(), applicationCounts()]);
  const partners = [...onShift, ...offShift].filter((r) => r.partner).length;
  const pending = apps.new + apps.reviewing;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          tone="accent"
          label={t.statOnShift}
          value={onShift.length}
          hint={onShift.length ? t.statClocksRunning : t.statNoClocks}
          icon={<ClockIcon />}
        />
        <StatCard label={t.statAvailable} value={offShift.length} hint={t.statReady} icon={<SteeringIcon />} />
        <StatCard
          label={t.statTeam}
          value={onShift.length + offShift.length}
          hint={`${partners} ${partners === 1 ? t.partner : t.partners} · ${archived.length} ${t.inArchive}`}
          icon={<UsersIcon />}
        />
        <StatCard label={t.statApplications} value={pending} hint={`${apps.new} ${t.newCount} · ${apps.reviewing} ${t.inReview}`} icon={<NoteIcon />} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="on-shift-heading" className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex size-2">
              {onShift.length > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
              <span className={`relative inline-flex size-2 rounded-full ${onShift.length ? "bg-emerald-500" : "bg-zinc-300"}`} />
            </span>
            <h2 id="on-shift-heading" className="text-sm font-semibold text-zinc-950">
              {t.onShift} <span className="font-normal text-zinc-400">· {onShift.length}</span>
            </h2>
          </div>
          {onShift.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClockIcon size={18} />}
                title={t.emptyOnShift}
                description={t.emptyOnShiftNote}
              />
            </Card>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {onShift.map((r) => (
                <li key={r.id} className="flex min-w-0 flex-col rounded-xl border border-zinc-200/80 bg-white shadow-card">
                  <div className="flex items-start justify-between gap-3 p-5 pb-0">
                    <DriverName {...r} />
                    {isPast(new Date(r.shiftStartedAt!.getTime() + SHIFT_MS)) ? (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-200">
                        Overtime
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <ShiftCountdown
                      startedAt={r.shiftStartedAt!.toISOString()}
                      copy={{ overLimit: t.overLimit, lessThanHour: t.lessThanHour, remainingOf: t.remainingOf }}
                    />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
                    <span className="text-xs text-zinc-500">Started {formatTimestamp(r.shiftStartedAt!)}</span>
                    <form action={endShift}>
                      <input type="hidden" name="driverId" value={r.id} />
                      <SubmitButton pendingText={t.ending} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                        <StopIcon size={12} /> {t.endShift}
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title={t.availableTitle} description={t.availableNote} icon={<SteeringIcon />} />
            {offShift.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">{t.everyoneOnShift}</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {offShift.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <DriverName {...r} />
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={setDriverActive}>
                        <input type="hidden" name="driverId" value={r.id} />
                        <input type="hidden" name="active" value="false" />
                        <SubmitButton pendingText="…" title={t.archiveTitle} className={`${btn.base} ${btn.ghost} ${btn.sm} px-2 text-zinc-500`}>
                          <ArchiveIcon size={14} />
                          <span className="sr-only">{t.archive}</span>
                        </SubmitButton>
                      </form>
                      <form action={startShift}>
                        <input type="hidden" name="driverId" value={r.id} />
                        <SubmitButton pendingText={t.starting} className={`${btn.base} ${btn.primary} ${btn.sm}`}>
                          <PlayIcon size={11} /> {t.startShift}
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t.addTitle} description={t.addNote} icon={<PlusIcon />} />
            <div className="p-5">
              <AddDriverForm
                copy={{
                  driverName: dict.common.driverName,
                  phone: dict.common.phone,
                  namePlaceholder: t.namePlaceholder,
                  phonePlaceholder: t.phonePlaceholder,
                  adding: t.adding,
                  addDriver: t.addDriver,
                }}
              />
            </div>
          </Card>

          {archived.length > 0 && (
            <details className="group rounded-xl border border-zinc-200/80 bg-white shadow-card">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <span>{t.archived} · {archived.length}</span>
                <ChevronDownIcon className="text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                {archived.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0 opacity-60">
                      <DriverName {...r} />
                    </div>
                    <form action={setDriverActive}>
                      <input type="hidden" name="driverId" value={r.id} />
                      <input type="hidden" name="active" value="true" />
                      <SubmitButton pendingText={t.restoring} className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                        <UndoIcon size={13} /> {t.restore}
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </>
  );
}

function DriversSkeleton() {
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-60 rounded-xl" />
          <Skeleton className="h-60 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </>
  );
}
