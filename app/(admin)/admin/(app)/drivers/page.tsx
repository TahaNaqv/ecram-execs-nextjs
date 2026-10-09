import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { applicationCounts } from "@/lib/admin/applications";
import { listDrivers } from "@/lib/admin/drivers";
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

export const metadata: Metadata = { title: "Drivers" };

export default function DriversPage() {
  return (
    <PageBody>
      <PageHeader
        title="Drivers"
        description={`Start a driver's shift and their ${SHIFT_HOURS}-hour clock begins counting down.`}
        actions={
          <Link href="/admin/drivers/applications" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <NoteIcon className="text-zinc-500" />
            Applications
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

function DriverName({ name, phone, partner, vehicle }: Row) {
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
          {!phone && !vehicle && <span className="text-zinc-400">No phone on file</span>}
        </p>
      </div>
    </div>
  );
}

async function Drivers() {
  const [{ onShift, offShift, archived }, apps] = await Promise.all([listDrivers(), applicationCounts()]);
  const partners = [...onShift, ...offShift].filter((r) => r.partner).length;
  const pending = apps.new + apps.reviewing;

  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          tone="accent"
          label="On shift"
          value={onShift.length}
          hint={onShift.length ? "Clocks running" : "No clocks running"}
          icon={<ClockIcon />}
        />
        <StatCard label="Available" value={offShift.length} hint="Ready to start a shift" icon={<SteeringIcon />} />
        <StatCard
          label="Team"
          value={onShift.length + offShift.length}
          hint={`${partners} ${partners === 1 ? "partner" : "partners"} · ${archived.length} in archive`}
          icon={<UsersIcon />}
        />
        <StatCard label="Applications to review" value={pending} hint={`${apps.new} new · ${apps.reviewing} in review`} icon={<NoteIcon />} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="on-shift-heading" className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <span className="relative flex size-2">
              {onShift.length > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
              <span className={`relative inline-flex size-2 rounded-full ${onShift.length ? "bg-emerald-500" : "bg-zinc-300"}`} />
            </span>
            <h2 id="on-shift-heading" className="text-sm font-semibold text-zinc-950">
              On shift <span className="font-normal text-zinc-400">· {onShift.length}</span>
            </h2>
          </div>
          {onShift.length === 0 ? (
            <Card>
              <EmptyState
                icon={<ClockIcon size={18} />}
                title="No drivers on shift"
                description="Start a shift from the available list and the driver's clock appears here."
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
                    <ShiftCountdown startedAt={r.shiftStartedAt!.toISOString()} />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3">
                    <span className="text-xs text-zinc-500">Started {formatTimestamp(r.shiftStartedAt!)}</span>
                    <form action={endShift}>
                      <input type="hidden" name="driverId" value={r.id} />
                      <SubmitButton pendingText="Ending…" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                        <StopIcon size={12} /> End shift
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
            <CardHeader title="Available" description="Fleet and partner drivers ready to start" icon={<SteeringIcon />} />
            {offShift.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">Everyone is on shift.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {offShift.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <DriverName {...r} />
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={setDriverActive}>
                        <input type="hidden" name="driverId" value={r.id} />
                        <input type="hidden" name="active" value="false" />
                        <SubmitButton pendingText="…" title="Archive driver" className={`${btn.base} ${btn.ghost} ${btn.sm} px-2 text-zinc-500`}>
                          <ArchiveIcon size={14} />
                          <span className="sr-only">Archive</span>
                        </SubmitButton>
                      </form>
                      <form action={startShift}>
                        <input type="hidden" name="driverId" value={r.id} />
                        <SubmitButton pendingText="Starting…" className={`${btn.base} ${btn.primary} ${btn.sm}`}>
                          <PlayIcon size={11} /> Start shift
                        </SubmitButton>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Add a driver" description="Partners join automatically when their application is approved" icon={<PlusIcon />} />
            <div className="p-5">
              <AddDriverForm />
            </div>
          </Card>

          {archived.length > 0 && (
            <details className="group rounded-xl border border-zinc-200/80 bg-white shadow-card">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                <span>Archived · {archived.length}</span>
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
                      <SubmitButton pendingText="Restoring…" className={`${btn.base} ${btn.secondary} ${btn.sm}`}>
                        <UndoIcon size={13} /> Restore
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
