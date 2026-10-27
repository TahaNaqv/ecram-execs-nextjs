"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTimestamp, isPast } from "@/lib/admin/format";
import { SHIFT_MS } from "@/lib/admin/shift";
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
  XIcon,
} from "../../_components/icons";
import { Avatar, btn, Card, CardHeader, EmptyState, PageBody, PageHeader, StatCard } from "../../_components/ui";
import { endShift, setDriverActive, startShift } from "./actions";
import { AddDriverForm } from "./add-driver-form";
import { ShiftCountdown } from "./shift-countdown";
import { SubmitButton } from "./submit-button";

function NewApplications({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="rounded-full bg-zinc-950 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white" title={`${count} new`}>
      {count}
    </span>
  );
}

function DriverName({ name, phone, partner, vehicle }: { name: string; phone: string | null; partner: boolean; vehicle: string | null }) {
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
        </p>
      </div>
    </div>
  );
}

export function DriversClient({ onShift, offShift, archived, apps, partners, pending, dict, t, description }: any) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <PageBody>
      <PageHeader
        title={t.title}
        description={description}
        actions={
          <Link href="/admin/drivers/applications" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <NoteIcon className="text-zinc-500" />
            <span>{dict.nav.applications}</span>
            <NewApplications count={apps.new} />
            <ChevronRightIcon className="-mr-1 text-zinc-400" />
          </Link>
        }
      />

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

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* Left Column: On Shift Drivers */}
        <section aria-labelledby="on-shift-heading" className="min-w-0 flex flex-col">
          <div className="mb-3 flex items-center justify-between h-8">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                {onShift.length > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                <span className={`relative inline-flex size-2 rounded-full ${onShift.length ? "bg-emerald-500" : "bg-zinc-300"}`} />
              </span>
              <h2 id="on-shift-heading" className="text-sm font-semibold text-zinc-950">
                {t.onShift} <span className="font-normal text-zinc-400">· {onShift.length}</span>
              </h2>
            </div>
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
              {onShift.map((r: any) => (
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

        {/* Right Column: Add Driver Button aligned with left header + Available Shift */}
        <div className="flex min-w-0 flex-col">
          <div className="mb-3 flex items-center justify-between h-8">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="w-full bg-zinc-900 hover:bg-black text-white font-semibold py-1.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              
              <span> + Add New Driver </span>
            </button>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader title={t.availableTitle} description={t.availableNote} icon={<SteeringIcon />} />
              {offShift.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-zinc-500">{t.everyoneOnShift}</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {offShift.map((r: any) => (
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

            {archived.length > 0 && (
              <details className="group rounded-xl border border-zinc-200/80 bg-white shadow-card">
                <summary className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl px-5 py-3.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  <span>{t.archived} · {archived.length}</span>
                  <ChevronDownIcon className="text-zinc-400 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                  {archived.map((r: any) => (
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
      </div>

      {/* Add Driver Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 p-1 cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            <h3 className="text-base font-semibold text-zinc-950 mb-1">Register New Driver</h3>
            <p className="text-xs text-zinc-500 mb-4">Add a verified chauffeur or partner driver to the roster.</p>
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
        </div>
      )}
    </PageBody>
  );
}