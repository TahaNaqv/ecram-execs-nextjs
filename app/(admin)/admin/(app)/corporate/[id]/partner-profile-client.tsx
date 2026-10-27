"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminDrawer } from "@/app/(admin)/admin/_components/admin-drawer";
import { AdminModal } from "@/app/(admin)/admin/_components/admin-modal";

export function PartnerProfileClient({ partner }: { partner: any }) {
  // Manage which drawer or modal is active
  const [activeDrawer, setActiveDrawer] = useState<"bookings" | "billing" | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Check if data exists for conditional drawer triggers
  const hasBookings = partner.recentBookings && partner.recentBookings.length > 0;
  const hasBillingData = partner.totalSpend > 0 || partner.kvkNumber;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">{partner.companyName}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">KVK: {partner.kvkNumber} &bull; Booker: {partner.bookerName}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit Profile Button -> Opens Modal */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 transition-colors"
          >
            Edit Profile
          </button>

          {/* Bookings Button -> Opens Drawer ONLY IF bookings exist */}
          {hasBookings && (
            <button
              onClick={() => setActiveDrawer("bookings")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 transition-colors"
            >
              View Bookings ({partner.recentBookings.length})
            </button>
          )}

          {/* Billing Button -> Opens Drawer ONLY IF billing/spend data exists */}
          {hasBillingData && (
            <button
              onClick={() => setActiveDrawer("billing")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50 transition-colors"
            >
              Billing &amp; VAT
            </button>
          )}
        </div>
      </div>

      {/* Profile Dashboard Overview Grids */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Trips</p>
          <p className="text-2xl font-bold tracking-tight text-zinc-950">{partner.totalTrips}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Avg Trip Value</p>
          <p className="text-2xl font-bold tracking-tight text-zinc-950">€ {partner.avgTripValue}</p>
        </div>
        <div className="rounded-xl border border-zinc-950 bg-zinc-950 text-white p-5 shadow-xs space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Spend</p>
          <p className="text-2xl font-bold tracking-tight">€ {partner.totalSpend.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Preferred Vehicle</p>
          <p className="text-lg font-bold tracking-tight text-zinc-950 truncate">{partner.topVehicle}</p>
        </div>
      </div>

      {/* --- BOOKINGS SIDEBAR DRAWER --- */}
      <AdminDrawer
        isOpen={activeDrawer === "bookings"}
        onClose={() => setActiveDrawer(null)}
        title={`${partner.companyName} — Bookings`}
        subtitle="Complete history of executive transport itineraries"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/admin/corporate/${partner.id}/bookings`}
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              Open in full page view &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Passenger</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {partner.recentBookings.map((b: any) => (
                  <tr key={b.id} className="hover:bg-zinc-50/50">
                    <td className="px-4 py-3 font-mono text-sky-700 font-bold">{b.reference}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{b.passengerName}</p>
                      <p className="text-[11px] text-zinc-400">{b.pickupDate}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">€ {b.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminDrawer>

      {/* --- BILLING SIDEBAR DRAWER --- */}
      <AdminDrawer
        isOpen={activeDrawer === "billing"}
        onClose={() => setActiveDrawer(null)}
        title={`${partner.companyName} — Billing & VAT`}
        subtitle="Corporate financial ledger and KVK registration details"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link
              href={`/admin/corporate/${partner.id}/billing`}
              className="text-xs font-medium text-sky-700 hover:underline"
            >
              Open in full page view &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
            <p className="text-xs"><strong className="text-zinc-950">KVK Number:</strong> {partner.kvkNumber}</p>
            <p className="text-xs"><strong className="text-zinc-950">KVR Number:</strong> {partner.kvrNumber}</p>
            <p className="text-xs"><strong className="text-zinc-950">Total YTD Spend:</strong> € {partner.totalSpend.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </AdminDrawer>

      {/* --- EDIT PROFILE MODAL --- */}
      <AdminModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit ${partner.companyName}`}
        subtitle="Update corporate partner parameters and configuration settings"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-zinc-700 mb-1">Company Name</label>
            <input
              type="text"
              defaultValue={partner.companyName}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>
          <div>
            <label className="block font-medium text-zinc-700 mb-1">KVK Number</label>
            <input
              type="text"
              defaultValue={partner.kvkNumber}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-lg bg-zinc-950 px-3 py-1.5 font-medium text-white hover:bg-zinc-800"
            >
              Save Changes
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}