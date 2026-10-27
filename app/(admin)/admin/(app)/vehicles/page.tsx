export const instant = false;
import { requireAdmin } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Suspense } from "react";
import { adminDictionary } from "@/lib/i18n/get-dictionary";
import { FleetComplianceSentinel } from "./compliance-sentinel";
import { getAllVehicles } from "@/lib/admin/live-queries";

export async function generateMetadata(): Promise<Metadata> {
  const { admin } = await adminDictionary();
  return { title: admin?.vehicles?.title ?? "Fleet & Compliance Management" };
}

function VehiclesSkeleton() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-pulse">
      <div className="h-8 w-64 bg-zinc-100 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-zinc-200 h-28" />
        ))}
      </div>
      <div className="h-96 bg-white rounded-xl border border-zinc-200" />
    </div>
  );
}

async function VehiclesContent() {
  await requireAdmin();
  const { admin } = await adminDictionary();
  const t = admin?.vehicles ?? {
    title: "Fleet & Compliance Sentinel",
    description:
      "Manage luxury electric vehicle inventory, ILT compliance telemetry, and automated driver credential blocks.",
  };
  const vehicles = await getAllVehicles();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{t.title}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t.description}</p>
      </div>
      <FleetComplianceSentinel vehicles={vehicles} />
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