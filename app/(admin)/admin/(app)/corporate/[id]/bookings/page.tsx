export const instant = false;
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PageBody, PageHeader, Card } from "../../../../_components/ui";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { formatEuro, formatPickup } from "@/lib/admin/format";
import { StatusBadge } from "../../../../_components/status-badge";
import { ArrowLeftIcon, BriefcaseIcon, CalendarIcon } from "../../../../_components/icons";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  return {
    title: detail ? `Partner: ${detail.partner.companyName} | Ecram Execs` : "Corporate Partner Not Found",
  };
}

export default async function CorporatePartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);

  if (!detail) {
    notFound();
  }

  const { partner, bookings, totalSpend, activeCount, completedCount } = detail;
  const avgSpend = bookings.length > 0 ? totalSpend / bookings.length : 0;

  return (
    <PageBody>
      <div className="mb-4">
        <Link
          href="/admin/corporate"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition"
        >
          <ArrowLeftIcon size={14} /> Back to Corporate Directory
        </Link>
      </div>

      <PageHeader
        title={`Partner Profile: ${partner.companyName}`}
        description={`Real-time ride dispatch log and commercial telemetry for account ID: ${id}`}
        actions={
          <Link
            href={`/admin/corporate/${id}/billing`}
            className="bg-black hover:bg-zinc-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-sm"
          >
            Manage Billing &amp; VAT
          </Link>
        }
      />

      <div className="mt-6 space-y-6">
        {/* Top Summary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Total Bookings</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-zinc-950">{bookings.length}</span>
              <span className="text-[11px] text-zinc-500 font-mono">Lifetime</span>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Active Rides</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-600">{activeCount}</span>
              <span className="text-[11px] text-emerald-700 font-mono">In Progress</span>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Completed Trips</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-zinc-950">{completedCount}</span>
              <span className="text-[11px] text-zinc-500 font-mono">Fulfilled</span>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Total Spend (EUR)</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-700">{formatEuro(totalSpend)}</span>
              <span className="text-[11px] text-zinc-500 font-mono">Gross</span>
            </div>
          </Card>
        </div>

        {/* Main Profile & Key Metrics Split */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Partner Overview & Contacts Card */}
          <Card className="p-6 xl:col-span-2 space-y-5">
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">{partner.companyName}</h3>
                <p className="text-xs text-zinc-500">
                  Account Contact: {partner.bookerName} • Member Since: {partner.partnershipSince}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  partner.status === "Active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {partner.status} Account
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-semibold uppercase tracking-wider text-zinc-400">Primary Booker Contact</h4>
                <div className="flex items-center gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/80">
                  <div className="size-9 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-700">
                    {partner.bookerName
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900">{partner.bookerName}</p>
                    <p className="text-[11px] text-zinc-500">{partner.bookerRole}</p>
                  </div>
                </div>
                <div className="space-y-1.5 font-mono text-zinc-700 pl-1">
                  <div>
                    Email:{" "}
                    <a href={`mailto:${partner.email}`} className="text-emerald-700 underline">
                      {partner.email}
                    </a>
                  </div>
                  <div>
                    Phone: <span className="text-zinc-900">{partner.phone}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold uppercase tracking-wider text-zinc-400">Registration &amp; Vehicle</h4>
                <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/80 space-y-2 font-mono text-zinc-800">
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-sans">KVK Number</span>
                    {partner.kvk}
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px] uppercase font-sans">Preferred Vehicle</span>
                    {partner.preferredVehicle}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Key Metrics Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Commercial Summary</h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-sans">Total Dispatches</span>
                <span className="font-bold text-zinc-950">{bookings.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-sans">Avg. Booking Value</span>
                <span className="font-bold text-zinc-950">{formatEuro(avgSpend)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-sans">Total Spend</span>
                <span className="font-bold text-emerald-700 text-sm">{formatEuro(totalSpend)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-500 font-sans">Preferred Fleet</span>
                <span className="font-bold text-zinc-950">{partner.preferredVehicle}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Bookings Table Section */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center text-xs">
            <span className="font-semibold text-zinc-700 uppercase tracking-wider">
              Corporate Ride History ({bookings.length})
            </span>
            <span className="font-mono text-zinc-500">Live Database Records</span>
          </div>

          <div className="overflow-x-auto">
            {bookings.length === 0 ? (
              <div className="p-12 text-center text-xs text-zinc-500">
                <div className="grid size-12 place-items-center rounded-2xl bg-zinc-100 mx-auto mb-3 text-zinc-400">
                  <CalendarIcon size={20} />
                </div>
                <p className="font-semibold text-zinc-900 text-sm">No corporate bookings recorded yet</p>
                <p className="mt-1 text-zinc-500">
                  Rides booked by this corporate partner or assigned to this entity will appear here automatically.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  <tr>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-4 py-3">Pickup Time</th>
                    <th className="px-4 py-3">Passenger</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3 text-right">Quoted Amount</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-mono text-zinc-800">
                  {bookings.map((b) => (
                    <tr key={b.id} className="hover:bg-zinc-50/50">
                      <td className="px-5 py-3.5 font-bold text-zinc-950">
                        <Link href={`/admin/requests/${b.id}`} className="hover:underline text-emerald-700">
                          {b.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-zinc-600 font-sans">
                        {b.pickupAt ? formatPickup(b.pickupAt) : "—"}
                      </td>
                      <td className="px-4 py-3.5 font-sans font-medium text-zinc-900">
                        {b.passengerName || b.name}
                      </td>
                      <td className="px-4 py-3.5 font-sans text-zinc-600 max-w-xs truncate">
                        {b.collection || "—"} → {b.destination || (b.durationHours ? `${b.durationHours}h As Directed` : "—")}
                      </td>
                      <td className="px-4 py-3.5 font-sans text-zinc-700">
                        {b.vehicle || "Standard Executive"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-zinc-950">
                        {formatEuro(b.quotedAmount)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-sans">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </PageBody>
  );
}