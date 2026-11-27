import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";
import { amsterdamToday, daySchedule, shiftDay, UNASSIGNED, type DayBlock, type DayColumn } from "@/lib/admin/schedule";
import { layOut } from "@/lib/fleet/schedule";
import type { RequestStatus } from "@/lib/quotes/constants";
import { AdminDateField } from "../../../_components/admin-fields";
import { ChevronLeftIcon, ChevronRightIcon } from "../../../_components/icons";
import { btn, Card, PageBody, PageHeader, Skeleton } from "../../../_components/ui";
import { DayMap } from "./day-map";
import { ScrollToMorning } from "./scroll-to-morning";

// Allow blocking dynamic rendering under cacheComponents for this route
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.schedule.title };
}

/** Pixels per hour. Time runs left to right, so an hour is wide enough for the booking line. */
const HOUR_PX = 176;
const GRID_PX = 24 * HOUR_PX;
const LABEL_PX = 176;
const BAR_PX = 76;
const BAR_GAP = 8;

const clock = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const validDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

async function Heading() {
  const { admin } = await adminDictionary();
  return admin.schedule.title;
}

async function BackToBookings() {
  const { admin: t } = await adminDictionary();
  return (
    <Link href="/admin/requests" className={`${btn.base} ${btn.secondary} ${btn.md}`}>
      <ChevronLeftIcon /> {t.common.backToRequests}
    </Link>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/admin/requests/schedule">) {
  return (
    <PageBody>
      <PageHeader
        title={
          <Suspense fallback={<span className="inline-block h-[1em] w-40 animate-pulse rounded bg-zinc-100 align-middle" />}>
            <Heading />
          </Suspense>
        }
        actions={
          <Suspense fallback={null}>
            <BackToBookings />
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
  const [dict, schedule, who] = await Promise.all([adminDictionary(), daySchedule(date), getAdmin()]);
  const admin = dict.admin;
  const t = admin.schedule;
  const serviceName = (key: string) => (dict.services as Record<string, string>)[key] ?? key;
  const locale = who?.locale === "nl" ? "nl-NL" : "en-GB";
  const onToday = date === today;
  const heading = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));
  const dayLabel = onToday
    ? t.today
    : new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`));
  const first = schedule.columns.flatMap((c) => c.blocks).reduce<number | null>((min, b) => (min === null || b.start < min ? b.start : min), null);
  const link = (day: string) => `/admin/requests/schedule?date=${day}`;

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
          <Link
            href={link(today)}
            aria-current={onToday ? "date" : undefined}
            aria-label={onToday ? t.today : interpolate(t.jumpToToday, { day: heading })}
            title={onToday ? undefined : interpolate(t.jumpToToday, { day: heading })}
            className={`${btn.base} ${btn.secondary} ${btn.md}`}
          >
            {dayLabel}
          </Link>
          <Link href={link(shiftDay(date, 1))} aria-label={t.nextDay} className={`${btn.base} ${btn.secondary} ${btn.md}`}>
            <ChevronRightIcon />
          </Link>
          <form action="/admin/requests/schedule" className="flex items-center gap-2">
            <label htmlFor="schedule-date" className="sr-only">
              {t.dateLabel}
            </label>
            <AdminDateField
              key={date}
              id="schedule-date"
              name="date"
              defaultValue={date}
              locale={who?.locale === "nl" ? "nl" : "en"}
              copy={{ chooseDate: admin.common.chooseDate, previousMonth: admin.common.previousMonth, nextMonth: admin.common.nextMonth }}
              submitOnChange
            />
            <button className={`${btn.base} ${btn.secondary} ${btn.md}`}>{t.go}</button>
          </form>
        </div>
      </div>

      <Card className="overflow-hidden">
        <ScrollToMorning hourPx={HOUR_PX} firstMinute={first} labelWidth={LABEL_PX}>
          <div className="min-w-max">
            <div className="sticky top-0 z-30 flex border-b border-zinc-200 bg-zinc-50">
              <div className="sticky left-0 z-40 shrink-0 border-r border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase" style={{ width: LABEL_PX }}>
                {t.timeColumn}
              </div>
              <div className="relative h-8" style={{ width: GRID_PX }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="absolute top-2 text-[11px] tabular-nums text-zinc-500" style={{ left: h * HOUR_PX + 4 }}>
                    {`${String(h).padStart(2, "0")}:00`}
                  </span>
                ))}
              </div>
            </div>
            {schedule.columns.map((c) => (
              <Lane key={c.key} column={c} copy={t} statuses={admin.statuses} serviceName={serviceName} />
            ))}
          </div>
        </ScrollToMorning>
      </Card>
      <Suspense fallback={<Skeleton className="h-[420px] w-full" />}>
        <DayMap trips={schedule.trips} locale={who?.locale === "nl" ? "nl" : "en"} copy={t} />
      </Suspense>
      {schedule.jobs === 0 && <p className="text-sm text-zinc-500">{t.empty}</p>}
      <p className="text-xs text-zinc-500">
        {t.bufferNote} {t.legend} {t.holdLegend}
      </p>
    </div>
  );
}

const TONE: Record<Exclude<RequestStatus, "cancelled">, string> = {
  new: "border-amber-400 bg-amber-50 text-amber-950",
  contacted: "border-amber-400 bg-amber-50 text-amber-950",
  quoted: "border-amber-400 bg-amber-50 text-amber-950",
  confirmed: "border-emerald-500 bg-emerald-50 text-emerald-950",
  completed: "border-zinc-300 bg-zinc-100 text-zinc-600",
};

function Lane({
  column,
  copy: t,
  statuses,
  serviceName,
}: {
  column: DayColumn;
  copy: Awaited<ReturnType<typeof adminDictionary>>["admin"]["schedule"];
  statuses: Record<RequestStatus, string>;
  serviceName: (key: string) => string;
}) {
  const off = column.state !== null && column.state !== "available";
  const placed = layOut(column.blocks);
  const lanes = placed.reduce((n, b) => Math.max(n, b.lanes), 1);
  const height = Math.max(56, lanes * (BAR_PX + BAR_GAP) + BAR_GAP);
  const availability =
    column.key === UNASSIGNED ? t.unassignedNote : column.state === "available" ? t.available : column.state === "maintenance" ? t.maintenance : column.state === null ? "" : t.switchedOff;
  return (
    <div className={`flex border-b border-zinc-200 last:border-b-0 ${off ? "bg-zinc-100/70" : "bg-white"}`}>
      <div className={`sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r border-zinc-200 px-3 ${off ? "bg-zinc-100" : "bg-white"}`} style={{ width: LABEL_PX }}>
        <p className="truncate text-sm font-semibold text-zinc-950">{column.key === UNASSIGNED ? t.unassigned : column.name}</p>
        {column.driverLabel ? <p className="truncate text-[11px] text-zinc-700">{column.driverLabel}</p> : null}
        {availability ? (
          <p className={`truncate text-xs ${column.state === "available" ? "text-emerald-700" : column.state === null ? "text-zinc-500" : "text-amber-700"}`}>{availability}</p>
        ) : null}
      </div>
      <div
        className="relative"
        style={{
          width: GRID_PX,
          height,
          backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${HOUR_PX - 1}px, rgb(228 228 231) ${HOUR_PX - 1}px, rgb(228 228 231) ${HOUR_PX}px)`,
        }}
      >
        {placed.map((b) => (
          <Block key={`${b.id}-${b.leg}`} block={b} lane={b.lane} copy={t} statuses={statuses} serviceName={serviceName} />
        ))}
      </div>
    </div>
  );
}

