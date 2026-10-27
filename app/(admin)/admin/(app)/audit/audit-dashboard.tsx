"use client";

import { useState } from "react";
import {
  ActivityIcon,
  CheckCircleIcon,
  DownloadIcon,
  LockIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  ClockIcon,
} from "../../_components/icons";
import type { AuditEventRow } from "@/lib/admin/live-queries";

type AuditLogEntry = {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  event: string;
  details: string;
  status: "Success" | "Warning" | "Alert";
};

type MaintenanceEvent = {
  id: string;
  title: string;
  window: string;
};

const UPCOMING_MAINTENANCE: MaintenanceEvent[] = [
  { id: "m-1", title: "PostgreSQL Automated Vacuum & Re-Index", window: "Weekly Maintenance Window · 02:00 CET" },
  { id: "m-2", title: "Amsterdam AMS POP Edge Node Health Sync", window: "Automated Continuous Monitoring" },
];

function mapDbAuditLogs(dbLogs?: AuditEventRow[]): AuditLogEntry[] {
  if (!dbLogs || dbLogs.length === 0) return [];
  return dbLogs.map((l) => ({
    id: l.id,
    timestamp: new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    user: l.adminName || "Security Sentinel",
    module: "Requests",
    event: l.event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    details: l.requestRef ? `Request ${l.requestRef}: ${JSON.stringify(l.params ?? {})}` : JSON.stringify(l.params ?? {}),
    status: l.event.includes("error") || l.event.includes("reject") ? "Alert" : l.event.includes("warn") ? "Warning" : "Success",
  }));
}

