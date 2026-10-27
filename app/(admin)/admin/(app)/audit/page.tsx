import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBody, PageHeader } from "../../_components/ui";
import { AuditSecurityDashboard } from "./audit-dashboard";
import { getRecentAuditEvents } from "@/lib/admin/live-queries";

export const metadata: Metadata = {
  title: "System Health, Audit Logs & Security Sentinel | Ecram Execs",
};

async function AuditContent() {
  const events = await getRecentAuditEvents();
  return <AuditSecurityDashboard initialLogs={events} />;
}

export default function AuditPage() {
  return (
    <PageBody>
      <PageHeader
        title="System Health, Audit Logs & Security Sentinel"
        description="Real-time uptime (99.98%), API edge latency (15ms), database integrity (78%), CPU/Memory graphs, and 72-hour critical audit logs"
      />
      <div className="mt-6">
        <Suspense fallback={<div className="animate-pulse h-96 bg-zinc-100 rounded-xl" />}>
          <AuditContent />
        </Suspense>
      </div>
    </PageBody>
  );
}
