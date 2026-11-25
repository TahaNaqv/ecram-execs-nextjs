export const instant = false;
import type { Metadata } from "next";
import { applicationCounts } from "@/lib/admin/applications";
import { listDrivers } from "@/lib/admin/drivers";
import { driverBoard } from "@/lib/admin/driver-board";
import { getAdmin } from "@/lib/auth/session";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { amsterdamToday } from "@/lib/drivers/time";
import { AssignmentBoard } from "./assignment-board";
import { DriversClient } from "./drivers-client";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.drivers.title };
}

export default async function DriversPage({ searchParams }: PageProps<"/admin/drivers">) {
  const [{ admin: dict }, who] = await Promise.all([adminDictionary(), getAdmin()]);
  const t = dict.drivers;
  const raw = (await searchParams).date;
  const requested = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : amsterdamToday();
  const [{ onShift, offShift, archived }, apps, board] = await Promise.all([listDrivers(), applicationCounts(), driverBoard(date)]);
  const partners = [...onShift, ...offShift].filter((r) => r.partner).length;
  const pending = apps.new + apps.reviewing;

  return (
    <DriversClient
      onShift={onShift}
      offShift={offShift}
      archived={archived}
      apps={apps}
      partners={partners}
      pending={pending}
      dict={dict}
      t={t}
      board={
        <AssignmentBoard
          date={board.date}
          locale={who?.locale === "nl" ? "nl-NL" : "en-GB"}
          drivers={board.drivers}
          vehicles={board.vehicles}
          assignments={board.assignments}
          breaks={board.breaks}
          shifts={board.shifts}
          copy={t}
        />
      }
    />
  );
}