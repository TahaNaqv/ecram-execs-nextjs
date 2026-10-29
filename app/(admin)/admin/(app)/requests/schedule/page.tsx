import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { amsterdamToday, daySchedule, shiftDay, UNASSIGNED, type DayBlock, type DayColumn } from "@/lib/admin/schedule";
import { layOut } from "@/lib/fleet/schedule";
import { ChevronLeftIcon, ChevronRightIcon } from "../../../_components/icons";
import { btn, Card, field, PageBody, PageHeader, Skeleton } from "../../../_components/ui";
import { ScrollToMorning } from "./scroll-to-morning";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.schedule.title };
}

/** Pixels per hour on the grid. */
const HOUR_PX = 64;
const GRID_PX = 24 * HOUR_PX;

const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const validDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

async function Heading({ part }: { part: "title" | "description" }) {
  const { admin } = await adminDictionary();
  return admin.schedule[part];
}

async function ViewSwitch() {
  const { admin: t } = await adminDictionary();
  return (
    <nav aria-label={t.schedule.title} className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm">
      <Link href="/admin/requests" className="rounded-md px-3 py-1.5 text-zinc-600 hover:text-zinc-950">
        {t.schedule.viewList}
      </Link>
      <span aria-current="page" className="rounded-md bg-zinc-950 px-3 py-1.5 font-medium text-white">
        {t.schedule.viewSchedule}
      </span>
    </nav>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/admin/requests/schedule">) {
  return (
    <PageBody>
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
            <ViewSwitch />
          </Suspense>
        }
      />
      <Suspense fallback={<Skeleton className="mt-6 h-[480px] w-full" />}>
        <Day searchParams={searchParams as Promise<{ date?: string }>} />
      </Suspense>
    </PageBody>
  );
}

