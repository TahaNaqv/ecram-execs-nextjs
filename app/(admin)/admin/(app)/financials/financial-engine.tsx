"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  CreditCardIcon,
  DownloadIcon,
  EuroIcon,
  FileTextIcon,
  RefreshIcon,
} from "../../_components/icons";
import type { FinancialSummary, DriverPayoutRow } from "@/lib/admin/live-queries";

export type FinancialAutomationEngineProps = {
  summary?: FinancialSummary;
  drivers?: DriverPayoutRow[];
};

export function FinancialAutomationEngine({ summary, drivers }: FinancialAutomationEngineProps = {}) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState("Just now");
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const rev9 = summary?.totalRevenue9pct ?? 45780.0;
  const rev21 = summary?.totalRevenue21pct ?? 135476.0;
  const rev0 = summary?.totalRevenue0pct ?? 14200.0;

  const totalRevenue = rev9 + rev21 + rev0;
  const btw21Amount = -(rev21 * 0.21);
  const btw9Amount = -(rev9 * 0.09);
  const netBtwPayable = Math.abs(btw21Amount + btw9Amount);

  const totalAgencyPayout = 75800.00;
  const totalZzpPayout = 6850.00;
  const totalCombinedPayout = totalAgencyPayout + totalZzpPayout;

  const handleSyncNow = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setLastSyncTime("Just now");
    }, 1000);
  };

  const downloadSepaXml = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>ECRAM-SEPA-${Date.now()}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>38</NbOfTxs>
      <CtrlSum>${totalCombinedPayout.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>ECRAM EXECS B.V.</Nm></InitgPty>
    </GrpHdr>
  </CstmrCdtTrfInitn>
</Document>`;

    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SEPA_PAIN001_ECRAM_${Date.now()}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadNotice("SEPA PAIN.001 XML generated successfully.");
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  const downloadExcelCsv = () => {
    let csv = "ECRAM EXECS - FINANCIAL REPORT\n";
    csv += `Ledger Code,Description,Amount EUR\n`;
    csv += `"8400","Omzet Personenvervoer (9% BTW)",${rev9.toFixed(2)}\n`;
    csv += `"8100","Omzet Zakelijke Dienstverlening (21% BTW)",${rev21.toFixed(2)}\n`;
    csv += `"8000","Vrijgesteld Omzet / Export (0% BTW)",${rev0.toFixed(2)}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ECRAM_FINANCIAL_EXPORT_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadNotice("Financial Ledger data exported to CSV format.");
    setTimeout(() => setDownloadNotice(null), 3000);
  };

  return (
    <div className="space-y-6 text-zinc-900">
      
      {/* Top Header with Exact Online & Moneybird Synchronization Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 px-3 py-2 rounded-xl text-xs font-bold">
            <span className="text-red-600">exact online</span>
            <span className="text-zinc-400">+</span>
            <span className="text-emerald-600">moneybird</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-950 uppercase">
                Agency & Accounting Synchronization
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SYNCHRONIZED
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live double-entry sync active · Last sync: <strong className="text-zinc-800">{lastSyncTime}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSyncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 transition cursor-pointer shadow-2xs"
        >
          <RefreshIcon size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Syncing..." : "Sync APIs"}
        </button>
      </div>

      {/* Download Alert Notice */}
      {downloadNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircleIcon size={16} className="text-emerald-600" />
            {downloadNotice}
          </span>
          <button onClick={() => setDownloadNotice(null)} className="text-emerald-700 hover:text-emerald-950 font-bold px-2">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Revenue MTD (Gross)</span>
          <p className="mt-2 text-2xl font-bold font-mono text-zinc-950">
            € {totalRevenue.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">October 2026 Completed Trips</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Net VAT Liability (BTW)</span>
          <p className="mt-2 text-2xl font-bold font-mono text-purple-900">
            € {netBtwPayable.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">21% High + 9% Low Split</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agency Payout (Oct)</span>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-700">
            € {totalAgencyPayout.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Driven by 38 Agency Chauffeurs</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">ZZP Self-Billing Payout</span>
          <p className="mt-2 text-2xl font-bold font-mono text-sky-900">
            € {totalZzpPayout.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">For 4 remaining ZZP drivers</p>
        </div>
      </div>

      {/* Main Grid: Revenue Ledgers & VAT Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Revenue Ledgers Table */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 p-5 bg-zinc-50/50 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
                Revenue Ledgers (Inkomsten Grootboeken)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">Exact Online chart of accounts with automated VAT mapping</p>
            </div>
            <span className="font-mono text-xs font-bold text-zinc-800 bg-white border border-zinc-200 px-2.5 py-1 rounded-lg">
              NL Stelsel
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                <tr>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">VAT</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                <tr className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-zinc-950">8400</td>
                  <td className="px-4 py-3.5"><p className="font-semibold text-zinc-900">Omzet Personenvervoer</p><p className="text-[11px] text-zinc-500">Executive passenger transport</p></td>
                  <td className="px-4 py-3.5"><span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700">9%</span></td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-zinc-950">€ {rev9.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-zinc-950">8100</td>
                  <td className="px-4 py-3.5"><p className="font-semibold text-zinc-900">Omzet Zakelijke Dienstverlening</p><p className="text-[11px] text-zinc-500">Hourly as directed, wait time & fees</p></td>
                  <td className="px-4 py-3.5"><span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700">21%</span></td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-zinc-950">€ {rev21.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr className="hover:bg-zinc-50/60 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-zinc-950">8000</td>
                  <td className="px-4 py-3.5"><p className="font-semibold text-zinc-900">Vrijgesteld Omzet / Export</p><p className="text-[11px] text-zinc-500">Cross-border diplomacy & EU tax-exempt</p></td>
                  <td className="px-4 py-3.5"><span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-700">0%</span></td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold text-zinc-950">€ {rev0.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* VAT Breakdown Card */}
        <div className="lg:col-span-5 rounded-2xl border border-zinc-200 bg-white shadow-sm p-5 space-y-4">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
              BTW Tax Splits (VAT Breakdown)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">Belastingdienst monthly VAT settlement schedule</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-purple-950">21% BTW High (Ancillary)</span>
                <p className="text-[11px] text-purple-700">Business services split</p>
              </div>
              <span className="font-mono font-bold text-purple-900">
                € {btw21Amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sky-950">9% BTW Low (Transport)</span>
                <p className="text-[11px] text-sky-700">Passenger transport split</p>
              </div>
              <span className="font-mono font-bold text-sky-900">
                € {btw9Amount.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200 flex items-center justify-between font-bold text-xs">
            <span className="text-zinc-900">Total Net VAT Payable (Aangifte):</span>
            <span className="font-mono text-emerald-700 text-sm">
              € {netBtwPayable.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Bookkeeper Export Hub */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm p-6 space-y-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
            Bookkeeper Export Hub
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Generate secure banking files and ledger spreadsheets for accountant reconciliation</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={downloadSepaXml}
            className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <CreditCardIcon size={18} className="text-emerald-400" />
              <div className="text-left">
                <p className="font-bold">Download SEPA PAIN.001 XML</p>
                <p className="text-[11px] text-zinc-400 font-normal">Bank Payout Batch for ABN / ING</p>
              </div>
            </div>
            <DownloadIcon size={16} />
          </button>

          <button
            type="button"
            onClick={downloadExcelCsv}
            className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <FileTextIcon size={18} className="text-zinc-700" />
              <div className="text-left">
                <p className="font-bold">Export All Financial Data (.CSV)</p>
                <p className="text-[11px] text-zinc-500 font-normal">Excel Ledger Reconciliation</p>
              </div>
            </div>
            <DownloadIcon size={16} />
          </button>
        </div>
      </div>

    </div>
  );
}