function Block({
  block: b,
  lane,
  copy: t,
  statuses,
  serviceName,
}: {
  block: DayBlock;
  lane: number;
  copy: Awaited<ReturnType<typeof adminDictionary>>["admin"]["schedule"];
  statuses: Record<RequestStatus, string>;
  serviceName: (key: string) => string;
}) {
  const left = (b.start / 60) * HOUR_PX;
  const width = Math.max(((b.tripEnd - b.start) / 60) * HOUR_PX, 8);
  const bufferWidth = ((b.end - b.tripEnd) / 60) * HOUR_PX;
  const top = BAR_GAP + lane * (BAR_PX + BAR_GAP);
  const route = [b.from, b.to].filter(Boolean).join(" → ");
  const who = b.entity ? `${b.name} · ${b.entity}` : b.name;
  const party = [b.passengers != null ? `${b.passengers} pax` : null, b.luggage != null ? `${b.luggage} bags` : null].filter(Boolean).join(" · ");
  return (
    <>
      <Link
        href={`/admin/requests/${b.id}`}
        title={[serviceName(b.service), b.reference, who, party, route, `${clock(b.start)}–${clock(b.tripEnd)}`, statuses[b.status], b.clash ? t.clash : ""].filter(Boolean).join("\n")}
        className={`absolute z-[1] flex flex-col justify-center overflow-hidden rounded-md border px-2.5 py-1.5 text-[11px] leading-tight shadow-sm hover:z-[5] hover:shadow-md ${TONE[b.status]} ${b.clash ? "ring-2 ring-red-500" : ""}`}
        style={{ top, left, width, height: BAR_PX }}
      >
        <span className="truncate text-[10px] font-medium tracking-wide uppercase opacity-70">
          {serviceName(b.service)}
          {b.leg === "return" ? ` · ${t.returnLeg}` : ""}
        </span>
        <span className="truncate font-mono text-xs font-semibold">{b.reference}</span>
        <span className="truncate font-medium">{who}</span>
        {party ? <span className="truncate opacity-80">{party}</span> : null}
        {b.clash ? <span className="sr-only">{t.clash}</span> : null}
      </Link>
      {bufferWidth > 0 && b.status === "confirmed" && (
        <span
          aria-hidden="true"
          title={t.bufferNote}
          className="pointer-events-none absolute border-y border-r border-amber-300/80 bg-zinc-200 bg-[repeating-linear-gradient(135deg,#d4d4d8_0,#d4d4d8_6px,#fde68a_6px,#fde68a_12px)]"
          style={{ top, left: left + width, width: bufferWidth, height: BAR_PX }}
        />
      )}
    </>
  );
}
