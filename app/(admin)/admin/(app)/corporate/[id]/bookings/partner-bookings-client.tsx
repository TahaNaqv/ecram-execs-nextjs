"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@/app/(admin)/admin/_components/icons";

export function PartnerBookingsClient({
  partnerId,
  companyName,
  bookings,
}: {
  partnerId: string;
  companyName: string;
  bookings: Array<{
    id: string;
    reference: string;
    passengerName: string;
    route: string;
    vehicle: string;
    pickupDate: string;
    amount: number;
    status: string;
  }>;
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
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">{companyName} — All Bookings</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Complete history of executive transport itineraries</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Reference</th>
                <th className="px-4 py-3 font-semibold">Passenger / Itinerary</th>
                <th className="px-4 py-3 font-semibold">Vehicle</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-5 py-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-zinc-400">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/requests/${b.id}`} className="font-mono font-bold text-sky-700 hover:underline">
                        {b.reference}
                      </Link>
                      <span className="block text-[11px] text-zinc-400">{b.pickupDate}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-zinc-900">{b.passengerName}</p>
                      <p className="text-[11px] text-zinc-500 truncate max-w-xs">{b.route}</p>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-700">{b.vehicle}</td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-950">€ {b.amount.toFixed(2)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}