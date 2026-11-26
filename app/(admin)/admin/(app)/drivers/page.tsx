export const instant = false;
import type { Metadata } from "next";
import { applicationCounts } from "@/lib/admin/applications";
import { driverBoard, linksAround, formatBoardClock } from "@/lib/admin/driver-board";
import { listDrivers } from "@/lib/admin/drivers";
import { getAdmin } from "@/lib/auth/session";
import { amsterdamToday, utcToAmsterdamParts } from "@/lib/drivers/time";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { DriversClient, type DeskBreak, type DeskRow } from "./drivers-client";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.drivers.title };
}

function shiftDate(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}

export default async function DriversPage({ searchParams }: PageProps<"/admin/drivers">) {
  const [{ admin: dict }, who] = await Promise.all([adminDictionary(), getAdmin()]);
  const raw = (await searchParams).date;
  const requested = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : amsterdamToday();
  const [{ onShift, offShift, archived }, apps, board, links] = await Promise.all([listDrivers(), applicationCounts(), driverBoard(date), linksAround(date)]);
  const locale = who?.locale === "nl" ? "nl-NL" : "en-GB";
  const clock = (instant: Date) => formatBoardClock(instant, locale);

  const rows: DeskRow[] = [...onShift, ...offShift].map((driver) => {
    const links = board.assignments.filter((row) => row.driverId === driver.id);
    const primary = links[0] ?? null;
    const worst = links.reduce<(typeof links)[number] | null>((picked, row) => {
      const rank = { green: 0, yellow: 1, red: 2 };
      if (!picked || rank[row.compliance] > rank[picked.compliance]) return row;
      return picked;
    }, primary);
    const shift = board.shifts.find((row) => row.driverId === driver.id && row.status === "active" && !row.end) ?? board.shifts.find((row) => row.driverId === driver.id) ?? null;
    const startParts = shift ? utcToAmsterdamParts(shift.start) : null;
    const endParts = shift?.end ? utcToAmsterdamParts(shift.end) : null;
    const breaks: DeskBreak[] = board.breaks
      .filter((block) => block.driverId === driver.id)
      .map((block) => ({ id: block.id, label: `${clock(block.start)}–${clock(block.end)}${block.notes ? ` · ${block.notes}` : ""}` }));
    return {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      partner: driver.partner,
      onShift: Boolean(driver.shiftStartedAt),
      startedAt: driver.shiftStartedAt ? driver.shiftStartedAt.toISOString() : null,
      vehicleLabel: links.map((row) => row.vehicleLabel).join(", ") || null,
      assignmentId: primary?.id ?? null,
      window: primary ? `${clock(primary.start)}–${clock(primary.end)}` : null,
      entireShift: Boolean(primary?.isEntireShift),
      workedMin: worst?.workedMin ?? 0,
      breakMin: worst?.breakMin ?? 0,
      requiredMin: worst?.requiredMin ?? 0,
      compliance: worst?.compliance ?? null,
      shift: shift
        ? {
            id: shift.id,
            status: shift.status,
            startDate: startParts?.date ?? date,
            startTime: startParts?.time ?? "08:00",
            endDate: endParts?.date ?? "",
            endTime: endParts?.time ?? "",
          }
        : null,
      breaks,
    };
  });

  return (
    <DriversClient
      date={date}
      previous={shiftDate(date, -1)}
      next={shiftDate(date, 1)}
      today={amsterdamToday()}
      locale={locale}
      rows={rows}
      archived={archived.map((driver) => ({ id: driver.id, name: driver.name, phone: driver.phone }))}
      drivers={board.drivers}
      vehicles={board.vehicles}
      links={links}
      adminLocale={who?.locale === "nl" ? "nl" : "en"}
      appsNew={apps.new}
      dict={dict}
    />
  );
}
