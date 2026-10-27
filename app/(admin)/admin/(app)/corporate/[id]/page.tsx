import { Suspense } from "react";
import type { Metadata } from "next";
import { PageBody, PageHeader, Card } from "../../../_components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Partner Profile: Deloitte EMEA" };
}

export default async function CorporatePartnerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PageBody>
      <PageHeader
        title="Partner Profile: Deloitte EMEA"
        description={`Comprehensive analytics, contacts, and ride dispatch log for reference ID: ${id}`}
      />

      <div className="mt-6 space-y-6">
        
        {/* Top Summary Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-xs">
          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Total Active Partners</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-zinc-950">115</span>
              <span className="text-[11px] text-emerald-600 font-mono">+4 this month</span>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Top Tier (Platinum) Partners</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-zinc-950">15</span>
              <span className="text-[11px] text-zinc-500 font-mono">Contracted &gt;€40k</span>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Partners Requiring Q4 Review</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-amber-600">4</span>
              <span className="text-[11px] text-amber-700 font-mono">Action Due</span>
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between">
            <span className="text-zinc-500 font-semibold uppercase tracking-wider">Avg. Partnership Value (MTD)</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold font-mono text-emerald-700">€12,500</span>
              <span className="text-[11px] text-zinc-500 font-mono">Per Account</span>
            </div>
          </Card>
        </div>

        {/* Main Profile & Key Metrics Split */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Partner Overview & Contacts Card */}
          <Card className="p-6 xl:col-span-2 space-y-5">
            <div className="flex flex-wrap items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-950">Deloitte EMEA</h3>
                <p className="text-xs text-zinc-500">Managed by: Sarah Jensen • Partnership Since: 2020</p>
              </div>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">
                Platinum Partner
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-semibold uppercase tracking-wider text-zinc-400">Primary Contact</h4>
                <div className="flex items-center gap-3 bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/80">
                  <div className="size-9 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-zinc-700">SJ</div>
                  <div>
                    <p className="font-semibold text-zinc-900">Sarah Jensen</p>
                    <p className="text-[11px] text-zinc-500">Global Mobility Lead</p>
                  </div>
                </div>
                <div className="space-y-1.5 font-mono text-zinc-700 pl-1">
                  <div>Email: <a href="mailto:s.jensen@deloitte.com" className="text-emerald-700 underline">s.jensen@deloitte.com</a></div>
                  <div>Phone: <span className="text-zinc-900">+31 20 123 4567</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold uppercase tracking-wider text-zinc-400">Billing Details &amp; Address</h4>
                <div className="bg-zinc-50 p-3.5 rounded-xl border border-zinc-200/80 space-y-2 font-mono text-zinc-800">
                  <div><span className="text-zinc-400 block text-[10px] uppercase font-sans">Billing Contact</span> Mark Davies</div>
                  <div><span className="text-zinc-400 block text-[10px] uppercase font-sans">Corporate Address</span> Gustav Mahlerlaan 2970, 1081 LA Amsterdam</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Key Metrics YTD Card */}
          <Card className="p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Key Metrics YTD</h3>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-sans">Total Trips</span>
                <span className="font-bold text-zinc-950">1,432</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-sans">Avg. Trip Value</span>
                <span className="font-bold text-zinc-950">€115.50</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100">
                <span className="text-zinc-500 font-sans">Total Spend</span>
                <span className="font-bold text-emerald-700 text-sm">€165,396.00</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-zinc-500 font-sans">Top Vehicle</span>
                <span className="font-bold text-zinc-950">Mercedes-EQS</span>
              </div>
            </div>
          </Card>

        </div>

        {/* Recent Bookings Table Section */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center text-xs">
            <span className="font-semibold text-zinc-700 uppercase tracking-wider">Recent Corporate Bookings</span>
            <span className="font-mono text-zinc-500">Showing last 4 dispatches</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Booking ID</th>
                  <th className="px-4 py-3">Passenger</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 font-mono text-zinc-800">
                <tr className="hover:bg-zinc-50/50">
                  <td className="px-5 py-3.5 text-zinc-500">25/10</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-950">DEL-7781</td>
                  <td className="px-4 py-3.5 font-sans font-medium">Sarah Jensen</td>
                  <td className="px-4 py-3.5 font-sans text-zinc-600">Office → Schiphol</td>
                  <td className="px-5 py-3.5 text-right font-sans">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Confirmed
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/50">
                  <td className="px-5 py-3.5 text-zinc-500">24/10</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-950">DEL-7775</td>
                  <td className="px-4 py-3.5 font-sans font-medium">John Smith</td>
                  <td className="px-4 py-3.5 font-sans text-zinc-600">Hotel De L'Europe → Office</td>
                  <td className="px-5 py-3.5 text-right font-sans">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Confirmed
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/50">
                  <td className="px-5 py-3.5 text-zinc-500">24/10</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-950">DEL-7770</td>
                  <td className="px-4 py-3.5 font-sans font-medium">Maria Garcia</td>
                  <td className="px-4 py-3.5 font-sans text-zinc-600">RAI → Schiphol</td>
                  <td className="px-5 py-3.5 text-right font-sans">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Confirmed
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-zinc-50/50">
                  <td className="px-5 py-3.5 text-zinc-500">23/10</td>
                  <td className="px-4 py-3.5 font-bold text-zinc-950">DEL-7765</td>
                  <td className="px-4 py-3.5 font-sans font-medium">David Chen</td>
                  <td className="px-4 py-3.5 font-sans text-zinc-600">Office → Anne Frank House</td>
                  <td className="px-5 py-3.5 text-right font-sans">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Confirmed
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </PageBody>
  );
}