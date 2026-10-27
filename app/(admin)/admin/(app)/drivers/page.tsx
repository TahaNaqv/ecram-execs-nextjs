export const instant = false;
import type { Metadata } from "next";
import { applicationCounts } from "@/lib/admin/applications";
import { listDrivers } from "@/lib/admin/drivers";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { SHIFT_HOURS } from "@/lib/admin/shift";
import { DriversClient } from "./drivers-client";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin.drivers.title };
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => (key in values ? String(values[key]) : token));

export default async function DriversPage() {
  const { admin: dict } = await adminDictionary();
  const t = dict.drivers;
  const [{ onShift, offShift, archived }, apps] = await Promise.all([listDrivers(), applicationCounts()]);
  const partners = [...onShift, ...offShift].filter((r) => r.partner).length;
  const pending = apps.new + apps.reviewing;
  const description = fill(t.description, { hours: SHIFT_HOURS });

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
      description={description}
    />
  );
}