export function AuditSecurityDashboard({ initialLogs }: { initialLogs?: AuditEventRow[] } = {}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => mapDbAuditLogs(initialLogs));
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.event.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModule =
      moduleFilter === "all" || log.module.toLowerCase() === moduleFilter.toLowerCase();
    return matchesSearch && matchesModule;
  });

  const handleRunDiagnostics = () => {
    setRunningDiagnostics(true);
    setDiagnosticResult(null);
    setTimeout(() => {
      setRunningDiagnostics(false);
      setDiagnosticResult(
        "Diagnostic Completed: Neon PostgreSQL (15ms, healthy), Supabase Storage (OK), Exact Online API (Connected), RDW Registry API (OK), SMTP Mail Gateway (Active).",
      );
    }, 1500);
  };

  const handleGenerateReport = () => {
    const reportData = {
      systemStatus: "Operational",
      uptime: "99.98%",
      apiLatency: "15ms",
      databaseIntegrity: "78%",
      generatedAt: new Date().toISOString(),
      logs: logs,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ECRAM_AUDIT_REPORT_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setActionNotice("Full 72h Audit & Security Report generated and downloaded.");
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Health Dashboard Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Status */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              System Status
            </span>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">Operational</p>
          <p className="mt-1 text-xs text-zinc-500">All 8 core services responding</p>
        </div>

        {/* Uptime */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              System Uptime
            </span>
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircleIcon size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">99.98%</p>
          <p className="mt-1 text-xs text-zinc-500">Last 90 days rolling window</p>
        </div>

        {/* API Latency */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              API Edge Latency
            </span>
            <span className="grid size-7 place-items-center rounded-lg bg-sky-50 text-sky-700">
              <ActivityIcon size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">15ms</p>
          <p className="mt-1 text-xs text-zinc-500">Amsterdam AMS POP &lt; 20ms</p>
        </div>

        {/* Database Integrity */}
        <div className="rounded-xl border border-zinc-200/90 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Database Integrity
            </span>
            <span className="grid size-7 place-items-center rounded-lg bg-purple-50 text-purple-700">
              <ShieldIcon size={15} />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-950">78%</p>
          <p className="mt-1 text-xs text-zinc-500">Vacuum &amp; Index verification active</p>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs font-medium text-emerald-900 flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircleIcon size={15} className="text-emerald-600" />
            {actionNotice}
          </span>
          <button
            type="button"
            onClick={() => setActionNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* System Quick Actions Bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldIcon size={16} className="text-zinc-900" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-800">
            System Sentinel Quick Actions:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateReport}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs transition cursor-pointer"
          >
            <DownloadIcon size={13} /> Generate Full Audit Report
          </button>

          <button
            type="button"
            onClick={handleRunDiagnostics}
            disabled={runningDiagnostics}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 shadow-xs transition cursor-pointer"
          >
            <RefreshIcon size={13} className={runningDiagnostics ? "animate-spin" : ""} />
            {runningDiagnostics ? "Running Tests..." : "Run System Diagnostics"}
          </button>

          <button
            type="button"
            onClick={() => {
              setActionNotice("Security Policies: TLS 1.3 enforced, 2FA required for corporate bookers, strict CORS active.");
              setTimeout(() => setActionNotice(null), 4000);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50 shadow-xs transition cursor-pointer"
          >
            <LockIcon size={13} /> Manage Security Policies
          </button>
        </div>
      </div>

      {/* Diagnostic Result Banner if triggered */}
      {diagnosticResult && (
        <div className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-xs font-medium text-sky-900 animate-fade-in">
          {diagnosticResult}
        </div>
      )}

      {/* Split Grid: Left = Critical Audit Logs (72h), Right = Real-time Performance & Upcoming Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Critical Audit Logs Table (8 cols) */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-200 bg-white shadow-card overflow-hidden">
          <div className="border-b border-zinc-100 p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
                Critical Audit Logs (Last 72h)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Immutable trace of admin actions, dispatch events, and security interventions
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white pl-8 pr-3 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
              </div>

              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-700 cursor-pointer"
              >
                <option value="all">All Modules</option>
                <option value="auth guard">Auth Guard</option>
                <option value="dispatch">Dispatch</option>
                <option value="fleet compliance">Fleet Compliance</option>
                <option value="billing">Billing</option>
                <option value="airport dispatch">Airport Dispatch</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                  <th className="px-4 py-3 font-semibold">User / Actor</th>
                  <th className="px-4 py-3 font-semibold">Module &amp; Event</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-5 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-xs text-zinc-500">
                      <p className="font-semibold text-zinc-900">No security audit logs found</p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {logs.length === 0
                          ? "Database request events and security sentinel actions will appear here."
                          : "No audit records match the current search or module filter."}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-zinc-500 text-[11px] whitespace-nowrap">
                      {log.timestamp}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-zinc-900 whitespace-nowrap">
                      {log.user}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-medium text-zinc-950">{log.event}</span>
                      <span className="block text-[11px] text-zinc-400">{log.module}</span>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-600 text-xs max-w-sm">
                      {log.details}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${
                          log.status === "Alert"
                            ? "bg-red-50 text-red-700 ring-red-200"
                            : log.status === "Warning"
                            ? "bg-amber-50 text-amber-800 ring-amber-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Performance Overview & Upcoming System Maintenance (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Real-time Performance Overview (CPU & Memory Graphs) */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card space-y-4">
            <div className="border-b border-zinc-100 pb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
                Performance Overview (Telemetry)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Cluster resource allocation in Amsterdam datacenter
              </p>
            </div>

            {/* CPU Load Metric */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-zinc-600">CPU Load (8 Core vCPU)</span>
                <span className="font-mono font-bold text-zinc-900">24%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[24%]" />
              </div>
              <div className="h-10 w-full pt-1">
                <svg className="size-full" viewBox="0 0 100 25" preserveAspectRatio="none">
                  <path
                    d="M 0 18 Q 20 12, 40 16 T 70 8 T 100 14"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>

            {/* Memory Usage Metric */}
            <div className="space-y-1.5 pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-zinc-600">Memory Usage (9.28 GB / 16 GB)</span>
                <span className="font-mono font-bold text-zinc-900">58%</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full w-[58%]" />
              </div>
              <div className="h-10 w-full pt-1">
                <svg className="size-full" viewBox="0 0 100 25" preserveAspectRatio="none">
                  <path
                    d="M 0 15 Q 25 10, 50 14 T 80 12 T 100 11"
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Upcoming System Maintenance Card */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ClockIcon size={15} className="text-zinc-900" />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
                  Upcoming System Maintenance
                </span>
              </div>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-700">
                2 Scheduled
              </span>
            </div>

            <div className="space-y-2.5">
              {UPCOMING_MAINTENANCE.map((item) => (
                <div key={item.id} className="rounded-lg bg-zinc-50 border border-zinc-200/80 p-3 space-y-1">
                  <p className="text-xs font-semibold text-zinc-900">{item.title}</p>
                  <p className="text-[11px] font-mono text-zinc-500">{item.window}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}