async function Day({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  // Today's date is read below: wait for a real request first, so it is never frozen into a prerendered page
  await connection();
  const sp = await searchParams;
  const today = amsterdamToday();
  const date = validDay(sp.date) ? sp.date : today;
  const [{ admin }, schedule, who] = await Promise.all([adminDictionary(), daySchedule(date), getAdmin()]);
  const t = admin.schedule;
  const heading = new Intl.DateTimeFormat(who?.locale === "nl" ? "nl-NL" : "en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
  const first = schedule.columns.flatMap((c) => c.blocks).reduce<number | null>((min, b) => (min === null || b.start < min ? b.start : min), null);
  const link = (day: string) => `/admin/requests/schedule?date=${day}`;
  const cols = `4rem repeat(${schedule.columns.length}, minmax(11.5rem, 1fr))`;

  return (
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lg font-semibold tracking-tight text-zinc-950">{heading}</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            {interpolate(t.carsAvailable, { available: schedule.carsAvailable, total: schedule.carsTotal })}
            <span aria-hidden="true"> · </span>
            {interpolate(t.jobs, { count: schedule.jobs })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={link(shiftDay(date, -1))} aria-label={t.previousDay} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <ChevronLeftIcon />
          </Link>
          <Link href={link(today)} aria-current={date === today ? "date" : undefined} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            {t.today}
          </Link>
          <Link href={link(shiftDay(date, 1))} aria-label={t.nextDay} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <ChevronRightIcon />
          </Link>
          <form action="/admin/requests/schedule" className="flex items-center gap-2">
            <label htmlFor="schedule-date" className="sr-only">
              {t.dateLabel}
            </label>
            <input id="schedule-date" type="date" name="date" defaultValue={date} className={`${field} h-10`} />
            <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>{t.go}</button>
          </form>
        </div>
      </div>

      <Card className="overflow-hidden">
        <ScrollToMorning hourPx={HOUR_PX} firstMinute={first}>
          <div className="grid min-w-max" style={{ gridTemplateColumns: cols }}>
            {/* Header row: sticky, so the cars stay in view while the hours scroll */}
            <div className="sticky top-0 left-0 z-30 border-b border-r border-zinc-200 bg-zinc-50 px-2 py-3 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{t.timeColumn}</div>
            {schedule.columns.map((c) => (
              <div key={c.key} className="sticky top-0 z-20 border-b border-r border-zinc-200 bg-zinc-50 px-3 py-2.5 text-center last:border-r-0">
                <p className="text-sm font-semibold text-zinc-950">{c.key === UNASSIGNED ? t.unassigned : c.name}</p>
                <p className={`text-xs ${c.state === "available" ? "text-emerald-700" : c.state === null ? "text-zinc-500" : "text-amber-700"}`}>
                  {c.key === UNASSIGNED ? t.unassignedNote : c.state === "available" ? t.available : c.state === "maintenance" ? t.maintenance : c.state === null ? "" : t.switchedOff}
                </p>
              </div>
            ))}

            {/* The hours */}
            <div className="sticky left-0 z-10 border-r border-zinc-200 bg-white" style={{ height: GRID_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="relative text-right" style={{ height: HOUR_PX }}>
                  <span className="absolute -top-2 right-2 bg-white px-0.5 text-[11px] tabular-nums text-zinc-500">{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</span>
                </div>
              ))}
            </div>

            {schedule.columns.map((c) => (
              <Lane key={c.key} column={c} copy={t} />
            ))}
          </div>
        </ScrollToMorning>
      </Card>
      {schedule.jobs === 0 && <p className="text-sm text-zinc-500">{t.empty}</p>}
      <p className="text-xs text-zinc-500">
        {t.bufferNote} {t.legend}
      </p>
    </div>
  );
}

function Lane({ column, copy: t }: { column: DayColumn; copy: Awaited<ReturnType<typeof adminDictionary>>["admin"]["schedule"] }) {
  const off = column.state !== null && column.state !== "available";
  const placed = layOut(column.blocks);
  return (
    <div
      className={`relative border-r border-zinc-200 last:border-r-0 ${off ? "bg-zinc-100/80" : ""}`}
      style={{
        height: GRID_PX,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_PX - 1}px, rgb(228 228 231) ${HOUR_PX - 1}px, rgb(228 228 231) ${HOUR_PX}px)`,
      }}
    >
      {placed.map((b) => (
        <Block key={`${b.id}-${b.leg}`} block={b} lane={b.lane} lanes={b.lanes} copy={t} />
      ))}
    </div>
  );
}

function Block({ block: b, lane, lanes, copy: t }: { block: DayBlock; lane: number; lanes: number; copy: Awaited<ReturnType<typeof adminDictionary>>["admin"]["schedule"] }) {
  const top = (b.start / 60) * HOUR_PX;
  const height = Math.max(((b.tripEnd - b.start) / 60) * HOUR_PX, 30);
  const bufferHeight = ((b.end - b.tripEnd) / 60) * HOUR_PX;
  const width = 100 / lanes;
  const done = b.status === "completed";
  const route = [b.from, b.to].filter(Boolean).join(" → ");
  const who = b.entity ? `${b.name} · ${b.entity}` : b.name;
  return (
    <>
      <Link
        href={`/admin/requests/${b.id}`}
        title={[b.reference, who, route, b.clash ? t.clash : ""].filter(Boolean).join("\n")}
        className={`absolute z-[1] overflow-hidden rounded-md border px-2 py-1 text-[11px] leading-snug shadow-sm transition-shadow hover:z-[5] hover:shadow-md ${
          done ? "border-zinc-300 bg-zinc-100 text-zinc-600" : "border-emerald-400 bg-emerald-50 text-emerald-950"
        } ${b.clash ? "ring-2 ring-red-500" : ""}`}
        style={{ top, height, left: `calc(${lane * width}% + 3px)`, width: `calc(${width}% - 6px)` }}
      >
        <span className="block font-semibold tabular-nums">
          {b.clipsStart ? "…" : clock(b.start)} – {b.clipsEnd && b.tripEnd >= 24 * 60 ? "…" : clock(b.tripEnd)}
          {b.leg === "return" && <span className="ml-1 font-medium text-emerald-700">· {t.returnLeg}</span>}
          {done && <span className="ml-1 font-medium">· {t.completed}</span>}
        </span>
        {b.clash && <span className="sr-only">{t.clash}</span>}
        <span className="block truncate font-mono">{b.reference}</span>
        <span className="block truncate">{who}</span>
        {route && <span className="block truncate text-[10.5px] opacity-80">{route}</span>}
      </Link>
      {bufferHeight > 0 && !done && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-b-md border border-t-0 border-emerald-300/70 bg-[repeating-linear-gradient(45deg,transparent_0,transparent_4px,rgb(167_243_208/0.6)_4px,rgb(167_243_208/0.6)_8px)]"
          style={{ top: top + height, height: Math.max(0, bufferHeight - (height - ((b.tripEnd - b.start) / 60) * HOUR_PX)), left: `calc(${lane * width}% + 3px)`, width: `calc(${width}% - 6px)` }}
        />
      )}
    </>
  );
}
