export const instant = false;
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { FleetComplianceSentinel } from "./compliance-sentinel";
import { getAllVehicles, getFleetUsage, getUpcomingServices } from "@/lib/admin/live-queries";
import { formatStamp } from "@/lib/corporate/format";
import { fleetBaseSetting } from "@/lib/fleet/base-store";
import { interpolate } from "@/lib/i18n/interpolate";
import { FleetBaseCard } from "./base-card";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin?.vehicles?.title ?? "Fleet & Compliance Management" };
}

function VehiclesSkeleton() {
  return (
    <div className="p-8 w-full space-y-8 animate-pulse">
      <div className="h-8 w-64 bg-zinc-100 rounded" />
      <div className="h-96 bg-white rounded-xl border border-zinc-200" />
    </div>
  );
}

async function VehiclesContent() {
  const me = await requireAdmin();
  const { admin } = await adminDictionary();
  const t = admin?.vehicles ?? {
    title: "Fleet & Compliance Sentinel",
    description:
      "Manage luxury electric vehicle inventory, ILT compliance telemetry, and automated driver credential blocks.",
  };
  const [vehicles, base, usage, services] = await Promise.all([getAllVehicles(), fleetBaseSetting(), getFleetUsage(), getUpcomingServices()]);
  const saved = base.updatedAt
    ? interpolate(base.updatedBy ? admin.vehicles.baseSavedBy : admin.vehicles.baseSavedAt, { name: base.updatedBy ?? "", when: formatStamp(base.updatedAt, me.locale) })
    : null;

  return (
    <div className="p-6 md:p-8 w-full space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t.title}</h1>
      <FleetBaseCard key={`${base.base?.address ?? ""}|${base.base?.placeId ?? ""}`} base={base.base} saved={saved} locale={me.locale} copy={admin.vehicles} />
      <FleetComplianceSentinel
        vehicles={vehicles}
        services={services}
        usage={usage}
        copy={admin.vehicles}
        locale={me.locale}
        dateCopy={{ chooseDate: admin.common.chooseDate, previousMonth: admin.common.previousMonth, nextMonth: admin.common.nextMonth }}
      />
    </div>
  );
}

export default function AdminVehiclesPage() {
  return (
    <Suspense fallback={<VehiclesSkeleton />}>
      <VehiclesContent />
    </Suspense>
  );
}