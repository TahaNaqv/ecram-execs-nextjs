import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody, PageHeader } from "../../_components/ui";
import { DispatchGrid } from "./dispatch-grid";
import { getDispatchVehicles, getDispatchTrips } from "@/lib/admin/live-queries";

export const metadata: Metadata = {
  title: "Live Dispatch Grid | Ecram Execs",
};

function DispatchSkeleton() {
  return (
    <div className="mt-6 animate-pulse space-y-4">
      <div className="h-10 bg-zinc-100 rounded-xl w-full" />
      <div className="h-96 bg-zinc-100 rounded-xl w-full" />
    </div>
  );
}

async function DispatchContent() {
  const [vehicles, trips] = await Promise.all([getDispatchVehicles(), getDispatchTrips()]);
  return <DispatchGrid vehicles={vehicles} trips={trips} />;
}

export default function LiveDispatchPage() {
  return (
    <PageBody>
      <PageHeader
        title="Live Dispatch Grid & Smart Allocation"
        description="Real-time vehicle telemetry, Schiphol flight buffers, and automated chauffeur allocation."
      />
      <Suspense fallback={<DispatchSkeleton />}>
        <DispatchContent />
      </Suspense>
    </PageBody>
  );
}