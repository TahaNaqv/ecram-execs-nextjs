import { notFound } from "next/navigation";
import Link from "next/link";
import { getCorporatePartnerDetail } from "@/lib/admin/live-queries";
import { updateCorporatePartner } from "@/lib/admin/corporate-actions";
import { ArrowLeftIcon } from "../../../../_components/icons";
import { Card, PageBody, PageHeader } from "../../../../_components/ui";

export default async function EditCorporatePartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getCorporatePartnerDetail(id);

  if (!detail) {
    notFound();
  }

  const { partner: p } = detail;

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateCorporatePartner(formData);
  }

  return (
    <PageBody>
      <div className="mb-4">
        <Link
          href={`/admin/corporate/${id}`}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-950 transition-colors"
        >
          <ArrowLeftIcon size={14} /> Back to Partner Profile
        </Link>
      </div>

      <PageHeader
        title={`Edit Corporate Partner: ${p.companyName}`}
        description={`Modify corporate configuration, primary booker details, and account status for ID: ${id}`}
      />

      <div className="mt-6 max-w-3xl">
        <Card className="p-6">
          <form action={handleUpdate} className="space-y-5 text-xs">
            <input type="hidden" name="id" value={id} />

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Company Legal Name</label>
              <input
                type="text"
                name="companyName"
                defaultValue={p.companyName}
                required
                className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Dutch KVK Number</label>
                <input
                  type="text"
                  name="kvk"
                  defaultValue={p.kvk === "—" ? "" : p.kvk}
                  placeholder="8 digits"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 font-mono text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Account Status</label>
                <select
                  name="status"
                  defaultValue={p.status}
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Pending 2FA">Pending 2FA</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Primary Booker Name</label>
                <input
                  type="text"
                  name="bookerName"
                  defaultValue={p.bookerName}
                  required
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">Booker Role / Title</label>
                <input
                  type="text"
                  name="bookerRole"
                  defaultValue={p.bookerRole}
                  placeholder="e.g. Executive Assistant / Travel Manager"
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3.5 py-2.5 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 flex items-center gap-3">
              <button
                type="submit"
                className="bg-zinc-950 hover:bg-zinc-800 text-white font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                Save Changes
              </button>
              <Link
                href={`/admin/corporate/${id}`}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold px-5 py-2.5 rounded-xl transition text-xs"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </PageBody>
  );
}