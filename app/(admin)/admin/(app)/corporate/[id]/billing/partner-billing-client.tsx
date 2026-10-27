"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@/app/(admin)/admin/_components/icons";

export function PartnerBillingClient({
  partnerId,
  companyName,
  kvkNumber,
  kvrNumber,
  totalSpend,
}: {
  partnerId: string;
  companyName: string;
  kvkNumber: string;
  kvrNumber: string;
  totalSpend: number;
  bookings: any[];
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <Link
            href={`/admin/corporate/${partnerId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950 transition-colors mb-1.5"
          >
            <ArrowLeftIcon size={13} /> Back to Partner Profile
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">{companyName} — Billing &amp; VAT</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Corporate financial ledger, KVK details, and invoicing summary</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">Company Registration</h3>
          <div className="text-xs space-y-2 text-zinc-700">
            <p><strong className="text-zinc-900">KVK Number:</strong> {kvkNumber}</p>
            <p><strong className="text-zinc-900">KVR Number:</strong> {kvrNumber}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">YTD Financials</h3>
          <div className="text-xs space-y-2 text-zinc-700">
            <p><strong className="text-zinc-900">Total Contract Spend (Net of VAT):</strong> € {totalSpend.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
            <p><strong className="text-zinc-900">Estimated VAT (21%):</strong> € {(totalSpend * 0.21).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}