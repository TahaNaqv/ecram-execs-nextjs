import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { PageBody, PageHeader, Card } from "../../../../_components/ui";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { formatEuro } from "@/lib/admin/format";
import { updateCorporateBilling } from "@/lib/admin/corporate-actions";
import { ArrowLeftIcon } from "../../../../_components/icons";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);
  return {
    title: detail ? `Billing: ${detail.partner.companyName} | Ecram Execs` : "Corporate Partner Not Found",
  };
}

export default async function CorporateBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);

  if (!detail) {
    notFound();
  }

  const { partner, totalSpend, bookings } = detail;
  const vatNumber = partner.kvk && partner.kvk !== "—" ? `NL${partner.kvk.replace(/\D/g, "")}B01` : "NL84920193B01";

  return (
    <PageBody>
      <div className="mb-4">
        <Link
          href={`/admin/corporate/${id}/bookings`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition"
        >
          <ArrowLeftIcon size={14} /> Back to Partner Profile
        </Link>
      </div>

      <PageHeader
        title={`Corporate Billing: ${partner.companyName}`}
        description={`Manage Dutch BTW invoicing, VAT credentials, and credit limits for ${partner.companyName}`}
      />

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2 space-y-5">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
              Tax &amp; Invoice Registration (BTW Belastingdienst)
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Updates are saved directly to this corporate account in the database.
            </p>
          </div>

          <form
            action={async (formData: FormData) => {
              "use server";
              await updateCorporateBilling(formData);
            }}
            className="space-y-4 text-xs"
          >
            <input type="hidden" name="id" value={id} />

            <div>
              <label className="block text-zinc-700 font-medium mb-1">Company Legal Entity</label>
              <input
                type="text"
                name="companyName"
                defaultValue={partner.companyName}
                required
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-700 font-medium mb-1">Dutch KVK Number</label>
                <input
                  type="text"
                  name="kvk"
                  defaultValue={partner.kvk !== "—" ? partner.kvk : ""}
                  placeholder="8 digits"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
              <div>
                <label className="block text-zinc-700 font-medium mb-1">Calculated BTW / VAT Number</label>
                <input
                  type="text"
                  value={vatNumber}
                  readOnly
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-zinc-700 font-medium mb-1">Billing Invoicing Cycle</label>
                <select
                  name="billingCycle"
                  defaultValue="monthly"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                >
                  <option value="monthly">Monthly Net-30 SEPA</option>
                  <option value="biweekly">Bi-Weekly Settlement</option>
                  <option value="mollie">Instant Mollie B2B Direct</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-700 font-medium mb-1">Primary Booker</label>
                <input
                  type="text"
                  value={`${partner.bookerName} (${partner.email})`}
                  readOnly
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-600 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex justify-end">
              <button
                type="submit"
                className="bg-black hover:bg-zinc-800 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Save Billing Changes
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-6 space-y-4 bg-zinc-950 text-white flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Account Spend &amp; Credit</h3>
            <p className="text-xs text-zinc-500 mt-1">Calculated from confirmed quotes in database</p>

            <div className="mt-6 space-y-4 text-xs font-mono">
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-sans">Lifetime Booking Spend</span>
                <span className="text-2xl font-bold text-emerald-400">{formatEuro(totalSpend)}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-sans">Total Dispatches</span>
                <span className="text-xl font-bold text-white">{bookings.length} rides</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] block uppercase font-sans">Account Standing</span>
                <span className="text-sm font-semibold text-emerald-300">In Good Standing</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <Link
              href={`/admin/corporate/${id}/bookings`}
              className="block w-full bg-zinc-800 hover:bg-zinc-700 text-white text-center font-semibold py-2.5 rounded-xl text-xs transition"
            >
              Inspect Partner Ride Log
            </Link>
          </div>
        </Card>
      </div>
    </PageBody>
  );
}