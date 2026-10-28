"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@/app/(admin)/admin/_components/icons";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { interpolate } from "@/lib/i18n/interpolate";

type HubCopy = Dictionary["admin"]["corporate"]["hub"];

export function PartnerBillingClient({
  partnerId,
  companyName,
  kvkNumber,
  kvrNumber,
  totalSpend,
  copy,
}: {
  partnerId: string;
  companyName: string;
  kvkNumber: string;
  kvrNumber: string;
  totalSpend: number;
  bookings: any[];
  copy: HubCopy;
}) {
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <Link
            href={`/admin/corporate/${partnerId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950 transition-colors mb-1.5"
          >
            <ArrowLeftIcon size={13} /> {copy.backToProfile}
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">{interpolate(copy.billingTitle, { company: companyName })}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{copy.billingPageSubtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">{copy.registration}</h3>
          <div className="text-xs space-y-2 text-zinc-700">
            <p><strong className="text-zinc-900">{copy.kvkNumber}:</strong> {kvkNumber}</p>
            <p><strong className="text-zinc-900">{copy.kvrNumber}:</strong> {kvrNumber}</p>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">{copy.ytdFinancials}</h3>
          <div className="text-xs space-y-2 text-zinc-700">
            <p><strong className="text-zinc-900">{copy.contractSpend}:</strong> € {totalSpend.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
            <p><strong className="text-zinc-900">{copy.estimatedVat}:</strong> € {(totalSpend * 0.21).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}